import { getSupabase } from './supabase';
import { WebRTCSignalPayload } from '../types';
import { realtimeClient } from './realtimeClient';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelay',
      credential: 'openrelay',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelay',
      credential: 'openrelay',
    },
  ],
  iceCandidatePoolSize: 10,
};

export class WebRTCManager {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentUserId: string;
  private boardId: string;
  private channel: ReturnType<NonNullable<ReturnType<typeof getSupabase>>['channel']> | null = null;
  private localBroadcast: BroadcastChannel | null = null;
  private unsubscribeRealtime: (() => void) | null = null;
  public pendingOffer: { from: string; sdp: RTCSessionDescriptionInit } | null = null;
  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  public onRemoteStreamCallback: ((stream: MediaStream | null) => void) | null = null;
  public onConnectionStateChangeCallback: ((state: RTCPeerConnectionState) => void) | null = null;
  public onIncomingCallCallback: ((from: string) => void) | null = null;

  constructor(currentUserId: string, boardId: string) {
    this.currentUserId = currentUserId;
    this.boardId = boardId;

    // 1. Local Broadcast Channel
    if (typeof window !== 'undefined') {
      this.localBroadcast = new BroadcastChannel(`tp_webrtc_${boardId}`);
      this.localBroadcast.onmessage = (e) => {
        this.handleSignal(e.data);
      };
    }

    // 2. Server WebSocket Relay (works across different computers)
    this.unsubscribeRealtime = realtimeClient.on('webrtc:signal', (signal) => {
      this.handleSignal(signal);
    });

    // 3. Supabase fallback
    const supabase = getSupabase();
    if (supabase) {
      this.channel = supabase.channel(`webrtc:${boardId}`, {
        config: { broadcast: { self: false } },
      });

      this.channel
        .on('broadcast', { event: 'signal' }, ({ payload }) => {
          this.handleSignal(payload);
        })
        .subscribe();
    }
  }

  private sendSignal(signal: WebRTCSignalPayload) {
    // Send via local broadcast
    this.localBroadcast?.postMessage(signal);

    // Send via Server WebSocket
    realtimeClient.sendWebRTCSignal(signal);

    // Send via Supabase channel if available
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'signal',
        payload: signal,
      });
    }
  }

  public async startLocalMedia(video = true, audio = true): Promise<MediaStream> {
    if (this.localStream && this.localStream.active) {
      return this.localStream;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } : false,
        audio: audio,
      });
      this.localStream = stream;
      return stream;
    } catch (err) {
      console.warn('[WebRTC] Full video+audio getUserMedia failed, retrying audio-only fallback:', err);
      if (video) {
        // Fallback to audio only
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: true,
        });
        this.localStream = audioStream;
        return audioStream;
      }
      throw err;
    }
  }

  public getLocalStream() {
    return this.localStream;
  }

  public getRemoteStream() {
    return this.remoteStream;
  }

  private createPeerConnection(): RTCPeerConnection {
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
    }

    this.pc = new RTCPeerConnection(RTC_CONFIG);
    this.remoteStream = new MediaStream();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.localStream && this.pc) {
          this.pc.addTrack(track, this.localStream);
        }
      });
    }

    this.pc.ontrack = (event) => {
      console.log('[WebRTC] ontrack received:', event.track.kind);
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
      }

      event.track.onunmute = () => {
        if (this.onRemoteStreamCallback) {
          this.onRemoteStreamCallback(this.remoteStream);
        }
      };

      if (this.onRemoteStreamCallback) {
        this.onRemoteStreamCallback(this.remoteStream);
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          type: 'candidate',
          from: this.currentUserId,
          board_id: this.boardId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE Connection State:', this.pc?.iceConnectionState);
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Peer Connection State:', this.pc?.connectionState);
      if (this.pc && this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.pc.connectionState);
      }
    };

    return this.pc;
  }

  private async flushPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    const candidates = [...this.pendingIceCandidates];
    this.pendingIceCandidates = [];
    for (const cand of candidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (err) {
        console.warn('[WebRTC] Error adding buffered ICE candidate:', err);
      }
    }
  }

  public async initiateCall() {
    await this.startLocalMedia();
    const pc = this.createPeerConnection();

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await pc.setLocalDescription(offer);

    this.sendSignal({
      type: 'offer',
      from: this.currentUserId,
      board_id: this.boardId,
      sdp: offer,
    });
  }

  public async acceptIncomingCall(fromUserId: string, offerSdp: RTCSessionDescriptionInit) {
    await this.startLocalMedia();
    const pc = this.createPeerConnection();

    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    await this.flushPendingCandidates();

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.sendSignal({
      type: 'answer',
      from: this.currentUserId,
      to: fromUserId,
      board_id: this.boardId,
      sdp: answer,
    });
  }

  public async acceptPendingCall() {
    if (this.pendingOffer) {
      const { from, sdp } = this.pendingOffer;
      this.pendingOffer = null;
      await this.acceptIncomingCall(from, sdp);
    }
  }

  private async handleSignal(signal: WebRTCSignalPayload) {
    if (signal.from === this.currentUserId) return;

    switch (signal.type) {
      case 'offer':
        if (signal.sdp) {
          this.pendingOffer = { from: signal.from, sdp: signal.sdp };
          if (this.onIncomingCallCallback) {
            this.onIncomingCallCallback(signal.from);
          }
        }
        break;

      case 'answer':
        if (signal.sdp && this.pc) {
          try {
            await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            await this.flushPendingCandidates();
          } catch (err) {
            console.warn('[WebRTC] Error setting remote answer SDP:', err);
          }
        }
        break;

      case 'candidate':
        if (signal.candidate) {
          if (this.pc && this.pc.remoteDescription) {
            try {
              await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (err) {
              console.warn('[WebRTC] Could not add live ICE candidate, buffering:', err);
              this.pendingIceCandidates.push(signal.candidate);
            }
          } else {
            // Buffer candidate until remote description is set
            this.pendingIceCandidates.push(signal.candidate);
          }
        }
        break;

      case 'call_end':
        this.endCall(false);
        break;
    }
  }

  public toggleMute(): boolean {
    if (!this.localStream) return false;
    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      return !audioTrack.enabled; // true if muted
    }
    return false;
  }

  public toggleCamera(): boolean {
    if (!this.localStream) return false;
    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      return !videoTrack.enabled; // true if camera is off
    }
    return false;
  }

  public endCall(broadcast = true) {
    if (broadcast) {
      this.sendSignal({
        type: 'call_end',
        from: this.currentUserId,
        board_id: this.boardId,
      });
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }

    this.pendingIceCandidates = [];
    this.pendingOffer = null;
    this.remoteStream = null;
    if (this.onRemoteStreamCallback) {
      this.onRemoteStreamCallback(null);
    }
  }

  public cleanup() {
    this.endCall(false);
    this.localBroadcast?.close();
    this.unsubscribeRealtime?.();
    const supabase = getSupabase();
    if (supabase && this.channel) {
      supabase.removeChannel(this.channel);
    }
  }
}

import { getSupabase } from './supabase';
import { WebRTCSignalPayload } from '../types';
import { realtimeClient } from './realtimeClient';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
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
    if (this.localStream) {
      return this.localStream;
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24 } } : false,
      audio: audio,
    });
    this.localStream = stream;
    return stream;
  }

  public getLocalStream() {
    return this.localStream;
  }

  public getRemoteStream() {
    return this.remoteStream;
  }

  private createPeerConnection() {
    if (this.pc) {
      this.pc.close();
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
      event.streams[0]?.getTracks().forEach((track) => {
        this.remoteStream?.addTrack(track);
      });
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

    this.pc.onconnectionstatechange = () => {
      if (this.pc && this.onConnectionStateChangeCallback) {
        this.onConnectionStateChangeCallback(this.pc.connectionState);
      }
    };

    return this.pc;
  }

  public async initiateCall() {
    await this.startLocalMedia();
    const pc = this.createPeerConnection();

    const offer = await pc.createOffer();
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

  private async handleSignal(signal: WebRTCSignalPayload) {
    if (signal.from === this.currentUserId) return;
    if (signal.board_id !== this.boardId) return;

    switch (signal.type) {
      case 'offer':
        if (signal.sdp) {
          if (this.onIncomingCallCallback) {
            this.onIncomingCallCallback(signal.from);
          }
          // Accept offer
          await this.acceptIncomingCall(signal.from, signal.sdp);
        }
        break;

      case 'answer':
        if (signal.sdp && this.pc) {
          await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
        break;

      case 'candidate':
        if (signal.candidate && this.pc) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch (err) {
            console.warn('Could not add ICE candidate:', err);
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
      this.pc.close();
      this.pc = null;
    }

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

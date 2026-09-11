import { Peer, DataConnection, MediaConnection } from 'peerjs';
import { CharacterCard, EpisodeBoard, PresenceUser, StickyNote, StringConnection } from '../types';

export interface P2PStateSnapshot {
  boardId: string;
  cards: CharacterCard[];
  stickies: StickyNote[];
  strings: StringConnection[];
  boards?: EpisodeBoard[];
  screeningState?: any;
}

export type P2PMessage =
  | { type: 'presence:hello'; user: PresenceUser; peerId: string }
  | { type: 'presence:ack'; user: PresenceUser; peerId: string }
  | { type: 'state:request'; fromPeerId: string }
  | { type: 'state:snapshot'; snapshot: P2PStateSnapshot }
  | { type: 'card:move'; payload: { id: string; x: number; y: number; boardId: string } }
  | { type: 'card:upsert'; payload: { card: CharacterCard } }
  | { type: 'card:delete'; payload: { id: string } }
  | { type: 'sticky:move'; payload: { id: string; x: number; y: number } }
  | { type: 'sticky:upsert'; payload: { sticky: StickyNote } }
  | { type: 'sticky:delete'; payload: { id: string } }
  | { type: 'string:upsert'; payload: { string: StringConnection } }
  | { type: 'string:delete'; payload: { id: string } }
  | { type: 'board:create'; payload: { board: EpisodeBoard } }
  | { type: 'watch:playback'; payload: any }
  | { type: 'watch:chat'; payload: any }
  | { type: 'watch:countdown'; payload: any }
  | { type: 'watch:ready'; payload: any }
  | { type: 'call:ring'; callerName: string; callerPeerId: string; isVideo: boolean }
  | { type: 'call:cancel'; callerPeerId: string };

type MessageHandler = (msg: P2PMessage) => void;

export class P2PSyncService {
  private static instance: P2PSyncService | null = null;
  private peer: Peer | null = null;
  private activeConnection: DataConnection | null = null;
  private activeMediaCall: MediaConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  public myPeerId: string = '';
  public partnerPeerId: string = '';
  public isConnectedToPartner: boolean = false;
  public partnerUser: PresenceUser | null = null;
  public roomCode: string = 'twinpeaks-sheriff-case';

  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private incomingCallHandlers: Set<(callerName: string, isVideo: boolean) => void> = new Set();
  private remoteStreamHandlers: Set<(stream: MediaStream | null) => void> = new Set();
  private callEndedHandlers: Set<() => void> = new Set();

  private currentUser: PresenceUser | null = null;
  private currentBoardId: string = 'episode-1-pilot';
  private reconnectInterval: any = null;
  private pingInterval: any = null;
  private isDestroyed = false;

  private constructor() {
    this.roomCode = this.getInitialRoomCode();
  }

  public static getInstance(): P2PSyncService {
    if (!P2PSyncService.instance) {
      P2PSyncService.instance = new P2PSyncService();
    }
    return P2PSyncService.instance;
  }

  private getInitialRoomCode(): string {
    if (typeof window === 'undefined') return 'twinpeaks-sheriff-case';
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('room');
    if (fromUrl && fromUrl.trim()) {
      localStorage.setItem('tp_room_code', fromUrl.trim().toLowerCase());
      return fromUrl.trim().toLowerCase();
    }
    const fromStorage = localStorage.getItem('tp_room_code');
    if (fromStorage && fromStorage.trim()) {
      return fromStorage.trim().toLowerCase();
    }
    return 'twinpeaks-sheriff-case';
  }

  public setRoomCode(code: string) {
    if (!code || !code.trim()) return;
    const clean = code.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    this.roomCode = clean;
    if (typeof window !== 'undefined') {
      localStorage.setItem('tp_room_code', clean);
      // Update URL query parameter without full reload
      const url = new URL(window.location.href);
      url.searchParams.set('room', clean);
      window.history.replaceState({}, '', url.toString());
    }
    // Reinitialize peer with new room slots
    this.restart();
  }

  public start(currentUser: PresenceUser, boardId: string) {
    this.currentUser = currentUser;
    this.currentBoardId = boardId;
    this.isDestroyed = false;
    this.initPeer(1);
  }

  private initPeer(slotIndex: number) {
    if (this.isDestroyed || typeof window === 'undefined') return;

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }

    const cleanRoom = this.roomCode.replace(/[^a-z0-9]/g, '');
    const isPrimaryRole =
      this.currentUser?.name?.toLowerCase().includes('cooper') ||
      this.currentUser?.name?.toLowerCase().includes('dale') ||
      this.currentUser?.email?.includes('nsbrooks23');

    // Deterministic IDs: Cooper claims cooper, Partner claims partner
    let desiredId = isPrimaryRole
      ? `tp-${cleanRoom}-cooper`
      : `tp-${cleanRoom}-partner`;
    let targetPartner = isPrimaryRole
      ? `tp-${cleanRoom}-partner`
      : `tp-${cleanRoom}-cooper`;

    if (slotIndex > 1) {
      desiredId = `${desiredId}-${slotIndex}`;
    }

    this.myPeerId = desiredId;
    this.partnerPeerId = targetPartner;

    try {
      this.peer = new Peer(desiredId, {
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun.relay.metered.ca:80' },
            {
              urls: [
                'turn:global.relay.metered.ca:80',
                'turn:global.relay.metered.ca:80?transport=tcp',
                'turn:global.relay.metered.ca:443',
                'turns:global.relay.metered.ca:443?transport=tcp',
              ],
              username: 'openrelayproject',
              credential: 'openrelayproject',
            },
          ],
        },
      });

      this.peer.on('open', (id) => {
        this.myPeerId = id;
        console.log(`[P2PSync] PeerJS registered as ${id} in room ${this.roomCode}`);
        this.startHeartbeatAndDiscovery();
      });

      this.peer.on('connection', (conn) => {
        console.log(`[P2PSync] Incoming P2P Data connection from ${conn.peer}`);
        this.setupConnection(conn);
      });

      this.peer.on('call', (call) => {
        console.log(`[P2PSync] Incoming Media call from ${call.peer}`);
        this.activeMediaCall = call;

        const callerName = this.partnerUser?.name || 'Investigative Partner';
        this.incomingCallHandlers.forEach((cb) => cb(callerName, true));

        call.on('stream', (remoteStream) => {
          this.remoteStream = remoteStream;
          this.remoteStreamHandlers.forEach((cb) => cb(remoteStream));
        });

        call.on('close', () => {
          this.remoteStream = null;
          this.remoteStreamHandlers.forEach((cb) => cb(null));
          this.callEndedHandlers.forEach((cb) => cb());
        });

        call.on('error', (err) => {
          console.warn('[P2PSync] Media call error:', err);
          this.remoteStream = null;
          this.remoteStreamHandlers.forEach((cb) => cb(null));
        });
      });

      this.peer.on('error', (err: any) => {
        // Silently handle expected non-fatal peer availability checks
        if (err?.type === 'peer-unavailable') {
          return;
        }

        console.warn(`[P2PSync] Peer error on ${desiredId}:`, err?.type || err);

        // If ID is already taken, append fallback slot
        if (err?.type === 'unavailable-id') {
          if (slotIndex < 3) {
            console.log(`[P2PSync] Slot taken, attempting slot ${slotIndex + 1}...`);
            this.initPeer(slotIndex + 1);
          }
        }
      });
    } catch (e) {
      console.error('[P2PSync] Failed to construct PeerJS:', e);
    }
  }

  private startHeartbeatAndDiscovery() {
    if (this.reconnectInterval) clearInterval(this.reconnectInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);

    // Actively connect to partner if not connected
    this.reconnectInterval = setInterval(() => {
      if (!this.isConnectedToPartner && this.peer && !this.peer.destroyed) {
        this.attemptConnectToPartner();
      }
    }, 3500);

    // Ping partner every 5s when connected
    this.pingInterval = setInterval(() => {
      if (this.isConnectedToPartner && this.currentUser) {
        this.send({
          type: 'presence:hello',
          user: this.currentUser,
          peerId: this.myPeerId,
        });
      }
    }, 5000);

    // Initial connection attempt
    setTimeout(() => this.attemptConnectToPartner(), 1000);
  }

  public attemptConnectToPartner() {
    if (!this.peer || this.peer.destroyed || !this.peer.id) return;
    if (this.activeConnection && this.activeConnection.open) return;

    const cleanRoom = this.roomCode.replace(/[^a-z0-9]/g, '');
    const isPrimaryRole =
      this.currentUser?.name?.toLowerCase().includes('cooper') ||
      this.currentUser?.name?.toLowerCase().includes('dale') ||
      this.currentUser?.email?.includes('nsbrooks23');

    // Connect directly to target partner peer
    const targetId = isPrimaryRole ? `tp-${cleanRoom}-partner` : `tp-${cleanRoom}-cooper`;

    try {
      const conn = this.peer.connect(targetId, {
        reliable: true,
      });

      conn.on('open', () => {
        this.partnerPeerId = targetId;
        this.setupConnection(conn);
      });

      conn.on('error', () => {
        // Partner may not be online yet
      });
    } catch {
      // Peer may not be online yet
    }
  }

  private setupConnection(conn: DataConnection) {
    if (this.activeConnection && this.activeConnection.open && this.activeConnection.peer === conn.peer) {
      return;
    }

    this.activeConnection = conn;
    this.partnerPeerId = conn.peer;

    conn.on('open', () => {
      this.isConnectedToPartner = true;
      console.log(`[P2PSync] Direct WebRTC Data Channel OPEN with ${conn.peer}`);
      this.notifyConnectionState(true);

      // Exchange presence
      if (this.currentUser) {
        this.send({
          type: 'presence:hello',
          user: this.currentUser,
          peerId: this.myPeerId,
        });
      }

      // Request state from partner to reconcile
      this.send({
        type: 'state:request',
        fromPeerId: this.myPeerId,
      });
    });

    conn.on('data', (raw: any) => {
      try {
        const msg = raw as P2PMessage;
        this.handleIncomingMessage(msg);
      } catch (e) {
        console.error('[P2PSync] Error processing incoming P2P message:', e);
      }
    });

    conn.on('close', () => {
      console.log(`[P2PSync] Data channel with ${conn.peer} closed.`);
      if (this.activeConnection === conn) {
        this.activeConnection = null;
        this.isConnectedToPartner = false;
        this.partnerUser = null;
        this.notifyConnectionState(false);
      }
    });

    conn.on('error', (err) => {
      console.warn('[P2PSync] Data channel error:', err);
    });
  }

  private handleIncomingMessage(msg: P2PMessage) {
    if (msg.type === 'presence:hello') {
      this.partnerUser = msg.user;
      this.partnerPeerId = msg.peerId;
      // Send ack back so both know each other
      if (this.currentUser) {
        this.send({
          type: 'presence:ack',
          user: this.currentUser,
          peerId: this.myPeerId,
        });
      }
    } else if (msg.type === 'presence:ack') {
      this.partnerUser = msg.user;
      this.partnerPeerId = msg.peerId;
    }

    // Forward to registered message handlers
    this.messageHandlers.forEach((handler) => {
      try {
        handler(msg);
      } catch (err) {
        console.error('[P2PSync] Handler error:', err);
      }
    });
  }

  public send(msg: P2PMessage) {
    if (this.activeConnection && this.activeConnection.open) {
      try {
        this.activeConnection.send(msg);
      } catch (err) {
        console.warn('[P2PSync] Send error over data channel:', err);
      }
    }
  }

  // --- Audio / Video Calling Methods ---
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

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  public getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  public callPartner(localStream: MediaStream) {
    if (!this.peer || !this.partnerPeerId) {
      throw new Error('Partner not yet discovered on room channel.');
    }
    this.localStream = localStream;

    // Send ring notification
    this.send({
      type: 'call:ring',
      callerName: this.currentUser?.name || 'Partner',
      callerPeerId: this.myPeerId,
      isVideo: localStream.getVideoTracks().length > 0,
    });

    const call = this.peer.call(this.partnerPeerId, localStream);
    this.activeMediaCall = call;

    call.on('stream', (remoteStream) => {
      this.remoteStream = remoteStream;
      this.remoteStreamHandlers.forEach((cb) => cb(remoteStream));
    });

    call.on('close', () => {
      this.remoteStream = null;
      this.remoteStreamHandlers.forEach((cb) => cb(null));
      this.callEndedHandlers.forEach((cb) => cb());
    });

    call.on('error', (err) => {
      console.warn('[P2PSync] Call error:', err);
      this.remoteStream = null;
      this.remoteStreamHandlers.forEach((cb) => cb(null));
    });
  }

  public answerCall(localStream: MediaStream) {
    if (!this.activeMediaCall) {
      console.warn('[P2PSync] No active incoming call to answer.');
      return;
    }
    this.localStream = localStream;
    this.activeMediaCall.answer(localStream);
  }

  public endCall() {
    if (this.activeMediaCall) {
      try {
        this.activeMediaCall.close();
      } catch {}
      this.activeMediaCall = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.remoteStream = null;
    this.remoteStreamHandlers.forEach((cb) => cb(null));
    this.callEndedHandlers.forEach((cb) => cb());
    this.send({
      type: 'call:cancel',
      callerPeerId: this.myPeerId,
    });
  }

  // --- Subscriptions ---
  public onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  public onConnectionStateChange(listener: (connected: boolean) => void): () => void {
    this.connectionListeners.add(listener);
    listener(this.isConnectedToPartner);
    return () => this.connectionListeners.delete(listener);
  }

  public onIncomingCall(handler: (callerName: string, isVideo: boolean) => void): () => void {
    this.incomingCallHandlers.add(handler);
    return () => this.incomingCallHandlers.delete(handler);
  }

  public onRemoteStream(handler: (stream: MediaStream | null) => void): () => void {
    this.remoteStreamHandlers.add(handler);
    handler(this.remoteStream);
    return () => this.remoteStreamHandlers.delete(handler);
  }

  public onCallEnded(handler: () => void): () => void {
    this.callEndedHandlers.add(handler);
    return () => this.callEndedHandlers.delete(handler);
  }

  private notifyConnectionState(connected: boolean) {
    this.connectionListeners.forEach((cb) => {
      try {
        cb(connected);
      } catch {}
    });
  }

  public restart() {
    if (this.currentUser) {
      this.start(this.currentUser, this.currentBoardId);
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectInterval) clearInterval(this.reconnectInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.activeConnection) {
      try {
        this.activeConnection.close();
      } catch {}
      this.activeConnection = null;
    }
    if (this.activeMediaCall) {
      try {
        this.activeMediaCall.close();
      } catch {}
      this.activeMediaCall = null;
    }
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch {}
      this.peer = null;
    }
  }
}

export const p2pSync = P2PSyncService.getInstance();

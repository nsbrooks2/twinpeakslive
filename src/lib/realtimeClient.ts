import { PresenceUser, CharacterCard, StringConnection, StickyNote, EpisodeBoard } from '../types';

export interface WatchPartySyncPayload {
  isOpen?: boolean;
  episodeNumber: number;
  isPlaying: boolean;
  currentTime: number;
  updatedBy: string;
  updatedAt?: number;
}

export interface WatchPartyChatPayload {
  boardId: string;
  message: {
    id: string;
    sender_name: string;
    sender_email: string;
    timestamp: string;
    video_time: number;
    text: string;
    is_theory_clue?: boolean;
  };
}

type EventListener = (payload: any) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private reconnectTimeout: any = null;
  private isConnected = false;
  private currentUser: { email: string; name: string; role?: string } | null = null;
  private currentBoardId: string = 'episode-1-pilot';
  private currentIsWatching: boolean = false;
  public onlineUsers: PresenceUser[] = [];
  public screeningState: WatchPartySyncPayload = {
    isOpen: false,
    episodeNumber: 1,
    isPlaying: false,
    currentTime: 0,
    updatedBy: 'System',
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const url = `${protocol}//${window.location.host}/ws`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.emit('connection', { status: 'connected' });

        // Re-announce presence if user is signed in
        if (this.currentUser) {
          this.joinPresence(this.currentUser, this.currentBoardId, this.currentIsWatching);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'server:init') {
            if (msg.payload?.onlineUsers) {
              this.onlineUsers = msg.payload.onlineUsers;
              this.emit('presence:update', { onlineUsers: this.onlineUsers });
            }
            if (msg.payload?.screeningState) {
              this.screeningState = msg.payload.screeningState;
              this.emit('watch:playback', this.screeningState);
            }
          } else if (msg.type === 'presence:update') {
            this.onlineUsers = msg.payload.onlineUsers || [];
            this.emit('presence:update', { onlineUsers: this.onlineUsers });
          } else if (msg.type === 'watch:playback') {
            this.screeningState = msg.payload;
            this.emit('watch:playback', msg.payload);
          } else if (msg.type === 'watch:chat') {
            this.emit('watch:chat', msg.payload);
          } else if (msg.type === 'watch:countdown') {
            this.emit('watch:countdown', msg.payload);
          } else if (msg.type === 'watch:ready') {
            this.emit('watch:ready', msg.payload);
          } else if (msg.type === 'webrtc:signal') {
            this.emit('webrtc:signal', msg.payload);
          } else {
            // Forward other events like card:move, string:upsert, etc.
            this.emit(msg.type, msg.payload);
          }
        } catch (err) {
          console.error('[RealtimeClient] Error parsing incoming message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.emit('connection', { status: 'disconnected' });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[RealtimeClient] WebSocket error:', err);
        this.ws?.close();
      };
    } catch (e) {
      console.error('[RealtimeClient] Failed to establish connection:', e);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 2000);
  }

  public getConnected(): boolean {
    return this.isConnected;
  }

  public on(event: string, callback: EventListener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private emit(event: string, payload: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach((cb) => {
        try {
          cb(payload);
        } catch (e) {
          console.error(`[RealtimeClient] Listener error for ${event}:`, e);
        }
      });
    }
  }

  public send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  // Presence
  public joinPresence(user: { email: string; name: string; role?: string }, boardId: string, isWatching = false) {
    this.currentUser = user;
    this.currentBoardId = boardId;
    this.currentIsWatching = isWatching;
    this.send('presence:join', { user, boardId, isWatching });
  }

  public updateActivity(boardId: string, isWatching: boolean) {
    this.currentBoardId = boardId;
    this.currentIsWatching = isWatching;
    this.send('presence:activity', { activeBoardId: boardId, isWatching });
  }

  // Clue Board Realtime Sync
  public broadcastCardMove(id: string, x: number, y: number, boardId: string) {
    this.send('card:move', { id, x, y, boardId });
  }

  public broadcastCardUpsert(card: CharacterCard) {
    this.send('card:upsert', { card });
  }

  public broadcastCardDelete(id: string) {
    this.send('card:delete', { id });
  }

  public broadcastStringUpsert(string: StringConnection) {
    this.send('string:upsert', { string });
  }

  public broadcastStringDelete(id: string) {
    this.send('string:delete', { id });
  }

  public broadcastStickyMove(id: string, x: number, y: number) {
    this.send('sticky:move', { id, x, y });
  }

  public broadcastStickyUpsert(sticky: StickyNote) {
    this.send('sticky:upsert', { sticky });
  }

  public broadcastStickyDelete(id: string) {
    this.send('sticky:delete', { id });
  }

  public broadcastBoardCreate(board: EpisodeBoard) {
    this.send('board:create', { board });
  }

  // Screening Room Playback Sync
  public broadcastPlayback(payload: WatchPartySyncPayload) {
    this.screeningState = payload;
    this.send('watch:playback', payload);
  }

  public sendChatMessage(boardId: string, message: any) {
    this.send('watch:chat', { boardId, message });
  }

  public broadcastCountdown(payload: { seconds: number; initiatedBy: string }) {
    this.send('watch:countdown', payload);
  }

  public broadcastReady(payload: { user: string; isReady: boolean }) {
    this.send('watch:ready', payload);
  }

  // WebRTC Signaling
  public sendWebRTCSignal(signal: any) {
    this.send('webrtc:signal', signal);
  }
}

export const realtimeClient = new RealtimeClient();

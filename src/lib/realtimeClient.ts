import { PresenceUser, CharacterCard, StringConnection, StickyNote, EpisodeBoard } from '../types';
import { p2pSync } from './p2pSync';
import { cloudRelay } from './cloudRelay';

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

export type ConnectionMode = 'websocket' | 'http_relay' | 'connecting' | 'offline';

type EventListener = (payload: any) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<EventListener>> = new Map();
  private reconnectTimeout: any = null;
  private heartbeatInterval: any = null;
  private pollInterval: any = null;
  private isConnected = false;
  private connectionMode: ConnectionMode = 'connecting';
  private currentUser: { email: string; name: string; role?: string; avatar?: string } | null = null;
  private currentBoardId: string = 'episode-1-pilot';
  private currentIsWatching: boolean = false;
  private lastPolledTimestamp: number = Date.now();
  private processedEventIds: Set<string> = new Set();
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
      this.init();
    }
  }

  // Detect and return configured server URL
  public getServerBaseUrl(): string {
    if (typeof window === 'undefined') return '';
    const stored = localStorage.getItem('tp_custom_server_url');
    if (stored && stored.trim()) {
      return stored.trim().replace(/\/+$/, '');
    }
    return '';
  }

  public setCustomServerUrl(url: string | null) {
    if (typeof window === 'undefined') return;
    if (!url || !url.trim()) {
      localStorage.removeItem('tp_custom_server_url');
    } else {
      localStorage.setItem('tp_custom_server_url', url.trim());
    }
    // Reconnect with new target
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connect();
    this.sendHeartbeat();
  }

  public isDevUrl(): boolean {
    if (typeof window === 'undefined') return false;
    return window.location.hostname.includes('ais-dev-');
  }

  public getSharedServerUrl(): string {
    if (typeof window === 'undefined') return '';
    const host = window.location.host;
    if (host.includes('ais-dev-')) {
      // In AI Studio, the shareable preview environment begins with ais-pre-
      return `${window.location.protocol}//${host.replace('ais-dev-', 'ais-pre-')}`;
    }
    return `${window.location.protocol}//${host}`;
  }

  private init() {
    this.connect();
    this.startHeartbeatAndPolling();

    // 1. Universal Cloud Relay (Guaranteed delivery across ais-dev, ais-pre, containers & networks)
    cloudRelay.onConnectionChange((connected) => {
      if (connected) {
        this.connectionMode = 'websocket';
        this.emit('connection', { status: 'connected_relay', mode: 'cloud_relay' });
      }
    });

    cloudRelay.onMessage((msg) => {
      if (msg.type === 'presence:update') {
        const remoteList = msg.payload.onlineUsers || [];
        // Merge remote cloud relay users into our local list
        const merged = [...this.onlineUsers];
        remoteList.forEach((ru: PresenceUser) => {
          const idx = merged.findIndex((u) => u.email.toLowerCase() === ru.email.toLowerCase());
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], ...ru };
          } else {
            merged.push(ru);
          }
        });
        this.onlineUsers = merged;
        this.emit('presence:update', { onlineUsers: this.onlineUsers });
      } else if (msg.type === 'state:request') {
        this.emit('p2p:request_state', msg.payload);
      } else if (msg.type === 'state:snapshot') {
        this.emit('p2p:apply_snapshot', msg.payload?.snapshot || msg.payload);
      } else {
        // Forward card moves, stickies, strings, watch playback, etc.
        this.emit(msg.type, msg.payload);
      }
    });

    // 2. Direct Cross-Region Peer-to-Peer Relay (PeerJS WebRTC DataChannel)
    p2pSync.onConnectionStateChange((connected) => {
      if (connected) {
        this.connectionMode = 'websocket';
        this.emit('connection', { status: 'connected_p2p', mode: 'p2p' });
      }
    });

    p2pSync.onMessage((msg) => {
      if (msg.type === 'presence:hello' || msg.type === 'presence:ack') {
        const partner = msg.user;
        const exists = this.onlineUsers.some((u) => u.email.toLowerCase() === partner.email.toLowerCase());
        if (!exists) {
          this.onlineUsers = [...this.onlineUsers, partner];
          this.emit('presence:update', { onlineUsers: this.onlineUsers });
        }
      } else if (msg.type === 'state:request') {
        this.emit('p2p:request_state', msg);
      } else if (msg.type === 'state:snapshot') {
        this.emit('p2p:apply_snapshot', msg.snapshot);
      } else {
        // Forward any board, watch party, or signaling events
        this.emit(msg.type, (msg as any).payload);
      }
    });

    // 3. Mobile & Cross-Device Lifecycle Resynchronization (iOS Safari / Android background tab wake-up)
    if (typeof window !== 'undefined') {
      const handleMobileWakeUp = () => {
        console.log('[RealtimeClient] Device wake-up detected (phone/tablet/tab). Resynchronizing state...');
        if (this.currentUser) {
          this.joinPresence(this.currentUser, this.currentBoardId, this.currentIsWatching);
        }
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          this.connect();
        }
        this.sendHeartbeat();
        this.pollSyncEvents();
        cloudRelay.requestStateSnapshot();
      };

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          handleMobileWakeUp();
        }
      });

      window.addEventListener('focus', handleMobileWakeUp);
      window.addEventListener('online', handleMobileWakeUp);
      window.addEventListener('pageshow', handleMobileWakeUp);
    }
  }

  public getConnectionMode(): ConnectionMode {
    return this.connectionMode;
  }

  public connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const customBase = this.getServerBaseUrl();
      let wsUrl: string;

      if (customBase) {
        const parsed = new URL(customBase);
        const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${parsed.host}/ws`;
      } else {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsUrl = `${protocol}//${window.location.host}/ws`;
      }

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.connectionMode = 'websocket';
        this.emit('connection', { status: 'connected', mode: 'websocket' });

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
          } else if (msg.type === 'server:ping') {
            if (msg.onlineUsers) {
              this.onlineUsers = msg.onlineUsers;
              this.emit('presence:update', { onlineUsers: this.onlineUsers });
            }
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
            // Forward board events: card:move, string:upsert, sticky:move, etc.
            this.emit(msg.type, msg.payload);
          }
        } catch (err) {
          console.error('[RealtimeClient] Error parsing incoming WS message:', err);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        // Fallback gracefully to HTTP relay mode
        this.connectionMode = 'http_relay';
        this.emit('connection', { status: 'fallback_http', mode: 'http_relay' });
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('[RealtimeClient] WebSocket error, fallback to HTTP relay:', err);
        this.connectionMode = 'http_relay';
        this.ws?.close();
      };
    } catch (e) {
      console.error('[RealtimeClient] Failed to establish WS connection:', e);
      this.connectionMode = 'http_relay';
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, 4000);
  }

  // Starts the HTTP heartbeat and sync event polling engine
  private startHeartbeatAndPolling() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.pollInterval) clearInterval(this.pollInterval);

    // Heartbeat every 4 seconds to register online status and get current roster
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 4000);

    // Poll for remote changes every 1.5 seconds if WS is disconnected, or every 4s as safety-net reconciliation
    this.pollInterval = setInterval(() => {
      this.pollSyncEvents();
    }, this.isConnected ? 4000 : 1500);

    // Initial heartbeat
    setTimeout(() => {
      this.sendHeartbeat();
      this.pollSyncEvents();
    }, 800);
  }

  // Sends HTTP heartbeat to register presence even without WebSocket
  public async sendHeartbeat() {
    if (!this.currentUser) return;
    try {
      const customBase = this.getServerBaseUrl();
      const url = `${customBase}/api/presence/heartbeat`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: this.currentUser,
          boardId: this.currentBoardId,
          isWatching: this.currentIsWatching,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.onlineUsers) {
          this.onlineUsers = data.onlineUsers;
          this.emit('presence:update', { onlineUsers: this.onlineUsers });
        }
        if (data.screeningState && !this.screeningState.isOpen && data.screeningState.isOpen) {
          this.screeningState = data.screeningState;
          this.emit('watch:playback', this.screeningState);
        }
        if (!this.isConnected) {
          this.connectionMode = 'http_relay';
          this.emit('connection', { status: 'connected_http', mode: 'http_relay' });
        }
      }
    } catch (err) {
      // Network glitch or offline
    }
  }

  // Polls server for any new sync events created by other connected detectives
  public async pollSyncEvents() {
    try {
      const customBase = this.getServerBaseUrl();
      const senderId = this.currentUser?.email || '';
      const url = `${customBase}/api/sync/poll?since=${this.lastPolledTimestamp}&boardId=${encodeURIComponent(
        this.currentBoardId
      )}&senderId=${encodeURIComponent(senderId)}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.events && Array.isArray(data.events)) {
          for (const ev of data.events) {
            if (this.processedEventIds.has(ev.id)) continue;
            this.processedEventIds.add(ev.id);
            if (this.processedEventIds.size > 500) {
              const first = Array.from(this.processedEventIds)[0];
              this.processedEventIds.delete(first);
            }

            // Emit the event so the board or screening room updates
            this.emit(ev.type, ev.payload);
          }
        }

        if (data.serverTime) {
          // Adjust last polled timestamp (with a 100ms overlap to avoid edge race conditions)
          this.lastPolledTimestamp = Math.max(this.lastPolledTimestamp, data.serverTime - 100);
        }

        if (data.onlineUsers) {
          this.onlineUsers = data.onlineUsers;
          this.emit('presence:update', { onlineUsers: this.onlineUsers });
        }

        if (data.screeningState) {
          this.screeningState = data.screeningState;
        }
      }
    } catch {
      // Ignore polling transient errors
    }
  }

  public getConnected(): boolean {
    return this.isConnected || this.connectionMode === 'http_relay';
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

  // Triple-Engine Send: Dispatches via Cloud Relay, P2P DataChannel, WebSocket, and HTTP
  public send(type: string, payload: any) {
    // 1. Universal Cloud Relay (Crosses ais-dev, ais-pre, containers & states guaranteed)
    cloudRelay.publish(type, payload);

    // 2. Direct Peer-to-Peer DataChannel (WebRTC)
    p2pSync.send({ type: type as any, payload });

    // 3. Try WebSocket if OPEN
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type, payload }));
      } catch (err) {
        console.warn('[RealtimeClient] Failed to send via WS:', err);
      }
    }

    // 4. Also dispatch via HTTP relay endpoint to guarantee sync if partner is in another instance or mobile
    const customBase = this.getServerBaseUrl();
    const url = `${customBase}/api/sync/broadcast`;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        payload,
        senderId: this.currentUser?.email,
        boardId: this.currentBoardId,
      }),
    }).catch(() => {
      // Silently ignore HTTP relay failure if network offline
    });
  }

  // Presence
  public joinPresence(user: { email: string; name: string; role?: string; avatar?: string }, boardId: string, isWatching = false) {
    this.currentUser = user;
    this.currentBoardId = boardId;
    this.currentIsWatching = isWatching;

    const presencePayload = {
      user_id: (user as any).id || (user as any).user_id || user.email,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      activeBoardId: boardId,
      isWatching,
      last_seen: new Date().toISOString(),
    };

    cloudRelay.start(presencePayload, boardId, isWatching);
    p2pSync.start(presencePayload, boardId);

    this.send('presence:join', { user, boardId, isWatching });
    this.sendHeartbeat();
  }

  public updateActivity(boardId: string, isWatching: boolean) {
    this.currentBoardId = boardId;
    this.currentIsWatching = isWatching;
    if (this.currentUser) {
      cloudRelay.start(
        {
          user_id: (this.currentUser as any).id || (this.currentUser as any).user_id || this.currentUser.email,
          name: this.currentUser.name,
          email: this.currentUser.email,
          role: this.currentUser.role,
          avatar: this.currentUser.avatar,
          activeBoardId: boardId,
          isWatching,
          last_seen: new Date().toISOString(),
        },
        boardId,
        isWatching
      );
    }
    this.send('presence:activity', { activeBoardId: boardId, isWatching });
    this.sendHeartbeat();
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


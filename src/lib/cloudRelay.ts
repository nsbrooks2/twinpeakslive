import mqtt, { MqttClient } from 'mqtt';
import { CharacterCard, EpisodeBoard, PresenceUser, StickyNote, StringConnection } from '../types';

export interface CloudRelayMessage {
  senderId: string;
  senderName: string;
  roomCode: string;
  type: string;
  payload: any;
  timestamp: number;
}

type MessageCallback = (msg: CloudRelayMessage) => void;
type ConnectionCallback = (connected: boolean, broker: string) => void;

class CloudRelayService {
  private static instance: CloudRelayService | null = null;
  private client: MqttClient | null = null;
  private isConnected: boolean = false;
  private currentBroker: string = 'emqx';
  private clientId: string = '';
  public roomCode: string = 'twinpeaks-sheriff-case';

  private currentUser: PresenceUser | null = null;
  private currentBoardId: string = 'episode-1-pilot';
  private currentIsWatching: boolean = false;

  private messageListeners: Set<MessageCallback> = new Set();
  private connectionListeners: Set<ConnectionCallback> = new Set();
  private remotePresenceMap: Map<string, { user: PresenceUser; lastSeen: number }> = new Map();

  private heartbeatTimer: any = null;
  private cleanupTimer: any = null;

  private constructor() {
    this.clientId = `tp-agent-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.roomCode = this.getInitialRoomCode();
  }

  public static getInstance(): CloudRelayService {
    if (!CloudRelayService.instance) {
      CloudRelayService.instance = new CloudRelayService();
    }
    return CloudRelayService.instance;
  }

  private getInitialRoomCode(): string {
    if (typeof window === 'undefined') return 'twinpeaks-sheriff-case';
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('room');
    if (fromUrl && fromUrl.trim()) {
      const clean = fromUrl.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
      localStorage.setItem('tp_room_code', clean);
      return clean;
    }
    const fromStore = localStorage.getItem('tp_room_code');
    if (fromStore && fromStore.trim()) {
      return fromStore.trim().toLowerCase();
    }
    return 'twinpeaks-sheriff-case';
  }

  public getTopic(): string {
    const clean = (this.roomCode || 'twinpeaks-sheriff-case').replace(/[^a-z0-9-_]/g, '-');
    return `twinpeaks/casesync/v2/${clean}`;
  }

  public start(user: PresenceUser, boardId: string, isWatching: boolean = false) {
    this.currentUser = user;
    this.currentBoardId = boardId;
    this.currentIsWatching = isWatching;

    if (!this.client || !this.isConnected) {
      this.connectBroker();
    } else {
      this.sendPresenceAnnounce();
    }
  }

  public setRoomCode(code: string) {
    if (!code || !code.trim()) return;
    const clean = code.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    if (clean === this.roomCode) return;

    // Unsubscribe from old topic
    if (this.client && this.isConnected) {
      try {
        this.client.unsubscribe(this.getTopic());
      } catch {}
    }

    this.roomCode = clean;
    if (typeof window !== 'undefined') {
      localStorage.setItem('tp_room_code', clean);
      const url = new URL(window.location.href);
      url.searchParams.set('room', clean);
      window.history.replaceState({}, '', url.toString());
    }

    // Subscribe to new topic and announce
    if (this.client && this.isConnected) {
      this.client.subscribe(this.getTopic(), { qos: 0 }, (err) => {
        if (!err) {
          this.sendPresenceAnnounce();
          this.requestStateSnapshot();
        }
      });
    }
  }

  private connectBroker() {
    if (typeof window === 'undefined') return;

    // Try EMQX first, fallback to HiveMQ if needed
    const brokerUrl =
      this.currentBroker === 'emqx'
        ? 'wss://broker.emqx.io:8084/mqtt'
        : 'wss://broker.hivemq.com:8884/mqtt';

    console.log(`[CloudRelay] Connecting to Universal Cloud Relay (${this.currentBroker})...`);

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId: this.clientId,
        clean: true,
        connectTimeout: 7000,
        reconnectPeriod: 4000,
      });

      this.client.on('connect', () => {
        console.log(`[CloudRelay] Connected to Universal Cloud Relay (${this.currentBroker})`);
        this.isConnected = true;
        this.notifyConnectionListeners(true, this.currentBroker);

        const topic = this.getTopic();
        this.client?.subscribe(topic, { qos: 0 }, (err) => {
          if (!err) {
            console.log(`[CloudRelay] Subscribed to case channel: ${topic}`);
            this.sendPresenceAnnounce();
            // Request state snapshot from any partner already on board
            setTimeout(() => this.requestStateSnapshot(), 500);
          } else {
            console.warn('[CloudRelay] Subscription error:', err);
          }
        });

        this.startTimers();
      });

      this.client.on('message', (topic, rawMessage) => {
        try {
          const str = rawMessage.toString();
          const parsed: CloudRelayMessage = JSON.parse(str);

          // Ignore our own echo messages
          if (parsed.senderId === this.clientId) {
            return;
          }

          this.handleIncomingMessage(parsed);
        } catch (err) {
          console.warn('[CloudRelay] Failed to parse message:', err);
        }
      });

      this.client.on('error', (err) => {
        console.warn(`[CloudRelay] Broker error on ${this.currentBroker}:`, err);
        // Toggle broker on failure
        if (!this.isConnected) {
          this.currentBroker = this.currentBroker === 'emqx' ? 'hivemq' : 'emqx';
        }
      });

      this.client.on('offline', () => {
        this.isConnected = false;
        this.notifyConnectionListeners(false, this.currentBroker);
      });

      this.client.on('reconnect', () => {
        console.log('[CloudRelay] Attempting reconnect...');
      });
    } catch (e) {
      console.error('[CloudRelay] Connection failed:', e);
    }
  }

  private handleIncomingMessage(msg: CloudRelayMessage) {
    // Handle presence messages
    if (msg.type === 'presence:announce' || msg.type === 'presence:heartbeat') {
      const user = msg.payload?.user;
      if (user) {
        this.remotePresenceMap.set(msg.senderId, {
          user,
          lastSeen: Date.now(),
        });
        this.notifyPresenceUpdate();

        // If it was an announce, reply with our own presence so they know we exist immediately
        if (msg.type === 'presence:announce') {
          this.sendDirectPresenceHeartbeat();
        }
      }
    } else if (msg.type === 'presence:bye') {
      this.remotePresenceMap.delete(msg.senderId);
      this.notifyPresenceUpdate();
    }

    // Deliver to all message listeners (BoardCanvas, realtimeClient, WatchParty)
    this.messageListeners.forEach((cb) => cb(msg));
  }

  public publish(type: string, payload: any) {
    if (!this.client || !this.isConnected) {
      // If not yet connected, attempt connection
      if (!this.client) this.connectBroker();
      return;
    }

    const msg: CloudRelayMessage = {
      senderId: this.clientId,
      senderName: this.currentUser?.name || 'Investigator',
      roomCode: this.roomCode,
      type,
      payload,
      timestamp: Date.now(),
    };

    try {
      this.client.publish(this.getTopic(), JSON.stringify(msg), { qos: 0 });
    } catch (e) {
      console.warn('[CloudRelay] Publish failed:', e);
    }
  }

  public sendPresenceAnnounce() {
    if (!this.currentUser) return;
    this.publish('presence:announce', {
      user: {
        ...this.currentUser,
        activeBoardId: this.currentBoardId,
        isWatching: this.currentIsWatching,
        last_seen: new Date().toISOString(),
      },
    });
  }

  private sendDirectPresenceHeartbeat() {
    if (!this.currentUser) return;
    this.publish('presence:heartbeat', {
      user: {
        ...this.currentUser,
        activeBoardId: this.currentBoardId,
        isWatching: this.currentIsWatching,
        last_seen: new Date().toISOString(),
      },
    });
  }

  public requestStateSnapshot() {
    this.publish('state:request', {
      boardId: this.currentBoardId,
      requesterId: this.clientId,
    });
  }

  public sendStateSnapshot(snapshot: {
    boardId: string;
    cards: CharacterCard[];
    stickies: StickyNote[];
    strings: StringConnection[];
    boards?: EpisodeBoard[];
  }) {
    this.publish('state:snapshot', { snapshot });
  }

  private startTimers() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);

    // Heartbeat every 8s
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.currentUser) {
        this.sendDirectPresenceHeartbeat();
      }
    }, 8000);

    // Clean up stale users (> 25s without heartbeat)
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [id, entry] of this.remotePresenceMap.entries()) {
        if (now - entry.lastSeen > 25000) {
          this.remotePresenceMap.delete(id);
          changed = true;
        }
      }
      if (changed) {
        this.notifyPresenceUpdate();
      }
    }, 5000);
  }

  private notifyPresenceUpdate() {
    const list = Array.from(this.remotePresenceMap.values()).map((e) => e.user);
    // Broadcast through message listeners as a synthesized presence update
    const synMsg: CloudRelayMessage = {
      senderId: 'system',
      senderName: 'System',
      roomCode: this.roomCode,
      type: 'presence:update',
      payload: { onlineUsers: list },
      timestamp: Date.now(),
    };
    this.messageListeners.forEach((cb) => cb(synMsg));
  }

  public getRemoteOnlineUsers(): PresenceUser[] {
    return Array.from(this.remotePresenceMap.values()).map((e) => e.user);
  }

  public onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => {
      this.messageListeners.delete(callback);
    };
  }

  public onConnectionChange(callback: ConnectionCallback): () => void {
    this.connectionListeners.add(callback);
    callback(this.isConnected, this.currentBroker);
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  private notifyConnectionListeners(connected: boolean, broker: string) {
    this.connectionListeners.forEach((cb) => cb(connected, broker));
  }

  public getConnectedStatus(): boolean {
    return this.isConnected;
  }
}

export const cloudRelay = CloudRelayService.getInstance();

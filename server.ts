import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import mqtt, { MqttClient } from 'mqtt';
import { createClient } from '@supabase/supabase-js';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// In Vercel serverless functions, the writable directory is /tmp
const IS_VERCEL = process.env.VERCEL === '1' || !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? path.join('/tmp', 'data') : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create DATA_DIR:', e);
  }
}

// Ensure episodes cache directory exists
const EPISODES_CACHE_DIR = path.join('/tmp', 'episodes');
if (!fs.existsSync(EPISODES_CACHE_DIR)) {
  try {
    fs.mkdirSync(EPISODES_CACHE_DIR, { recursive: true });
  } catch (e) {
    console.warn('Could not create EPISODES_CACHE_DIR:', e);
  }
}

interface DatabaseSchema {
  users: any[];
  boards: any[];
  cards: any[];
  strings: any[];
  stickies: any[];
  chat: Record<string, any[]>;
  supabaseConfig?: { url: string; key: string };
  screeningState: {
    isOpen: boolean;
    episodeNumber: number;
    isPlaying: boolean;
    currentTime: number;
    updatedBy: string;
    updatedAt: number;
  };
}

const DEFAULT_DB: DatabaseSchema = {
  users: [
    {
      id: 'user-cooper',
      name: 'Agent Dale Cooper',
      email: 'nsbrooks23@gmail.com',
      avatar: '☕',
      badge_title: 'Special Agent, FBI',
      department: 'Federal Bureau of Investigation',
      favorite_quote: 'Damn fine cup of coffee!',
      created_at: new Date('2026-09-01T08:00:00Z').toISOString(),
      last_login: new Date().toISOString(),
    },
    {
      id: 'user-girlfriend',
      name: 'Special Investigator',
      email: 'partner@twinpeaks.private',
      avatar: '🌲',
      badge_title: 'Lead Detective / Co-Investigator',
      department: 'Twin Peaks Sheriff Dispatch',
      favorite_quote: 'The owls are not what they seem.',
      created_at: new Date('2026-09-01T08:00:00Z').toISOString(),
      last_login: new Date().toISOString(),
    },
    {
      id: 'user-truman',
      name: 'Sheriff Harry S. Truman',
      email: 'truman@twinpeaks.gov',
      avatar: '⭐',
      badge_title: 'Sheriff',
      department: 'Twin Peaks Sheriff Department',
      favorite_quote: 'There’s a sort of evil out there.',
      created_at: new Date('2026-09-01T08:00:00Z').toISOString(),
      last_login: new Date().toISOString(),
    }
  ],
  boards: [
    {
      id: 'episode-1-pilot',
      title: 'Episode 1: Pilot (Northwest Passage)',
      episode_number: 1,
      created_at: new Date('2026-09-01T08:00:00Z').toISOString(),
      updated_at: new Date('2026-09-01T10:30:00Z').toISOString(),
      description: 'The discovery of Laura Palmer wrapped in plastic by the Packard Sawmill shore. Official investigation opened.'
    },
    {
      id: 'episode-2-traces-to-nowhere',
      title: 'Episode 2: Traces to Nowhere',
      episode_number: 2,
      created_at: new Date('2026-09-02T08:00:00Z').toISOString(),
      updated_at: new Date('2026-09-02T10:00:00Z').toISOString(),
      description: 'Agent Cooper questions James Hurley; visits to the Horne department store and Leo Johnson’s house. The Log Lady shares cryptic warnings.'
    },
    {
      id: 'episode-3-zen-skill',
      title: 'Episode 3: Zen, or the Skill to Catch a Killer',
      episode_number: 3,
      created_at: new Date('2026-09-03T08:00:00Z').toISOString(),
      updated_at: new Date('2026-09-03T10:00:00Z').toISOString(),
      description: 'Agent Cooper demonstrates his deductive Tibetan rock-throwing technique in the woods. Cooper later experiences his iconic dream in the Red Room with the Man from Another Place and Laura Palmer.'
    },
    {
      id: 'episode-4-rest-in-pain',
      title: 'Episode 4: Rest in Pain',
      episode_number: 4,
      created_at: new Date('2026-09-04T08:00:00Z').toISOString(),
      updated_at: new Date('2026-09-04T10:00:00Z').toISOString(),
      description: 'The town gathers for Laura Palmer’s heartbreaking funeral, erupting into family heartbreak and chaos at the cemetery. Cooper learns of the Bookhouse Boys secret society.'
    },
    {
      id: 'episode-5-the-one-armed-man',
      title: 'Episode 5: The One-Armed Man',
      episode_number: 5,
      created_at: new Date('2026-09-05T08:00:00Z').toISOString(),
      updated_at: new Date('2026-09-05T10:00:00Z').toISOString(),
      description: 'Cooper and Truman question the One-Armed Man (Phillip Gerard) and track veterinarian records for a mysterious bird. Audrey Horne goes undercover at One Eyed Jacks.'
    },
    {
      id: 'episode-6-coopers-dreams',
      title: "Episode 6: Cooper's Dreams",
      episode_number: 6,
      created_at: new Date('2026-09-06T08:00:00Z').toISOString(),
      updated_at: new Date('2026-09-06T10:00:00Z').toISOString(),
      description: "Agent Cooper, Sheriff Truman, Deputy Hawk, and Doc Hayward search Jacques Renault's cabin in the woods, finding Waldo the Mynah bird. Audrey Horne begins her undercover work at One Eyed Jacks."
    },
    {
      id: 'episode-7-realization-time',
      title: 'Episode 7: Realization Time',
      episode_number: 7,
      created_at: new Date('2026-09-07T08:00:00Z').toISOString(),
      updated_at: new Date('2026-09-07T10:00:00Z').toISOString(),
      description: "Audrey applies for a job at One Eyed Jacks; Cooper and Truman trace bloodstains to Jacques Renault's cabin; Maddy, James, and Donna search for Laura's hidden cassette tapes."
    },
    {
      id: 'episode-8-the-last-evening',
      title: 'Episode 8: The Last Evening',
      episode_number: 8,
      created_at: new Date('2026-09-08T08:00:00Z').toISOString(),
      updated_at: new Date('2026-09-08T10:00:00Z').toISOString(),
      description: 'Season 1 Finale: Cooper lures Jacques Renault into a trap at the Great Northern; Leo sets fire to the sawmill; Audrey is trapped at One Eyed Jacks; a mystery shooter targets Cooper in his hotel room.'
    }
  ],
  cards: [],
  strings: [],
  stickies: [],
  chat: {
    'episode-1-pilot': [
      {
        id: 'init-1',
        sender_name: 'Special Agent Cooper',
        sender_email: 'cooper@twinpeaks.fbi',
        timestamp: new Date().toISOString(),
        video_time: 0,
        text: 'Diane, 11:30 AM, February 24th. Entering the town of Twin Peaks. 5 miles south of the Canadian border.',
        is_theory_clue: true,
      },
      {
        id: 'init-2',
        sender_name: 'Sheriff Truman',
        sender_email: 'truman@twinpeaks.gov',
        timestamp: new Date().toISOString(),
        video_time: 145,
        text: 'Pete Martell found a body by the logs near Blue Pine Lodge. Wrapped in plastic.',
        is_theory_clue: true,
      }
    ]
  },
  supabaseConfig: {
    url: 'https://dkqkzmjdvjvxehsoeomd.supabase.co',
    key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcWt6bWpkdmp2eGVoc29lb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMDA0OTgsImV4cCI6MjEwNDU3NjQ5OH0.uPQtL9fCRricdInsFOoEUYfem91nFfi9R5N5WGQotaY',
  },
  screeningState: {
    isOpen: false,
    episodeNumber: 1,
    isPlaying: false,
    currentTime: 0,
    updatedBy: 'System',
    updatedAt: Date.now()
  }
};

let db: DatabaseSchema = { ...DEFAULT_DB };

// Load database from disk if available
function loadDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(data);
      db = {
        users: parsed.users || DEFAULT_DB.users,
        boards: parsed.boards || DEFAULT_DB.boards,
        cards: parsed.cards || DEFAULT_DB.cards,
        strings: parsed.strings || DEFAULT_DB.strings,
        stickies: parsed.stickies || DEFAULT_DB.stickies,
        chat: parsed.chat || DEFAULT_DB.chat,
        supabaseConfig: parsed.supabaseConfig || DEFAULT_DB.supabaseConfig,
        screeningState: parsed.screeningState || DEFAULT_DB.screeningState,
      };

      // Ensure default accounts exist if missing
      for (const defUser of DEFAULT_DB.users) {
        if (!db.users.some((u) => u.email.toLowerCase() === defUser.email.toLowerCase())) {
          db.users.push(defUser);
        }
      }

      // Ensure all canonical episode boards exist
      for (const defBoard of DEFAULT_DB.boards) {
        if (!db.boards.some((b) => b.id === defBoard.id || b.episode_number === defBoard.episode_number)) {
          db.boards.push(defBoard);
        }
      }
      saveDatabaseImmediate();
      console.log(`[Database] Loaded ${db.boards.length} boards, ${db.cards.length} cards, ${db.strings.length} strings, ${db.stickies.length} stickies from disk.`);
    } else {
      saveDatabaseImmediate();
      console.log('[Database] Initialized new database file.');
    }
  } catch (err) {
    console.error('[Database] Failed to read db.json, using defaults:', err);
  }
}

// Debounced save
let saveTimer: NodeJS.Timeout | null = null;
function scheduleSaveDatabase() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDatabaseImmediate();
  }, 300);
}

function saveDatabaseImmediate() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('[Database] Error saving to disk:', err);
  }
}

loadDatabase();

// Middleware
app.use(express.json());

// CORS headers for cross-origin multi-user & mobile access
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Track online users
interface ConnectedUser {
  ws: WebSocket;
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  activeBoardId: string;
  isWatching: boolean;
  connectedAt: number;
  lastPing: number;
}

const connectedUsers = new Map<WebSocket, ConnectedUser>();

// Persistent presence registry across WebSockets and HTTP polling
interface RegisteredUserSession {
  user_id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  activeBoardId: string;
  isWatching: boolean;
  lastSeen: number;
  connectedAt: number;
  connectionType: 'websocket' | 'http_relay';
}

const activeUserRegistry = new Map<string, RegisteredUserSession>();

// Sync Event Buffer for HTTP Polling clients & cross-state synchronization
interface SyncEvent {
  id: string;
  type: string;
  boardId?: string;
  payload: any;
  timestamp: number;
  senderId?: string;
}

const recentSyncEvents: SyncEvent[] = [];

function recordSyncEvent(type: string, payload: any, senderId?: string, boardId?: string): SyncEvent {
  const event: SyncEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    payload,
    timestamp: Date.now(),
    senderId,
    boardId: boardId || payload?.boardId,
  };
  recentSyncEvents.push(event);
  if (recentSyncEvents.length > 250) {
    recentSyncEvents.shift();
  }
  return event;
}

// Server Mesh Synchronization (Bi-directional MQTT mesh across all Cloud Run instances & previews)
const SERVER_INSTANCE_ID = `tp-srv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
const SERVER_MESH_TOPIC = 'twinpeaks/servermesh/v2/sheriff-global';
let mqttServerClient: MqttClient | null = null;
let isServerMeshConnected = false;

function initServerMesh() {
  try {
    mqttServerClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clientId: SERVER_INSTANCE_ID,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 3000,
    });

    mqttServerClient.on('connect', () => {
      console.log(`[ServerMesh] Connected to global server synchronization mesh (${SERVER_INSTANCE_ID})`);
      isServerMeshConnected = true;
      mqttServerClient?.subscribe(SERVER_MESH_TOPIC, { qos: 0 });

      // Request state from any peer server
      setTimeout(() => {
        publishServerMesh('server_mesh:state_request', { requesterId: SERVER_INSTANCE_ID });
      }, 500);
    });

    mqttServerClient.on('message', (topic, rawMessage) => {
      try {
        const str = rawMessage.toString();
        const msg = JSON.parse(str);
        if (msg.serverInstanceId === SERVER_INSTANCE_ID) {
          return; // Ignore own echo
        }
        handleRemoteServerMessage(msg);
      } catch (e) {
        console.warn('[ServerMesh] Message parse error:', e);
      }
    });

    mqttServerClient.on('error', (err) => {
      console.warn('[ServerMesh] MQTT error:', err?.message || err);
    });
  } catch (err) {
    console.error('[ServerMesh] Connection error:', err);
  }
}

function publishServerMesh(type: string, payload: any, originSenderId?: string) {
  if (!mqttServerClient || !isServerMeshConnected) return;
  try {
    mqttServerClient.publish(
      SERVER_MESH_TOPIC,
      JSON.stringify({
        serverInstanceId: SERVER_INSTANCE_ID,
        type,
        payload,
        originSenderId,
        timestamp: Date.now(),
      }),
      { qos: 0 }
    );
  } catch (e) {
    console.warn('[ServerMesh] Publish error:', e);
  }
}

function handleRemoteServerMessage(msg: { type: string; payload: any; originSenderId?: string }) {
  const { type, payload } = msg;

  if (type === 'server_mesh:state_request') {
    publishServerMesh('server_mesh:state_snapshot', {
      cards: db.cards,
      stickies: db.stickies,
      strings: db.strings,
      boards: db.boards,
      screeningState: db.screeningState,
      users: getPublicOnlineUsers(),
    });
    return;
  }

  if (type === 'server_mesh:state_snapshot') {
    const snap = payload;
    if (snap) {
      if (Array.isArray(snap.cards) && snap.cards.length > 0 && db.cards.length === 0) db.cards = snap.cards;
      if (Array.isArray(snap.stickies) && snap.stickies.length > 0 && db.stickies.length === 0) db.stickies = snap.stickies;
      if (Array.isArray(snap.strings) && snap.strings.length > 0 && db.strings.length === 0) db.strings = snap.strings;
      if (Array.isArray(snap.boards) && snap.boards.length > 0) db.boards = snap.boards;
      if (snap.screeningState) db.screeningState = { ...db.screeningState, ...snap.screeningState };
      scheduleSaveDatabase();

      if (Array.isArray(snap.users)) {
        snap.users.forEach((u: any) => {
          if (u.email) {
            activeUserRegistry.set(u.email.toLowerCase().trim(), {
              user_id: u.user_id || u.email,
              name: u.name,
              email: u.email,
              role: u.role || 'Investigator',
              avatar: u.avatar || '🌲',
              activeBoardId: u.activeBoardId || 'episode-1-pilot',
              isWatching: !!u.isWatching,
              lastSeen: Date.now(),
              connectedAt: u.connectedAt || Date.now(),
              connectionType: 'http_relay',
            });
          }
        });
      }
      broadcastToAll({
        type: 'presence:update',
        payload: { onlineUsers: getPublicOnlineUsers() },
      }, false);
    }
    return;
  }

  // Remote presence updates
  if (type === 'presence:heartbeat' || type === 'presence:join' || type === 'presence:activity') {
    const user = payload?.user || payload;
    if (user && user.email) {
      const emailKey = user.email.toLowerCase().trim();
      activeUserRegistry.set(emailKey, {
        user_id: user.user_id || user.id || user.email,
        name: user.name || 'Investigator',
        email: user.email,
        role: user.role || 'Investigator',
        avatar: user.avatar || '🌲',
        activeBoardId: payload.boardId || payload.activeBoardId || 'episode-1-pilot',
        isWatching: !!payload.isWatching,
        lastSeen: Date.now(),
        connectedAt: Date.now(),
        connectionType: 'http_relay',
      });
      broadcastToAll({
        type: 'presence:update',
        payload: { onlineUsers: getPublicOnlineUsers() },
      }, false);
    }
    return;
  }

  // Process board synchronization mutations
  switch (type) {
    case 'card:move': {
      const { id, x, y } = payload || {};
      const card = db.cards.find((c) => c.id === id);
      if (card) {
        card.x = x;
        card.y = y;
        card.updated_at = new Date().toISOString();
        scheduleSaveDatabase();
      }
      break;
    }
    case 'card:upsert': {
      const { card } = payload || {};
      if (card) {
        const idx = db.cards.findIndex((c) => c.id === card.id);
        if (idx >= 0) db.cards[idx] = card;
        else db.cards.push(card);
        scheduleSaveDatabase();
      }
      break;
    }
    case 'card:delete': {
      const { id } = payload || {};
      db.cards = db.cards.filter((c) => c.id !== id);
      db.strings = db.strings.filter((s) => s.source_id !== id && s.target_id !== id);
      scheduleSaveDatabase();
      break;
    }
    case 'string:upsert': {
      const { string } = payload || {};
      if (string) {
        const idx = db.strings.findIndex((s) => s.id === string.id);
        if (idx >= 0) db.strings[idx] = string;
        else db.strings.push(string);
        scheduleSaveDatabase();
      }
      break;
    }
    case 'string:delete': {
      const { id } = payload || {};
      db.strings = db.strings.filter((s) => s.id !== id);
      scheduleSaveDatabase();
      break;
    }
    case 'sticky:move': {
      const { id, x, y } = payload || {};
      const sticky = db.stickies.find((s) => s.id === id);
      if (sticky) {
        sticky.x = x;
        sticky.y = y;
        scheduleSaveDatabase();
      }
      break;
    }
    case 'sticky:upsert': {
      const { sticky } = payload || {};
      if (sticky) {
        const idx = db.stickies.findIndex((s) => s.id === sticky.id);
        if (idx >= 0) db.stickies[idx] = sticky;
        else db.stickies.push(sticky);
        scheduleSaveDatabase();
      }
      break;
    }
    case 'sticky:delete': {
      const { id } = payload || {};
      db.stickies = db.stickies.filter((s) => s.id !== id);
      scheduleSaveDatabase();
      break;
    }
    case 'board:create': {
      const { board } = payload || {};
      if (board && !db.boards.some((b) => b.id === board.id)) {
        db.boards.push(board);
        scheduleSaveDatabase();
      }
      break;
    }
    case 'watch:playback': {
      db.screeningState = {
        ...db.screeningState,
        ...payload,
        updatedAt: Date.now(),
      };
      break;
    }
    case 'watch:chat': {
      const { boardId: bId, message } = payload || {};
      if (bId && message) {
        if (!db.chat) db.chat = {};
        if (!db.chat[bId]) db.chat[bId] = [];
        db.chat[bId].push(message);
        scheduleSaveDatabase();
      }
      break;
    }
  }

  recordSyncEvent(type, payload, msg.originSenderId);

  // Broadcast to all local WebSocket clients connected to this container
  broadcastToAll({
    type,
    payload,
  }, false);
}

initServerMesh();

// WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('error', (err) => {
  console.warn('[WebSocketServer Error caught]', err);
});

function getPublicOnlineUsers() {
  const now = Date.now();
  // Clean up stale users (> 30s without ping/heartbeat)
  for (const [key, user] of activeUserRegistry.entries()) {
    if (now - user.lastSeen > 30000) {
      activeUserRegistry.delete(key);
    }
  }

  // Synchronize active WebSocket connections into the registry
  connectedUsers.forEach((u) => {
    activeUserRegistry.set(u.email.toLowerCase().trim(), {
      user_id: u.id,
      name: u.name,
      email: u.email,
      role: u.role || 'Investigator',
      avatar: u.avatar || '🌲',
      activeBoardId: u.activeBoardId || 'episode-1-pilot',
      isWatching: u.isWatching,
      lastSeen: u.lastPing,
      connectedAt: u.connectedAt,
      connectionType: 'websocket',
    });
  });

  return Array.from(activeUserRegistry.values()).map((u) => ({
    user_id: u.user_id,
    name: u.name,
    email: u.email,
    role: u.role || 'Investigator',
    avatar: u.avatar || '🌲',
    activeBoardId: u.activeBoardId || 'episode-1-pilot',
    isWatching: u.isWatching,
    connectedAt: u.connectedAt,
    connectionType: u.connectionType,
    lastSeen: u.lastSeen,
  }));
}

function broadcastToAll(msg: any, publishMesh: boolean = true) {
  const raw = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  });
  if (publishMesh && msg?.type && !msg.type.startsWith('server:')) {
    publishServerMesh(msg.type, msg.payload);
  }
}

function broadcastToOthers(senderWs: WebSocket, msg: any) {
  const raw = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client !== senderWs && client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  });
  if (msg?.type && !msg.type.startsWith('server:')) {
    publishServerMesh(msg.type, msg.payload, connectedUsers.get(senderWs)?.id);
  }
}

wss.on('connection', (ws: WebSocket) => {
  // Send initial state & presence
  ws.send(
    JSON.stringify({
      type: 'server:init',
      payload: {
        onlineUsers: getPublicOnlineUsers(),
        screeningState: db.screeningState,
      },
    })
  );

  ws.on('message', (raw: string) => {
    try {
      const msg = JSON.parse(raw.toString());
      switch (msg.type) {
        case 'presence:join': {
          const user = msg.payload?.user;
          const boardId = msg.payload?.boardId || 'episode-1-pilot';
          if (user) {
            connectedUsers.set(ws, {
              ws,
              id: user.user_id || user.email,
              name: user.name,
              email: user.email,
              role: user.role,
              activeBoardId: boardId,
              isWatching: !!msg.payload?.isWatching,
              connectedAt: Date.now(),
              lastPing: Date.now(),
            });
            // Broadcast updated presence to all
            broadcastToAll({
              type: 'presence:update',
              payload: { onlineUsers: getPublicOnlineUsers() },
            });
          }
          break;
        }

        case 'presence:activity': {
          const u = connectedUsers.get(ws);
          if (u) {
            if (msg.payload?.activeBoardId) u.activeBoardId = msg.payload.activeBoardId;
            if (msg.payload?.isWatching !== undefined) u.isWatching = msg.payload.isWatching;
            u.lastPing = Date.now();
            broadcastToAll({
              type: 'presence:update',
              payload: { onlineUsers: getPublicOnlineUsers() },
            });
          }
          break;
        }

        // Board synchronization events
        case 'card:move': {
          const { id, x, y, boardId } = msg.payload;
          const card = db.cards.find((c) => c.id === id);
          if (card) {
            card.x = x;
            card.y = y;
            card.updated_at = new Date().toISOString();
            saveDatabaseImmediate();
          }
          recordSyncEvent('card:move', msg.payload, connectedUsers.get(ws)?.id, boardId);
          broadcastToOthers(ws, msg);
          break;
        }

        case 'card:upsert': {
          const { card } = msg.payload;
          if (card) {
            const idx = db.cards.findIndex((c) => c.id === card.id);
            if (idx >= 0) {
              db.cards[idx] = card;
            } else {
              db.cards.push(card);
            }
            saveDatabaseImmediate();
          }
          recordSyncEvent('card:upsert', msg.payload, connectedUsers.get(ws)?.id, card?.board_id);
          broadcastToOthers(ws, msg);
          break;
        }

        case 'card:delete': {
          const { id } = msg.payload;
          db.cards = db.cards.filter((c) => c.id !== id);
          db.strings = db.strings.filter((s) => s.source_id !== id && s.target_id !== id);
          saveDatabaseImmediate();
          recordSyncEvent('card:delete', msg.payload, connectedUsers.get(ws)?.id);
          broadcastToOthers(ws, msg);
          break;
        }

        case 'string:upsert': {
          const { string } = msg.payload;
          if (string) {
            const idx = db.strings.findIndex((s) => s.id === string.id);
            if (idx >= 0) {
              db.strings[idx] = string;
            } else {
              db.strings.push(string);
            }
            saveDatabaseImmediate();
          }
          recordSyncEvent('string:upsert', msg.payload, connectedUsers.get(ws)?.id, string?.board_id);
          broadcastToOthers(ws, msg);
          break;
        }

        case 'string:delete': {
          const { id } = msg.payload;
          db.strings = db.strings.filter((s) => s.id !== id);
          saveDatabaseImmediate();
          recordSyncEvent('string:delete', msg.payload, connectedUsers.get(ws)?.id);
          broadcastToOthers(ws, msg);
          break;
        }

        case 'sticky:move': {
          const { id, x, y } = msg.payload;
          const sticky = db.stickies.find((s) => s.id === id);
          if (sticky) {
            sticky.x = x;
            sticky.y = y;
            saveDatabaseImmediate();
          }
          recordSyncEvent('sticky:move', msg.payload, connectedUsers.get(ws)?.id);
          broadcastToOthers(ws, msg);
          break;
        }

        case 'sticky:upsert': {
          const { sticky } = msg.payload;
          if (sticky) {
            const idx = db.stickies.findIndex((s) => s.id === sticky.id);
            if (idx >= 0) {
              db.stickies[idx] = sticky;
            } else {
              db.stickies.push(sticky);
            }
            saveDatabaseImmediate();
          }
          recordSyncEvent('sticky:upsert', msg.payload, connectedUsers.get(ws)?.id, sticky?.board_id);
          broadcastToOthers(ws, msg);
          break;
        }

        case 'sticky:delete': {
          const { id } = msg.payload;
          db.stickies = db.stickies.filter((s) => s.id !== id);
          saveDatabaseImmediate();
          recordSyncEvent('sticky:delete', msg.payload, connectedUsers.get(ws)?.id);
          broadcastToOthers(ws, msg);
          break;
        }

        case 'board:create': {
          const { board } = msg.payload;
          if (board) {
            if (!db.boards.some((b) => b.id === board.id)) {
              db.boards.push(board);
              scheduleSaveDatabase();
            }
          }
          recordSyncEvent('board:create', msg.payload, connectedUsers.get(ws)?.id, board?.id);
          broadcastToOthers(ws, msg);
          break;
        }

        // Screening Room Playback Sync
        case 'watch:playback': {
          const syncData = msg.payload;
          db.screeningState = {
            isOpen: syncData.isOpen ?? true,
            episodeNumber: syncData.episodeNumber || db.screeningState.episodeNumber || 1,
            isPlaying: !!syncData.isPlaying,
            currentTime: syncData.currentTime || 0,
            updatedBy: syncData.updatedBy || 'Partner',
            updatedAt: Date.now(),
          };
          scheduleSaveDatabase();
          recordSyncEvent('watch:playback', msg.payload, connectedUsers.get(ws)?.id);
          // Broadcast to everyone (including sender confirmation if needed)
          broadcastToAll({
            type: 'watch:playback',
            payload: db.screeningState,
          });
          break;
        }

        case 'watch:chat': {
          const { boardId, message } = msg.payload;
          if (!db.chat[boardId]) {
            db.chat[boardId] = [];
          }
          db.chat[boardId].push(message);
          scheduleSaveDatabase();
          recordSyncEvent('watch:chat', msg.payload, connectedUsers.get(ws)?.id, boardId);
          broadcastToAll({
            type: 'watch:chat',
            payload: { boardId, message },
          });
          break;
        }

        case 'watch:countdown': {
          recordSyncEvent('watch:countdown', msg.payload, connectedUsers.get(ws)?.id);
          // Synchronized 3-2-1 play countdown
          broadcastToAll({
            type: 'watch:countdown',
            payload: msg.payload,
          });
          break;
        }

        case 'watch:ready': {
          recordSyncEvent('watch:ready', msg.payload, connectedUsers.get(ws)?.id);
          // Ready check signal between detectives
          broadcastToAll({
            type: 'watch:ready',
            payload: msg.payload,
          });
          break;
        }

        // WebRTC Signaling Relay
        case 'webrtc:signal': {
          recordSyncEvent('webrtc:signal', msg.payload, connectedUsers.get(ws)?.id);
          broadcastToOthers(ws, {
            type: 'webrtc:signal',
            payload: msg.payload,
          });
          break;
        }
      }
    } catch (err) {
      console.error('[WebSocket] Message parse error:', err);
    }
  });

  ws.on('close', () => {
    const u = connectedUsers.get(ws);
    if (u) {
      const emailKey = u.email.toLowerCase().trim();
      activeUserRegistry.delete(emailKey);
    }
    connectedUsers.delete(ws);
    broadcastToAll({
      type: 'presence:update',
      payload: { onlineUsers: getPublicOnlineUsers() },
    });
  });
});

// Periodic heartbeat & cleanup
setInterval(() => {
  broadcastToAll({
    type: 'server:ping',
    timestamp: Date.now(),
    onlineUsers: getPublicOnlineUsers(),
  });
}, 10000);

// --- REST API ENDPOINTS ---

// Server Diagnostics Endpoint
app.get('/api/server-info', (req, res) => {
  const onlineUsers = getPublicOnlineUsers();
  res.json({
    status: 'ok',
    serverTime: Date.now(),
    isVercel: IS_VERCEL,
    onlineCount: onlineUsers.length,
    onlineUsers,
    screeningState: db.screeningState,
    boardCount: db.boards.length,
  });
});

// Real-Time Presence HTTP Heartbeat (For Remote Multi-User & Mobile / Cellular Connections)
app.post('/api/presence/heartbeat', (req, res) => {
  const { user, boardId, isWatching } = req.body || {};
  if (!user || !user.email) {
    return res.status(400).json({ error: 'User details required' });
  }

  const emailKey = (user.email || '').toLowerCase().trim();
  const existing = activeUserRegistry.get(emailKey);
  const now = Date.now();

  activeUserRegistry.set(emailKey, {
    user_id: user.user_id || user.id || user.email,
    name: user.name || 'Investigator',
    email: user.email,
    role: user.role || 'Investigator',
    avatar: user.avatar || '🌲',
    activeBoardId: boardId || existing?.activeBoardId || 'episode-1-pilot',
    isWatching: isWatching !== undefined ? !!isWatching : !!existing?.isWatching,
    lastSeen: now,
    connectedAt: existing?.connectedAt || now,
    connectionType: 'http_relay',
  });

  const onlineUsers = getPublicOnlineUsers();

  publishServerMesh('presence:heartbeat', { user, boardId, isWatching });

  // Also broadcast presence to any open WebSocket connections
  broadcastToAll({
    type: 'presence:update',
    payload: { onlineUsers },
  }, false);

  res.json({
    ok: true,
    serverTime: now,
    onlineUsers,
    screeningState: db.screeningState,
  });
});

// Get Online Presence Roster
app.get('/api/presence', (req, res) => {
  res.json({
    onlineUsers: getPublicOnlineUsers(),
    serverTime: Date.now(),
  });
});

// HTTP Sync Event Broadcast (Guarantees synchronization when WebSocket is unavailable or on mobile)
app.post('/api/sync/broadcast', (req, res) => {
  const { type, payload, senderId, boardId } = req.body || {};
  if (!type) {
    return res.status(400).json({ error: 'Event type required' });
  }

  // Process data in database schema
  switch (type) {
    case 'card:move': {
      const { id, x, y } = payload || {};
      const card = db.cards.find((c) => c.id === id);
      if (card) {
        card.x = x;
        card.y = y;
        card.updated_at = new Date().toISOString();
        saveDatabaseImmediate();
      }
      break;
    }
    case 'card:upsert': {
      const { card } = payload || {};
      if (card) {
        const idx = db.cards.findIndex((c) => c.id === card.id);
        if (idx >= 0) {
          db.cards[idx] = card;
        } else {
          db.cards.push(card);
        }
        saveDatabaseImmediate();
      }
      break;
    }
    case 'card:delete': {
      const { id } = payload || {};
      db.cards = db.cards.filter((c) => c.id !== id);
      db.strings = db.strings.filter((s) => s.source_id !== id && s.target_id !== id);
      saveDatabaseImmediate();
      break;
    }
    case 'string:upsert': {
      const { string } = payload || {};
      if (string) {
        const idx = db.strings.findIndex((s) => s.id === string.id);
        if (idx >= 0) {
          db.strings[idx] = string;
        } else {
          db.strings.push(string);
        }
        saveDatabaseImmediate();
      }
      break;
    }
    case 'string:delete': {
      const { id } = payload || {};
      db.strings = db.strings.filter((s) => s.id !== id);
      saveDatabaseImmediate();
      break;
    }
    case 'sticky:move': {
      const { id, x, y } = payload || {};
      const sticky = db.stickies.find((s) => s.id === id);
      if (sticky) {
        sticky.x = x;
        sticky.y = y;
        saveDatabaseImmediate();
      }
      break;
    }
    case 'sticky:upsert': {
      const { sticky } = payload || {};
      if (sticky) {
        const idx = db.stickies.findIndex((s) => s.id === sticky.id);
        if (idx >= 0) {
          db.stickies[idx] = sticky;
        } else {
          db.stickies.push(sticky);
        }
        saveDatabaseImmediate();
      }
      break;
    }
    case 'sticky:delete': {
      const { id } = payload || {};
      db.stickies = db.stickies.filter((s) => s.id !== id);
      saveDatabaseImmediate();
      break;
    }
    case 'board:create': {
      const { board } = payload || {};
      if (board && !db.boards.some((b) => b.id === board.id)) {
        db.boards.push(board);
        saveDatabaseImmediate();
      }
      break;
    }
    case 'watch:playback': {
      db.screeningState = {
        ...db.screeningState,
        ...payload,
        updatedAt: Date.now(),
      };
      break;
    }
    case 'watch:chat': {
      const { boardId: bId, message } = payload || {};
      if (bId && message) {
        if (!db.chat) db.chat = {};
        if (!db.chat[bId]) db.chat[bId] = [];
        db.chat[bId].push(message);
        scheduleSaveDatabase();
      }
      break;
    }
  }

  // Record in recent events buffer
  const event = recordSyncEvent(type, payload, senderId, boardId);

  // Broadcast to all open WebSocket connections
  broadcastToAll({
    type,
    payload,
  });

  res.json({ ok: true, eventId: event.id, timestamp: event.timestamp });
});

// HTTP Sync Event Polling (Returns events that occurred since given timestamp)
app.get('/api/sync/poll', (req, res) => {
  const since = parseInt(req.query.since as string, 10) || 0;
  const boardId = (req.query.boardId as string) || '';
  const senderId = (req.query.senderId as string) || '';

  const events = recentSyncEvents.filter((ev) => {
    if (ev.timestamp <= since) return false;
    if (senderId && ev.senderId === senderId) return false;
    if (boardId && ev.boardId && ev.boardId !== boardId && !ev.type.startsWith('watch:') && ev.type !== 'webrtc:signal') return false;
    return true;
  });

  res.json({
    events,
    onlineUsers: getPublicOnlineUsers(),
    screeningState: db.screeningState,
    serverTime: Date.now(),
  });
});

// User Accounts Endpoints
// List all saved accounts (without passwords)
app.get('/api/users', (req, res) => {
  const safeUsers = (db.users || []).map(({ password, ...u }) => u);
  res.json(safeUsers);
});

// Register or save an account
app.post('/api/users/register', (req, res) => {
  const { name, email, password, avatar, badge_title, department, favorite_quote } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'Name and email are required to register an account' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  let user = (db.users || []).find((u) => u.email.toLowerCase() === normalizedEmail);

  if (user) {
    // Update existing user profile
    user.name = name.trim();
    if (password) user.password = password;
    if (avatar) user.avatar = avatar;
    if (badge_title) user.badge_title = badge_title;
    if (department) user.department = department;
    if (favorite_quote) user.favorite_quote = favorite_quote;
    user.last_login = new Date().toISOString();
  } else {
    // Create new user account
    user = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim(),
      email: normalizedEmail,
      password: password || '',
      avatar: avatar || '🌲',
      badge_title: badge_title || 'Investigator',
      department: department || 'Sheriff Dispatch',
      favorite_quote: favorite_quote || 'The owls are not what they seem.',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    };
    if (!db.users) db.users = [];
    db.users.push(user);
  }

  scheduleSaveDatabase();
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Login / Authenticate account
app.post('/api/users/login', (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const user = (db.users || []).find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return res.status(404).json({ error: 'No account found with this email badge.' });
  }

  // If user has a set password, verify it
  if (user.password && password && user.password !== password) {
    return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
  }

  user.last_login = new Date().toISOString();
  scheduleSaveDatabase();

  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Update profile
app.put('/api/users/:email', (req, res) => {
  const normalizedEmail = decodeURIComponent(req.params.email).toLowerCase().trim();
  const { name, avatar, badge_title, department, favorite_quote, password } = req.body;

  const user = (db.users || []).find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return res.status(404).json({ error: 'User account not found' });
  }

  if (name) user.name = name.trim();
  if (avatar) user.avatar = avatar;
  if (badge_title) user.badge_title = badge_title;
  if (department) user.department = department;
  if (favorite_quote) user.favorite_quote = favorite_quote;
  if (password) user.password = password;
  user.last_login = new Date().toISOString();

  scheduleSaveDatabase();
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

// Server health and status
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    onlineCount: connectedUsers.size,
    onlineUsers: getPublicOnlineUsers(),
    screeningState: db.screeningState,
  });
});

// Presence roster
app.get('/api/presence', (req, res) => {
  res.json(getPublicOnlineUsers());
});

// Load all boards
app.get('/api/boards', (req, res) => {
  res.json(db.boards);
});

// Load full board details (cards, strings, stickies)
app.get('/api/boards/:id', (req, res) => {
  const { id } = req.params;
  const board = db.boards.find((b) => b.id === id);
  const boardCards = db.cards.filter((c) => c.board_id === id);
  const boardStrings = db.strings.filter((s) => s.board_id === id);
  const boardStickies = db.stickies.filter((s) => s.board_id === id);
  res.json({
    board: board || null,
    cards: boardCards,
    strings: boardStrings,
    stickies: boardStickies,
  });
});

// Create or duplicate board
app.post('/api/boards', (req, res) => {
  const { board, duplicateFromBoardId } = req.body;
  if (!board || !board.id) {
    return res.status(400).json({ error: 'Missing board specification' });
  }

  if (!db.boards.some((b) => b.id === board.id)) {
    db.boards.push(board);
  }

  // Duplicate items if requested
  if (duplicateFromBoardId) {
    const sourceCards = db.cards.filter((c) => c.board_id === duplicateFromBoardId);
    const idMap = new Map<string, string>();

    sourceCards.forEach((c) => {
      const newCardId = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      idMap.set(c.id, newCardId);
      db.cards.push({
        ...c,
        id: newCardId,
        board_id: board.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    const sourceStrings = db.strings.filter((s) => s.board_id === duplicateFromBoardId);
    sourceStrings.forEach((s) => {
      const newSource = idMap.get(s.source_id);
      const newTarget = idMap.get(s.target_id);
      if (newSource && newTarget) {
        db.strings.push({
          ...s,
          id: `str-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          board_id: board.id,
          source_id: newSource,
          target_id: newTarget,
          created_at: new Date().toISOString(),
        });
      }
    });

    const sourceStickies = db.stickies.filter((s) => s.board_id === duplicateFromBoardId);
    sourceStickies.forEach((st) => {
      db.stickies.push({
        ...st,
        id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        board_id: board.id,
        created_at: new Date().toISOString(),
      });
    });
  }

  scheduleSaveDatabase();
  res.json({ success: true, board });
});

// Import / Carry-over items from one board into another board (Merge or Replace)
app.post('/api/boards/:targetBoardId/import', (req, res) => {
  const { targetBoardId } = req.params;
  const { sourceBoardId, mode = 'merge', items = ['cards', 'strings', 'stickies'] } = req.body;

  if (!sourceBoardId || !targetBoardId) {
    return res.status(400).json({ error: 'Missing source or target board ID' });
  }

  const targetBoard = db.boards.find((b) => b.id === targetBoardId);
  if (!targetBoard) {
    return res.status(404).json({ error: 'Target board not found' });
  }

  // If replace mode, clear existing items from target board first
  if (mode === 'replace') {
    if (items.includes('cards')) {
      db.cards = db.cards.filter((c) => c.board_id !== targetBoardId);
    }
    if (items.includes('strings')) {
      db.strings = db.strings.filter((s) => s.board_id !== targetBoardId);
    }
    if (items.includes('stickies')) {
      db.stickies = db.stickies.filter((st) => st.board_id !== targetBoardId);
    }
  }

  const idMap = new Map<string, string>();
  let importedCardsCount = 0;
  let importedStringsCount = 0;
  let importedStickiesCount = 0;

  // Import cards
  if (items.includes('cards')) {
    const sourceCards = db.cards.filter((c) => c.board_id === sourceBoardId);
    sourceCards.forEach((c) => {
      // Check if card with identical name already exists in target board in merge mode
      const existingInTarget = db.cards.find(
        (tc) => tc.board_id === targetBoardId && tc.name.toLowerCase().trim() === c.name.toLowerCase().trim()
      );

      if (existingInTarget && mode === 'merge') {
        // Map old id to existing target id for string connections
        idMap.set(c.id, existingInTarget.id);
      } else {
        const newCardId = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        idMap.set(c.id, newCardId);
        db.cards.push({
          ...c,
          id: newCardId,
          board_id: targetBoardId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        importedCardsCount++;
      }
    });
  }

  // Import strings
  if (items.includes('strings')) {
    const sourceStrings = db.strings.filter((s) => s.board_id === sourceBoardId);
    sourceStrings.forEach((s) => {
      const newSource = idMap.get(s.source_id);
      const newTarget = idMap.get(s.target_id);
      if (newSource && newTarget) {
        // Prevent exact duplicate string in target
        const alreadyConnected = db.strings.some(
          (str) =>
            str.board_id === targetBoardId &&
            ((str.source_id === newSource && str.target_id === newTarget) ||
              (str.source_id === newTarget && str.target_id === newSource))
        );
        if (!alreadyConnected) {
          db.strings.push({
            ...s,
            id: `str-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            board_id: targetBoardId,
            source_id: newSource,
            target_id: newTarget,
            created_at: new Date().toISOString(),
          });
          importedStringsCount++;
        }
      }
    });
  }

  // Import stickies
  if (items.includes('stickies')) {
    const sourceStickies = db.stickies.filter((s) => s.board_id === sourceBoardId);
    sourceStickies.forEach((st) => {
      db.stickies.push({
        ...st,
        id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        board_id: targetBoardId,
        created_at: new Date().toISOString(),
      });
      importedStickiesCount++;
    });
  }

  targetBoard.updated_at = new Date().toISOString();
  scheduleSaveDatabase();

  res.json({
    success: true,
    imported: {
      cards: importedCardsCount,
      strings: importedStringsCount,
      stickies: importedStickiesCount,
    },
    targetBoard,
  });
});

function getServerSupabase() {
  const config = db.supabaseConfig || {
    url: process.env.VITE_SUPABASE_URL || 'https://dkqkzmjdvjvxehsoeomd.supabase.co',
    key: process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcWt6bWpkdmp2eGVoc29lb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMDA0OTgsImV4cCI6MjEwNDU3NjQ5OH0.uPQtL9fCRricdInsFOoEUYfem91nFfi9R5N5WGQotaY',
  };
  if (!config.url || !config.key) return null;
  try {
    return createClient(config.url, config.key);
  } catch (err) {
    console.warn('[Server Supabase Init Error]', err);
    return null;
  }
}

async function serverSyncBoard(boardId: string) {
  const supabase = getServerSupabase();
  if (!supabase) return;
  try {
    const boardObj = db.boards.find(b => b.id === boardId) || {
      id: boardId,
      title: 'Investigation Board',
      episode_number: 1,
      description: '',
    };
    await supabase.from('boards').upsert([{
      id: boardObj.id,
      title: boardObj.title,
      episode_number: boardObj.episode_number || 1,
      description: boardObj.description || '',
    }], { onConflict: 'id' });
  } catch (err) {
    console.warn('[Supabase Server Sync] board error:', err);
  }
}

async function serverSyncCard(card: any) {
  const supabase = getServerSupabase();
  if (!supabase || !card) return;
  try {
    const boardId = card.board_id || 'episode-1-pilot';
    await serverSyncBoard(boardId);
    const clean = {
      id: card.id,
      board_id: boardId,
      name: card.name || 'Suspect',
      role: card.role || '',
      notes: card.notes || '',
      status: card.status || 'Unknown',
      x: typeof card.x === 'number' ? card.x : 100,
      y: typeof card.y === 'number' ? card.y : 100,
      z_index: typeof card.z_index === 'number' ? card.z_index : 1,
    };
    const { error } = await supabase.from('character_cards').upsert([clean], { onConflict: 'id' });
    if (error) console.warn('[Supabase Server Sync] card error:', error.message);
  } catch (err) {
    console.warn('[Supabase Server Sync] card exception:', err);
  }
}

async function serverDeleteCard(cardId: string) {
  const supabase = getServerSupabase();
  if (!supabase) return;
  try {
    await supabase.from('character_cards').delete().eq('id', cardId);
    await supabase.from('string_connections').delete().or(`source_id.eq.${cardId},target_id.eq.${cardId}`);
  } catch (err) {
    console.warn('[Supabase Server Sync] delete card error:', err);
  }
}

async function serverSyncString(str: any) {
  const supabase = getServerSupabase();
  if (!supabase || !str) return;
  try {
    const boardId = str.board_id || 'episode-1-pilot';
    await serverSyncBoard(boardId);
    const clean = {
      id: str.id,
      board_id: boardId,
      source_id: str.source_id,
      target_id: str.target_id,
      label: str.label || '',
    };
    const { error } = await supabase.from('string_connections').upsert([clean], { onConflict: 'id' });
    if (error) console.warn('[Supabase Server Sync] string error:', error.message);
  } catch (err) {
    console.warn('[Supabase Server Sync] string exception:', err);
  }
}

async function serverDeleteString(stringId: string) {
  const supabase = getServerSupabase();
  if (!supabase) return;
  try {
    await supabase.from('string_connections').delete().eq('id', stringId);
  } catch (err) {
    console.warn('[Supabase Server Sync] delete string error:', err);
  }
}

async function serverSyncSticky(sticky: any) {
  const supabase = getServerSupabase();
  if (!supabase || !sticky) return;
  try {
    const boardId = sticky.board_id || 'episode-1-pilot';
    await serverSyncBoard(boardId);
    const clean = {
      id: sticky.id,
      board_id: boardId,
      content: sticky.content || '',
      color: sticky.color || 'parchment',
      x: typeof sticky.x === 'number' ? sticky.x : 100,
      y: typeof sticky.y === 'number' ? sticky.y : 100,
      author: sticky.author || '',
    };
    const { error } = await supabase.from('sticky_notes').upsert([clean], { onConflict: 'id' });
    if (error) console.warn('[Supabase Server Sync] sticky error:', error.message);
  } catch (err) {
    console.warn('[Supabase Server Sync] sticky exception:', err);
  }
}

async function serverDeleteSticky(stickyId: string) {
  const supabase = getServerSupabase();
  if (!supabase) return;
  try {
    await supabase.from('sticky_notes').delete().eq('id', stickyId);
  } catch (err) {
    console.warn('[Supabase Server Sync] delete sticky error:', err);
  }
}

async function hydrateFromSupabase() {
  const supabase = getServerSupabase();
  if (!supabase) return;

  try {
    const [boardsRes, cardsRes, stickiesRes, stringsRes] = await Promise.all([
      supabase.from('boards').select('*'),
      supabase.from('character_cards').select('*'),
      supabase.from('sticky_notes').select('*'),
      supabase.from('string_connections').select('*'),
    ]);

    let changed = false;

    if (!boardsRes.error && Array.isArray(boardsRes.data) && boardsRes.data.length > 0) {
      for (const b of boardsRes.data) {
        if (!db.boards.some((existing) => existing.id === b.id)) {
          db.boards.push(b);
          changed = true;
        }
      }
    }

    if (!cardsRes.error && Array.isArray(cardsRes.data) && cardsRes.data.length > 0) {
      for (const c of cardsRes.data) {
        const idx = db.cards.findIndex((existing) => existing.id === c.id);
        if (idx >= 0) {
          db.cards[idx] = { ...db.cards[idx], ...c };
        } else {
          db.cards.push(c);
          changed = true;
        }
      }
    }

    if (!stickiesRes.error && Array.isArray(stickiesRes.data) && stickiesRes.data.length > 0) {
      for (const s of stickiesRes.data) {
        const idx = db.stickies.findIndex((existing) => existing.id === s.id);
        if (idx >= 0) {
          db.stickies[idx] = { ...db.stickies[idx], ...s };
        } else {
          db.stickies.push(s);
          changed = true;
        }
      }
    }

    if (!stringsRes.error && Array.isArray(stringsRes.data) && stringsRes.data.length > 0) {
      for (const str of stringsRes.data) {
        const idx = db.strings.findIndex((existing) => existing.id === str.id);
        if (idx >= 0) {
          db.strings[idx] = { ...db.strings[idx], ...str };
        } else {
          db.strings.push(str);
          changed = true;
        }
      }
    }

    if (changed) {
      saveDatabaseImmediate();
      console.log(`[Supabase Hydrate] Synced from database: ${db.cards.length} cards, ${db.stickies.length} stickies, ${db.strings.length} strings`);
    }
  } catch (err) {
    console.warn('[Supabase Hydrate] Error hydrating from remote database:', err);
  }
}

// Bulk sync endpoint to preserve all board items reliably
app.post('/api/boards/:boardId/sync-all', (req, res) => {
  const { boardId } = req.params;
  const { cards = [], strings = [], stickies = [] } = req.body;

  if (Array.isArray(cards) && cards.length > 0) {
    for (const card of cards) {
      const idx = db.cards.findIndex((c) => c.id === card.id);
      if (idx >= 0) {
        db.cards[idx] = card;
      } else {
        db.cards.push(card);
      }
      serverSyncCard(card).catch(() => {});
    }
  }

  if (Array.isArray(stickies) && stickies.length > 0) {
    for (const sticky of stickies) {
      const idx = db.stickies.findIndex((s) => s.id === sticky.id);
      if (idx >= 0) {
        db.stickies[idx] = sticky;
      } else {
        db.stickies.push(sticky);
      }
      serverSyncSticky(sticky).catch(() => {});
    }
  }

  if (Array.isArray(strings) && strings.length > 0) {
    for (const str of strings) {
      const idx = db.strings.findIndex((s) => s.id === str.id);
      if (idx >= 0) {
        db.strings[idx] = str;
      } else {
        db.strings.push(str);
      }
      serverSyncString(str).catch(() => {});
    }
  }

  saveDatabaseImmediate();
  res.json({
    success: true,
    total: {
      cards: db.cards.filter((c) => c.board_id === boardId).length,
      stickies: db.stickies.filter((s) => s.board_id === boardId).length,
      strings: db.strings.filter((str) => str.board_id === boardId).length,
    },
  });
});

// Cards endpoints
app.post('/api/boards/:boardId/cards', (req, res) => {
  const card = req.body;
  if (!card || !card.id) return res.status(400).json({ error: 'Invalid card' });
  const idx = db.cards.findIndex((c) => c.id === card.id);
  if (idx >= 0) {
    db.cards[idx] = card;
  } else {
    db.cards.push(card);
  }
  saveDatabaseImmediate();
  const boardId = card.board_id || req.params.boardId;
  recordSyncEvent('card:upsert', { card }, undefined, boardId);
  broadcastToAll({ type: 'card:upsert', payload: { card } });
  serverSyncCard(card).catch(() => {});
  res.json({ success: true, card });
});

app.delete('/api/boards/:boardId/cards/:cardId', (req, res) => {
  const { cardId, boardId } = req.params;
  db.cards = db.cards.filter((c) => c.id !== cardId);
  db.strings = db.strings.filter((s) => s.source_id !== cardId && s.target_id !== cardId);
  saveDatabaseImmediate();
  recordSyncEvent('card:delete', { id: cardId }, undefined, boardId);
  broadcastToAll({ type: 'card:delete', payload: { id: cardId } });
  serverDeleteCard(cardId).catch(() => {});
  res.json({ success: true });
});

// Strings endpoints
app.post('/api/boards/:boardId/strings', (req, res) => {
  const string = req.body;
  if (!string || !string.id) return res.status(400).json({ error: 'Invalid string' });
  const idx = db.strings.findIndex((s) => s.id === string.id);
  if (idx >= 0) {
    db.strings[idx] = string;
  } else {
    db.strings.push(string);
  }
  saveDatabaseImmediate();
  const boardId = string.board_id || req.params.boardId;
  recordSyncEvent('string:upsert', { string }, undefined, boardId);
  broadcastToAll({ type: 'string:upsert', payload: { string } });
  serverSyncString(string).catch(() => {});
  res.json({ success: true, string });
});

app.delete('/api/boards/:boardId/strings/:stringId', (req, res) => {
  const { stringId, boardId } = req.params;
  db.strings = db.strings.filter((s) => s.id !== stringId);
  saveDatabaseImmediate();
  recordSyncEvent('string:delete', { id: stringId }, undefined, boardId);
  broadcastToAll({ type: 'string:delete', payload: { id: stringId } });
  serverDeleteString(stringId).catch(() => {});
  res.json({ success: true });
});

// Stickies endpoints
app.post('/api/boards/:boardId/stickies', (req, res) => {
  const sticky = req.body;
  if (!sticky || !sticky.id) return res.status(400).json({ error: 'Invalid sticky' });
  const idx = db.stickies.findIndex((s) => s.id === sticky.id);
  if (idx >= 0) {
    db.stickies[idx] = sticky;
  } else {
    db.stickies.push(sticky);
  }
  saveDatabaseImmediate();
  const boardId = sticky.board_id || req.params.boardId;
  recordSyncEvent('sticky:upsert', { sticky }, undefined, boardId);
  broadcastToAll({ type: 'sticky:upsert', payload: { sticky } });
  serverSyncSticky(sticky).catch(() => {});
  res.json({ success: true, sticky });
});

app.delete('/api/boards/:boardId/stickies/:stickyId', (req, res) => {
  const { stickyId, boardId } = req.params;
  db.stickies = db.stickies.filter((s) => s.id !== stickyId);
  saveDatabaseImmediate();
  recordSyncEvent('sticky:delete', { id: stickyId }, undefined, boardId);
  broadcastToAll({ type: 'sticky:delete', payload: { id: stickyId } });
  serverDeleteSticky(stickyId).catch(() => {});
  res.json({ success: true });
});

// Supabase Configuration Auto-Sharing
app.get('/api/supabase/config', (req, res) => {
  res.json(db.supabaseConfig || { url: '', key: '' });
});

app.post('/api/supabase/config', (req, res) => {
  const { url, key } = req.body;
  if (url && key) {
    db.supabaseConfig = { url: url.trim(), key: key.trim() };
    saveDatabaseImmediate();
    hydrateFromSupabase().catch(() => {});
  }
  res.json({ success: true, config: db.supabaseConfig || { url: '', key: '' } });
});

// Global Board Clear All (Wipe all cards, stickies, and strings)
app.post('/api/boards/clear-all', (req, res) => {
  db.cards = [];
  db.strings = [];
  db.stickies = [];
  scheduleSaveDatabase();
  recordSyncEvent('board:clear_all', {});
  broadcastToAll({ type: 'board:clear_all', payload: {} });
  res.json({ success: true, message: 'All board data cleared successfully' });
});

// Screening Room Chat
app.get('/api/chat/:boardId', (req, res) => {
  const { boardId } = req.params;
  res.json(db.chat[boardId] || []);
});

app.post('/api/chat/:boardId', (req, res) => {
  const { boardId } = req.params;
  const message = req.body;
  if (!db.chat[boardId]) {
    db.chat[boardId] = [];
  }
  db.chat[boardId].push(message);
  scheduleSaveDatabase();
  res.json({ success: true, message });
});

// Screening playback state
app.get('/api/screening', (req, res) => {
  res.json(db.screeningState);
});

app.post('/api/screening', (req, res) => {
  db.screeningState = {
    ...db.screeningState,
    ...req.body,
    updatedAt: Date.now(),
  };
  scheduleSaveDatabase();
  broadcastToAll({
    type: 'watch:playback',
    payload: db.screeningState,
  });
  res.json(db.screeningState);
});

// Video Streaming Endpoint with HTTP 206 Partial Content (Range requests)
const EPISODE_DRIVE_IDS: Record<number, string> = {
  1: '1QfcDCpuVPL8bg36CcwhrCa0df-Y0aoFL',
  2: '1QMu-g9mIRyCO2EZdY2RjHHX5VuOwvIm9',
  3: '1G3dPJzNXMzWrF62gqb9dRTbc4NJFj5qp',
  4: '1JtJY5mpAy5XbJ6VqYnWaqTrlTKmfAHkS',
  5: '1WvjHW6oj7_O8Nj3JP_SwU2djfXB22SJv',
};

const EPISODE_RAW_DOWNLOAD_URLS: Record<number, string> = {
  1: 'https://drive.usercontent.google.com/download?id=1QfcDCpuVPL8bg36CcwhrCa0df-Y0aoFL&export=download&authuser=0&confirm=t&uuid=72875448-b677-4fc8-bb6f-0f9df7bafab2&at=AMrWOn1fiyjbazbKsqibfYU_saeZ:1789010242243',
  2: 'https://drive.usercontent.google.com/download?id=1QMu-g9mIRyCO2EZdY2RjHHX5VuOwvIm9&export=download&authuser=0&confirm=t&uuid=f5178338-18cb-4ae5-a13a-06129f8d1611&at=AMrWOn0dskNjZ-x_ETB63BKKhgPB:1789011217527',
  3: 'https://drive.usercontent.google.com/download?id=1G3dPJzNXMzWrF62gqb9dRTbc4NJFj5qp&export=download&authuser=0&confirm=t&uuid=fed93477-3770-4616-a872-87848a80e1ac&at=AMrWOn2xhXWnqq0qzvjbmxwqtfzl:1789018377094',
  4: 'https://drive.usercontent.google.com/download?id=1JtJY5mpAy5XbJ6VqYnWaqTrlTKmfAHkS&export=download&authuser=0&confirm=t&uuid=605d90ff-76d7-4fc1-a2a4-4cc845f1b1f6&at=AMrWOn0eXipRWTC-otTdV_g-DUPs:1789018817305',
  5: 'https://drive.usercontent.google.com/download?id=1WvjHW6oj7_O8Nj3JP_SwU2djfXB22SJv&export=download&authuser=0&confirm=t&uuid=156b6996-7ec1-4dbc-a9ac-774bdd02cdf6&at=AMrWOn1fFY7dGag1ZA9NqhrmJzSg:1789019058091',
};

// Cached Google Drive download cookie
let driveCookieCache: string = '';
function getDriveCookies(): string {
  if (driveCookieCache) return driveCookieCache;
  try {
    if (fs.existsSync('/tmp/cookies.txt')) {
      const raw = fs.readFileSync('/tmp/cookies.txt', 'utf8');
      const lines = raw.split('\n').filter((l) => l && !l.startsWith('#'));
      driveCookieCache = lines
        .map((l) => {
          const p = l.split('\t');
          return `${p[5]}=${p[6]}`;
        })
        .join('; ');
      return driveCookieCache;
    }
  } catch (err) {
    console.error('Error reading cookies:', err);
  }
  return '';
}

app.get('/api/episodes/:episodeNumber/video', (req, res) => {
  const epNum = parseInt(req.params.episodeNumber, 10) || 1;
  const driveId = EPISODE_DRIVE_IDS[epNum] || EPISODE_DRIVE_IDS[1];

  // Check if a local remuxed or pre-downloaded file exists
  const localRemuxPath = path.join(EPISODES_CACHE_DIR, `episode_${epNum}.mp4`);
  const localTestPath = path.join('/tmp', 'clip60.mp4');

  if (fs.existsSync(localRemuxPath)) {
    const stat = fs.statSync(localRemuxPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = end - start + 1;
      const file = fs.createReadStream(localRemuxPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
      return;
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(localRemuxPath).pipe(res);
      return;
    }
  }

  // Stream directly from Google Drive with Range proxy
  const cookie = getDriveCookies();
  const rangeHeader = req.headers.range || 'bytes=0-';

  const driveUrl =
    EPISODE_RAW_DOWNLOAD_URLS[epNum] ||
    `https://drive.usercontent.google.com/download?id=${driveId}&export=download&confirm=t`;

  const options: https.RequestOptions = {
    headers: {
      Range: rangeHeader,
      Cookie: cookie,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  };

  const driveReq = https.get(driveUrl, options, (driveRes) => {
    // If redirect occurs
    if (driveRes.statusCode === 302 || driveRes.statusCode === 303 || driveRes.statusCode === 307) {
      const redirectUrl = driveRes.headers.location;
      if (redirectUrl) {
        https.get(redirectUrl, { headers: options.headers }, (subRes) => {
          res.writeHead(subRes.statusCode || 200, {
            'Content-Type': subRes.headers['content-type'] || 'video/mp4',
            'Content-Length': subRes.headers['content-length'] || '',
            'Content-Range': subRes.headers['content-range'] || '',
            'Accept-Ranges': 'bytes',
          });
          subRes.pipe(res);
        }).on('error', (err) => {
          console.error('Drive proxy redirect error:', err);
          if (!res.headersSent) res.status(500).send('Video stream error');
        });
        return;
      }
    }

    res.writeHead(driveRes.statusCode || 200, {
      'Content-Type': driveRes.headers['content-type'] || 'video/mp4',
      'Content-Length': driveRes.headers['content-length'] || '',
      'Content-Range': driveRes.headers['content-range'] || '',
      'Accept-Ranges': 'bytes',
    });
    driveRes.pipe(res);
  });

  driveReq.on('error', (err) => {
    console.error('Drive stream error:', err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'Failed to stream from video host' });
    }
  });

  req.on('close', () => {
    driveReq.destroy();
  });
});

// Vite middleware / production serving
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Only start listening when run as a standalone server (not inside Vercel serverless function)
  if (!IS_VERCEL) {
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[Server] Port ${PORT} is already bound by another process. Express reusing existing socket if attached.`);
      } else {
        console.error('[Server Error]', err);
      }
    });

    server.listen(PORT, '0.0.0.0', () => {
      console.log(`[Twin Peaks Server] Sheriff Dispatch Server running on port ${PORT}`);
      hydrateFromSupabase().catch((err) => {
        console.warn('[Server Startup] Hydrate exception:', err);
      });
    });
  }
}

start();

export default app;

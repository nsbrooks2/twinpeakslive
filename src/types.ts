export type PinStatus = 'Cleared' | 'Suspect' | 'Unknown' | 'Victim';

export interface CharacterCard {
  id: string;
  board_id: string;
  name: string;
  role: string;
  notes: string;
  status: PinStatus;
  x: number;
  y: number;
  z_index?: number;
  created_at?: string;
  updated_at?: string;
}

export interface StringConnection {
  id: string;
  board_id: string;
  source_id: string;
  target_id: string;
  label?: string;
  created_at?: string;
}

export interface StickyNote {
  id: string;
  board_id: string;
  content: string;
  color: 'yellow' | 'crimson' | 'wood' | 'green' | 'parchment';
  x: number;
  y: number;
  author?: string;
  created_at?: string;
}

export interface EpisodeBoard {
  id: string;
  title: string;
  episode_number: number;
  created_at: string;
  updated_at: string;
  description?: string;
}

export interface PresenceUser {
  user_id: string;
  email: string;
  name: string;
  last_seen: string;
  board_id?: string;
}

export interface WebRTCSignalPayload {
  type: 'offer' | 'answer' | 'candidate' | 'call_request' | 'call_end' | 'call_reject';
  from: string;
  to?: string;
  board_id: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

export interface WatchPartyChatMessage {
  id: string;
  sender_name: string;
  sender_email: string;
  timestamp: string; // ISO string
  video_time: number; // Video playback time in seconds when sent
  text: string;
  is_theory_clue?: boolean;
}

export interface WatchPartySyncState {
  isPlaying: boolean;
  currentTime: number;
  updatedBy: string;
  updatedAt: number; // Date.now() timestamp for drift correction
  episodeNumber?: number;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  badge_title?: string;
  department?: string;
  favorite_quote?: string;
  created_at: string;
  last_login: string;
}


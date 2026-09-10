import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Retrieve credentials from Vite env or localStorage
export function getSupabaseCredentials(): { url: string; key: string } {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('tp_supabase_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('tp_supabase_key') || '' : '';

  return {
    url: localUrl.trim() || envUrl.trim(),
    key: localKey.trim() || envKey.trim(),
  };
}

export function saveSupabaseCredentials(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tp_supabase_url', url.trim());
    localStorage.setItem('tp_supabase_key', key.trim());
  }
}

let supabaseInstance: SupabaseClient | null = null;
let currentUrl = '';
let currentKey = '';

export function getSupabase(): SupabaseClient | null {
  const { url, key } = getSupabaseCredentials();

  if (!url || !key) {
    return null;
  }

  if (!supabaseInstance || currentUrl !== url || currentKey !== key) {
    try {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
        },
        realtime: {
          params: {
            eventsPerSecond: 20,
          },
        },
      });
      currentUrl = url;
      currentKey = key;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseInstance;
}

export async function testSupabaseConnection(): Promise<{ ok: boolean; message?: string }> {
  const client = getSupabase();
  if (!client) {
    return { ok: false, message: 'No Supabase URL or Anon Key provided.' };
  }

  try {
    // Attempt a light ping/query
    const { error } = await client.from('boards').select('id').limit(1);
    if (error) {
      // If table doesn't exist yet, but client connected, it's still reachable
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return { ok: true, message: 'Connected to Supabase project! (Run SQL schema to enable boards table sync).' };
      }
      return { ok: false, message: error.message };
    }
    return { ok: true, message: 'Connected to Supabase project with table sync active.' };
  } catch (err: any) {
    return { ok: false, message: err?.message || 'Failed to communicate with Supabase.' };
  }
}

export const SUPABASE_SQL_SCHEMA = `-- Run this in your Supabase SQL Editor to prepare "Damn Fine Case Board":

-- 1. Create Episode Boards table
create table if not exists boards (
  id text primary key,
  title text not null,
  episode_number int not null default 1,
  description text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 2. Create Character Cards table
create table if not exists character_cards (
  id text primary key,
  board_id text references boards(id) on delete cascade,
  name text not null,
  role text not null default '',
  notes text not null default '',
  status text not null default 'Unknown',
  x double precision not null default 100,
  y double precision not null default 100,
  z_index int default 1,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- 3. Create Red String Connections table
create table if not exists string_connections (
  id text primary key,
  board_id text references boards(id) on delete cascade,
  source_id text not null,
  target_id text not null,
  label text default '',
  created_at timestamp with time zone default now()
);

-- 4. Create Sticky Notes table
create table if not exists sticky_notes (
  id text primary key,
  board_id text references boards(id) on delete cascade,
  content text not null default '',
  color text not null default 'parchment',
  x double precision not null default 200,
  y double precision not null default 200,
  author text default '',
  created_at timestamp with time zone default now()
);

-- Enable RLS and simple open policies for the two of you:
alter table boards enable row level security;
alter table character_cards enable row level security;
alter table string_connections enable row level security;
alter table sticky_notes enable row level security;

create policy "Allow all for authenticated users on boards" on boards for all to authenticated using (true) with check (true);
create policy "Allow all for authenticated users on character_cards" on character_cards for all to authenticated using (true) with check (true);
create policy "Allow all for authenticated users on string_connections" on string_connections for all to authenticated using (true) with check (true);
create policy "Allow all for authenticated users on sticky_notes" on sticky_notes for all to authenticated using (true) with check (true);

-- Enable realtime publications for live sync:
alter publication supabase_realtime add table boards;
alter publication supabase_realtime add table character_cards;
alter publication supabase_realtime add table string_connections;
alter publication supabase_realtime add table sticky_notes;
`;

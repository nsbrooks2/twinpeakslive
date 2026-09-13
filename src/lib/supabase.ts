import { createClient, SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://dkqkzmjdvjvxehsoeomd.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRrcWt6bWpkdmp2eGVoc29lb21kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwMDA0OTgsImV4cCI6MjEwNDU3NjQ5OH0.uPQtL9fCRricdInsFOoEUYfem91nFfi9R5N5WGQotaY';

// Retrieve credentials from Vite env or localStorage or defaults
export function getSupabaseCredentials(): { url: string; key: string } {
  const metaEnv = (import.meta as any).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('tp_supabase_url') || '' : '';
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('tp_supabase_key') || '' : '';

  return {
    url: localUrl.trim() || envUrl.trim() || DEFAULT_SUPABASE_URL,
    key: localKey.trim() || envKey.trim() || DEFAULT_SUPABASE_ANON_KEY,
  };
}

export function saveSupabaseCredentials(url: string, key: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('tp_supabase_url', url.trim());
    localStorage.setItem('tp_supabase_key', key.trim());

    // Share credentials with server so all connected devices auto-configure Supabase!
    fetch('/api/supabase/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: url.trim(), key: key.trim() }),
    }).catch(() => {});
  }
}

export async function syncSupabaseWithServer(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const localUrl = localStorage.getItem('tp_supabase_url');
    const localKey = localStorage.getItem('tp_supabase_key');

    // If local has config, sync to server
    if (localUrl && localKey) {
      fetch('/api/supabase/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: localUrl.trim(), key: localKey.trim() }),
      }).catch(() => {});
      return true;
    }

    // Otherwise check if server has config
    const res = await fetch('/api/supabase/config');
    if (res.ok) {
      const config = await res.json();
      if (config.url && config.key) {
        localStorage.setItem('tp_supabase_url', config.url);
        localStorage.setItem('tp_supabase_key', config.key);
        return true;
      }
    }
  } catch (err) {
    console.warn('Could not sync Supabase credentials with server:', err);
  }
  return false;
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

-- Enable RLS and simple open policies for both anon (public key) and authenticated users:
alter table boards enable row level security;
alter table character_cards enable row level security;
alter table string_connections enable row level security;
alter table sticky_notes enable row level security;

drop policy if exists "Allow all for authenticated users on boards" on boards;
drop policy if exists "Allow all for authenticated users on character_cards" on character_cards;
drop policy if exists "Allow all for authenticated users on string_connections" on string_connections;
drop policy if exists "Allow all for authenticated users on sticky_notes" on sticky_notes;

drop policy if exists "Allow all on boards" on boards;
drop policy if exists "Allow all on character_cards" on character_cards;
drop policy if exists "Allow all on string_connections" on string_connections;
drop policy if exists "Allow all on sticky_notes" on sticky_notes;

create policy "Allow all on boards" on boards for all to anon, authenticated using (true) with check (true);
create policy "Allow all on character_cards" on character_cards for all to anon, authenticated using (true) with check (true);
create policy "Allow all on string_connections" on string_connections for all to anon, authenticated using (true) with check (true);
create policy "Allow all on sticky_notes" on sticky_notes for all to anon, authenticated using (true) with check (true);

-- Seed canonical episode boards so foreign keys are satisfied:
insert into boards (id, title, episode_number, description) values
  ('episode-1-pilot', 'Episode 1: Pilot (Northwest Passage)', 1, 'The discovery of Laura Palmer wrapped in plastic.'),
  ('episode-2-traces-to-nowhere', 'Episode 2: Traces to Nowhere', 2, 'Agent Cooper questions James Hurley.'),
  ('episode-3-zen-skill', 'Episode 3: Zen, or the Skill to Catch a Killer', 3, 'Tibetan rock-throwing technique in the woods.'),
  ('episode-4-rest-in-pain', 'Episode 4: Rest in Pain', 4, 'The town gathers for Laura Palmer funeral.'),
  ('episode-5-the-one-armed-man', 'Episode 5: The One-Armed Man', 5, 'Cooper and Truman question Phillip Gerard.'),
  ('episode-6-coopers-dreams', 'Episode 6: Cooper''s Dreams', 6, 'Agent Cooper searches Jacques Renault''s cabin.'),
  ('episode-7-realization-time', 'Episode 7: Realization Time', 7, 'Audrey applies for a job at One Eyed Jacks.'),
  ('episode-8-the-last-evening', 'Episode 8: The Last Evening', 8, 'Season 1 Finale: Cooper lures Jacques Renault into a trap.')
on conflict (id) do nothing;

-- Enable realtime publications safely without failing if already added:
do $$
begin
  begin
    alter publication supabase_realtime add table boards;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table character_cards;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table string_connections;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table sticky_notes;
  exception when others then null;
  end;
end $$;
`;

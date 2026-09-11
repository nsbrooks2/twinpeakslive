import { 
  CharacterCard, 
  EpisodeBoard, 
  StringConnection, 
  StickyNote,
  UserAccount,
} from '../types';
import { 
  INITIAL_PILOT_BOARD, 
  INITIAL_EPISODE_2_BOARD, 
  INITIAL_EPISODE_3_BOARD,
  INITIAL_EPISODE_4_BOARD,
  INITIAL_EPISODE_5_BOARD,
} from '../seedData';
import { getSupabase } from './supabase';

export function getApiUrl(path: string): string {
  if (typeof window === 'undefined') return path;
  const custom = localStorage.getItem('tp_custom_server_url');
  if (custom && custom.trim()) {
    return `${custom.trim().replace(/\/+$/, '')}${path}`;
  }
  return path;
}

const STORAGE_KEYS = {
  BOARDS: 'tp_caseboard_boards_v2',
  CARDS: 'tp_caseboard_cards_v2',
  STRINGS: 'tp_caseboard_strings_v2',
  STICKIES: 'tp_caseboard_stickies_v2',
  ACTIVE_BOARD: 'tp_caseboard_active_id',
};

export class BoardRepository {
  private static getLocal<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  private static setLocal<T>(key: string, data: T) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(data));
  }

  // Load all boards (from Server REST API -> Supabase -> LocalStorage)
  static async loadBoards(): Promise<EpisodeBoard[]> {
    // 1. Try Server API (authoritative disk persistence)
    try {
      const res = await fetch(getApiUrl('/api/boards'));
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.setLocal(STORAGE_KEYS.BOARDS, data);
          return data;
        }
      }
    } catch (err) {
      console.warn('Server loadBoards failed, falling back:', err);
    }

    // 2. Try Supabase
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('boards')
          .select('*')
          .order('episode_number', { ascending: true });
        
        if (!error && data && data.length > 0) {
          this.setLocal(STORAGE_KEYS.BOARDS, data);
          return data;
        }
      } catch (err) {
        console.warn('Supabase loadBoards failed, falling back to local:', err);
      }
    }

    // 3. Local storage check
    let local = this.getLocal<EpisodeBoard[]>(STORAGE_KEYS.BOARDS, []);
    if (local.length === 0) {
      const seeded = [INITIAL_PILOT_BOARD, INITIAL_EPISODE_2_BOARD, INITIAL_EPISODE_3_BOARD, INITIAL_EPISODE_4_BOARD, INITIAL_EPISODE_5_BOARD];
      this.setLocal(STORAGE_KEYS.BOARDS, seeded);
      return seeded;
    }

    if (!local.some(b => b.episode_number === 2 || b.id === INITIAL_EPISODE_2_BOARD.id)) {
      local = [...local, INITIAL_EPISODE_2_BOARD];
      this.setLocal(STORAGE_KEYS.BOARDS, local);
    }
    if (!local.some(b => b.episode_number === 3 || b.id === INITIAL_EPISODE_3_BOARD.id)) {
      local = [...local, INITIAL_EPISODE_3_BOARD];
      this.setLocal(STORAGE_KEYS.BOARDS, local);
    }
    if (!local.some(b => b.episode_number === 4 || b.id === INITIAL_EPISODE_4_BOARD.id)) {
      local = [...local, INITIAL_EPISODE_4_BOARD];
      this.setLocal(STORAGE_KEYS.BOARDS, local);
    }
    if (!local.some(b => b.episode_number === 5 || b.id === INITIAL_EPISODE_5_BOARD.id)) {
      local = [...local, INITIAL_EPISODE_5_BOARD];
      this.setLocal(STORAGE_KEYS.BOARDS, local);
    }

    return local;
  }

  // Helper: Load board details from server or local storage
  private static async loadBoardDetailsFromServerOrLocal(boardId: string): Promise<{
    cards: CharacterCard[];
    strings: StringConnection[];
    stickies: StickyNote[];
  }> {
    try {
      const res = await fetch(getApiUrl(`/api/boards/${boardId}`));
      if (res.ok) {
        const data = await res.json();
        if (data && (Array.isArray(data.cards) || Array.isArray(data.strings) || Array.isArray(data.stickies))) {
          const cards = data.cards || [];
          const strings = data.strings || [];
          const stickies = data.stickies || [];
          return { cards, strings, stickies };
        }
      }
    } catch (err) {
      console.warn('Server loadBoardDetails failed:', err);
    }

    const allCards = this.getLocal<CharacterCard[]>(STORAGE_KEYS.CARDS, []);
    const allStrings = this.getLocal<StringConnection[]>(STORAGE_KEYS.STRINGS, []);
    const allStickies = this.getLocal<StickyNote[]>(STORAGE_KEYS.STICKIES, []);

    return {
      cards: allCards.filter(c => c.board_id === boardId),
      strings: allStrings.filter(s => s.board_id === boardId),
      stickies: allStickies.filter(n => n.board_id === boardId),
    };
  }

  // Helper: Sync cards, strings, stickies to Supabase
  private static async syncItemsToSupabase(
    boardId: string,
    cards: CharacterCard[],
    strings: StringConnection[],
    stickies: StickyNote[]
  ) {
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      // Ensure parent board exists in Supabase
      const allBoards = await this.loadBoards();
      const boardObj = allBoards.find(b => b.id === boardId) || {
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

      if (cards.length > 0) {
        const { error } = await supabase.from('character_cards').upsert(cards, { onConflict: 'id' });
        if (error) console.warn('Auto-seed cards error:', error.message);
      }
      if (stickies.length > 0) {
        const { error } = await supabase.from('sticky_notes').upsert(stickies, { onConflict: 'id' });
        if (error) console.warn('Auto-seed stickies error:', error.message);
      }
      if (strings.length > 0) {
        const { error } = await supabase.from('string_connections').upsert(strings, { onConflict: 'id' });
        if (error) console.warn('Auto-seed strings error:', error.message);
      }
    } catch (err) {
      console.warn('syncItemsToSupabase error:', err);
    }
  }

  // Load all items for a board
  static async loadBoardDetails(boardId: string): Promise<{
    cards: CharacterCard[];
    strings: StringConnection[];
    stickies: StickyNote[];
  }> {
    // 1. Try Supabase first if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        const [cardsRes, stringsRes, stickiesRes] = await Promise.all([
          supabase.from('character_cards').select('*').eq('board_id', boardId),
          supabase.from('string_connections').select('*').eq('board_id', boardId),
          supabase.from('sticky_notes').select('*').eq('board_id', boardId),
        ]);

        if (!cardsRes.error && !stringsRes.error && !stickiesRes.error) {
          let cards = cardsRes.data || [];
          let strings = stringsRes.data || [];
          let stickies = stickiesRes.data || [];

          // If Supabase returned empty for this board, auto-seed from server or local seed data!
          if (cards.length === 0 && stickies.length === 0) {
            const serverOrLocal = await this.loadBoardDetailsFromServerOrLocal(boardId);
            if (serverOrLocal.cards.length > 0 || serverOrLocal.stickies.length > 0) {
              cards = serverOrLocal.cards;
              strings = serverOrLocal.strings;
              stickies = serverOrLocal.stickies;

              // Auto-seed to Supabase in background
              this.syncItemsToSupabase(boardId, cards, strings, stickies).catch(err => {
                console.warn('Auto-seed to Supabase failed:', err);
              });
            }
          }

          // Cache in local storage
          const allCards = this.getLocal<CharacterCard[]>(STORAGE_KEYS.CARDS, []);
          const otherCards = allCards.filter(c => c.board_id !== boardId);
          this.setLocal(STORAGE_KEYS.CARDS, [...otherCards, ...cards]);

          const allStrings = this.getLocal<StringConnection[]>(STORAGE_KEYS.STRINGS, []);
          const otherStrings = allStrings.filter(s => s.board_id !== boardId);
          this.setLocal(STORAGE_KEYS.STRINGS, [...otherStrings, ...strings]);

          const allStickies = this.getLocal<StickyNote[]>(STORAGE_KEYS.STICKIES, []);
          const otherStickies = allStickies.filter(s => s.board_id !== boardId);
          this.setLocal(STORAGE_KEYS.STICKIES, [...otherStickies, ...stickies]);

          return { cards, strings, stickies };
        } else {
          if (cardsRes.error) console.warn('Supabase fetch cards error:', cardsRes.error.message);
          if (stringsRes.error) console.warn('Supabase fetch strings error:', stringsRes.error.message);
          if (stickiesRes.error) console.warn('Supabase fetch stickies error:', stickiesRes.error.message);
        }
      } catch (err) {
        console.warn('Supabase loadBoardDetails failed, trying server API:', err);
      }
    }

    // 2. Try Server API
    return this.loadBoardDetailsFromServerOrLocal(boardId);
  }

  // Create new board (with optional duplicate)
  static async createBoard(params: {
    title: string;
    episodeNumber: number;
    description?: string;
    duplicateFromBoardId?: string;
  }): Promise<EpisodeBoard> {
    const newBoardId = `episode-${params.episodeNumber}-${Date.now()}`;
    const newBoard: EpisodeBoard = {
      id: newBoardId,
      title: params.title,
      episode_number: params.episodeNumber,
      description: params.description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Save board locally
    const currentBoards = this.getLocal<EpisodeBoard[]>(STORAGE_KEYS.BOARDS, []);
    this.setLocal(STORAGE_KEYS.BOARDS, [...currentBoards, newBoard]);

    // Send to Server
    try {
      await fetch(getApiUrl('/api/boards'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ board: newBoard, duplicateFromBoardId: params.duplicateFromBoardId }),
      });
    } catch (err) {
      console.warn('Server createBoard error:', err);
    }

    // Persist to Supabase if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('boards').insert([newBoard]);
      } catch (err) {
        console.warn('Error syncing new board to Supabase:', err);
      }
    }

    return newBoard;
  }

  // Carry over / Import evidence from sourceBoardId into targetBoardId
  static async carryOverEvidence(params: {
    sourceBoardId: string;
    targetBoardId: string;
    mode?: 'merge' | 'replace';
    items?: Array<'cards' | 'strings' | 'stickies'>;
  }): Promise<{
    importedCards: CharacterCard[];
    importedStrings: StringConnection[];
    importedStickies: StickyNote[];
  }> {
    const { sourceBoardId, targetBoardId, mode = 'merge', items = ['cards', 'strings', 'stickies'] } = params;

    // 1. Call server API
    try {
      await fetch(getApiUrl(`/api/boards/${targetBoardId}/import`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceBoardId, mode, items }),
      });
    } catch (err) {
      console.warn('Server carryOverEvidence error:', err);
    }

    // 2. Perform local storage sync
    let allCards = this.getLocal<CharacterCard[]>(STORAGE_KEYS.CARDS, []);
    let allStrings = this.getLocal<StringConnection[]>(STORAGE_KEYS.STRINGS, []);
    let allStickies = this.getLocal<StickyNote[]>(STORAGE_KEYS.STICKIES, []);

    if (mode === 'replace') {
      if (items.includes('cards')) {
        allCards = allCards.filter(c => c.board_id !== targetBoardId);
      }
      if (items.includes('strings')) {
        allStrings = allStrings.filter(s => s.board_id !== targetBoardId);
      }
      if (items.includes('stickies')) {
        allStickies = allStickies.filter(st => st.board_id !== targetBoardId);
      }
    }

    const idMap = new Map<string, string>();
    const newCards: CharacterCard[] = [];
    const newStrings: StringConnection[] = [];
    const newStickies: StickyNote[] = [];

    if (items.includes('cards')) {
      const sourceCards = allCards.filter(c => c.board_id === sourceBoardId);
      sourceCards.forEach((c) => {
        const existingInTarget = allCards.find(
          tc => tc.board_id === targetBoardId && tc.name.toLowerCase().trim() === c.name.toLowerCase().trim()
        );
        if (existingInTarget && mode === 'merge') {
          idMap.set(c.id, existingInTarget.id);
        } else {
          const newId = `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          idMap.set(c.id, newId);
          const cloned: CharacterCard = {
            ...c,
            id: newId,
            board_id: targetBoardId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          newCards.push(cloned);
          allCards.push(cloned);
        }
      });
    }

    if (items.includes('strings')) {
      const sourceStrings = allStrings.filter(s => s.board_id === sourceBoardId);
      sourceStrings.forEach((s) => {
        const newSource = idMap.get(s.source_id);
        const newTarget = idMap.get(s.target_id);
        if (newSource && newTarget) {
          const already = allStrings.some(
            str =>
              str.board_id === targetBoardId &&
              ((str.source_id === newSource && str.target_id === newTarget) ||
                (str.source_id === newTarget && str.target_id === newSource))
          );
          if (!already) {
            const cloned: StringConnection = {
              ...s,
              id: `str-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              board_id: targetBoardId,
              source_id: newSource,
              target_id: newTarget,
              created_at: new Date().toISOString(),
            };
            newStrings.push(cloned);
            allStrings.push(cloned);
          }
        }
      });
    }

    if (items.includes('stickies')) {
      const sourceStickies = allStickies.filter(st => st.board_id === sourceBoardId);
      sourceStickies.forEach((st) => {
        const cloned: StickyNote = {
          ...st,
          id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          board_id: targetBoardId,
          created_at: new Date().toISOString(),
        };
        newStickies.push(cloned);
        allStickies.push(cloned);
      });
    }

    this.setLocal(STORAGE_KEYS.CARDS, allCards);
    this.setLocal(STORAGE_KEYS.STRINGS, allStrings);
    this.setLocal(STORAGE_KEYS.STICKIES, allStickies);

    return {
      importedCards: newCards,
      importedStrings: newStrings,
      importedStickies: newStickies,
    };
  }

  // Save/Upsert single card
  static async upsertCard(card: CharacterCard) {
    const allCards = this.getLocal<CharacterCard[]>(STORAGE_KEYS.CARDS, []);
    const idx = allCards.findIndex(c => c.id === card.id);
    if (idx >= 0) {
      allCards[idx] = card;
    } else {
      allCards.push(card);
    }
    this.setLocal(STORAGE_KEYS.CARDS, allCards);

    // Save to Server
    try {
      fetch(getApiUrl(`/api/boards/${card.board_id}/cards`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(card),
      }).catch(() => {});
    } catch {
      // ignore
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        // Ensure parent board exists in Supabase first
        const allBoards = this.getLocal<EpisodeBoard[]>(STORAGE_KEYS.BOARDS, []);
        const boardObj: EpisodeBoard = allBoards.find(b => b.id === card.board_id) || {
          id: card.board_id,
          title: 'Investigation Board',
          episode_number: 1,
          description: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from('boards').upsert([{
          id: boardObj.id,
          title: boardObj.title,
          episode_number: boardObj.episode_number || 1,
          description: boardObj.description || '',
        }], { onConflict: 'id' });

        const cleanCard = {
          id: card.id,
          board_id: card.board_id || 'episode-1-pilot',
          name: card.name || 'New Suspect',
          role: card.role || '',
          notes: card.notes || '',
          status: card.status || 'Unknown',
          x: typeof card.x === 'number' ? card.x : 100,
          y: typeof card.y === 'number' ? card.y : 100,
          z_index: typeof card.z_index === 'number' ? card.z_index : 1,
        };
        const { error } = await supabase.from('character_cards').upsert([cleanCard], { onConflict: 'id' });
        if (error) {
          console.warn('Supabase upsertCard error:', error.message);
        } else {
          console.log('Saved card to Supabase:', card.name);
        }
      } catch (err) {
        console.warn('Error upserting card to Supabase:', err);
      }
    }
  }

  // Delete card & connected strings
  static async deleteCard(cardId: string, boardId: string) {
    const allCards = this.getLocal<CharacterCard[]>(STORAGE_KEYS.CARDS, []);
    this.setLocal(STORAGE_KEYS.CARDS, allCards.filter(c => c.id !== cardId));

    const allStrings = this.getLocal<StringConnection[]>(STORAGE_KEYS.STRINGS, []);
    this.setLocal(
      STORAGE_KEYS.STRINGS,
      allStrings.filter(s => s.source_id !== cardId && s.target_id !== cardId)
    );

    // Send to Server
    try {
      fetch(getApiUrl(`/api/boards/${boardId}/cards/${cardId}`), {
        method: 'DELETE',
      }).catch(() => {});
    } catch {
      // ignore
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const res1 = await supabase.from('character_cards').delete().eq('id', cardId);
        if (res1.error) console.warn('Supabase deleteCard error:', res1.error.message);
        const res2 = await supabase
          .from('string_connections')
          .delete()
          .or(`source_id.eq.${cardId},target_id.eq.${cardId}`);
        if (res2.error) console.warn('Supabase delete string connections error:', res2.error.message);
      } catch (err) {
        console.warn('Error deleting card in Supabase:', err);
      }
    }
  }

  // Upsert string connection
  static async upsertString(str: StringConnection) {
    const allStrings = this.getLocal<StringConnection[]>(STORAGE_KEYS.STRINGS, []);
    const idx = allStrings.findIndex(s => s.id === str.id);
    if (idx >= 0) {
      allStrings[idx] = str;
    } else {
      allStrings.push(str);
    }
    this.setLocal(STORAGE_KEYS.STRINGS, allStrings);

    // Send to Server
    try {
      fetch(getApiUrl(`/api/boards/${str.board_id}/strings`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(str),
      }).catch(() => {});
    } catch {
      // ignore
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const allBoards = this.getLocal<EpisodeBoard[]>(STORAGE_KEYS.BOARDS, []);
        const boardObj: EpisodeBoard = allBoards.find(b => b.id === str.board_id) || {
          id: str.board_id,
          title: 'Investigation Board',
          episode_number: 1,
          description: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from('boards').upsert([{
          id: boardObj.id,
          title: boardObj.title,
          episode_number: boardObj.episode_number || 1,
          description: boardObj.description || '',
        }], { onConflict: 'id' });

        const cleanString = {
          id: str.id,
          board_id: str.board_id || 'episode-1-pilot',
          source_id: str.source_id,
          target_id: str.target_id,
          label: str.label || '',
        };
        const { error } = await supabase.from('string_connections').upsert([cleanString], { onConflict: 'id' });
        if (error) console.warn('Supabase upsertString error:', error.message);
      } catch (err) {
        console.warn('Error upserting string to Supabase:', err);
      }
    }
  }

  // Delete string connection
  static async deleteString(stringId: string, boardId?: string) {
    const allStrings = this.getLocal<StringConnection[]>(STORAGE_KEYS.STRINGS, []);
    const targetString = allStrings.find(s => s.id === stringId);
    const targetBoardId = boardId || targetString?.board_id || 'episode-1-pilot';

    this.setLocal(STORAGE_KEYS.STRINGS, allStrings.filter(s => s.id !== stringId));

    // Send to Server
    try {
      fetch(getApiUrl(`/api/boards/${targetBoardId}/strings/${stringId}`), {
        method: 'DELETE',
      }).catch(() => {});
    } catch {
      // ignore
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('string_connections').delete().eq('id', stringId);
        if (error) console.warn('Supabase deleteString error:', error.message);
      } catch (err) {
        console.warn('Error deleting string from Supabase:', err);
      }
    }
  }

  // Upsert sticky note
  static async upsertSticky(note: StickyNote) {
    const allStickies = this.getLocal<StickyNote[]>(STORAGE_KEYS.STICKIES, []);
    const idx = allStickies.findIndex(s => s.id === note.id);
    if (idx >= 0) {
      allStickies[idx] = note;
    } else {
      allStickies.push(note);
    }
    this.setLocal(STORAGE_KEYS.STICKIES, allStickies);

    // Send to Server
    try {
      fetch(getApiUrl(`/api/boards/${note.board_id}/stickies`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      }).catch(() => {});
    } catch {
      // ignore
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const allBoards = this.getLocal<EpisodeBoard[]>(STORAGE_KEYS.BOARDS, []);
        const boardObj: EpisodeBoard = allBoards.find(b => b.id === note.board_id) || {
          id: note.board_id,
          title: 'Investigation Board',
          episode_number: 1,
          description: '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await supabase.from('boards').upsert([{
          id: boardObj.id,
          title: boardObj.title,
          episode_number: boardObj.episode_number || 1,
          description: boardObj.description || '',
        }], { onConflict: 'id' });

        const cleanSticky = {
          id: note.id,
          board_id: note.board_id || 'episode-1-pilot',
          content: note.content || '',
          color: note.color || 'parchment',
          x: typeof note.x === 'number' ? note.x : 100,
          y: typeof note.y === 'number' ? note.y : 100,
          author: note.author || '',
        };
        const { error } = await supabase.from('sticky_notes').upsert([cleanSticky], { onConflict: 'id' });
        if (error) console.warn('Supabase upsertSticky error:', error.message);
      } catch (err) {
        console.warn('Error upserting sticky note to Supabase:', err);
      }
    }
  }

  // Delete sticky note
  static async deleteSticky(noteId: string, boardId?: string) {
    const allStickies = this.getLocal<StickyNote[]>(STORAGE_KEYS.STICKIES, []);
    const targetSticky = allStickies.find(s => s.id === noteId);
    const targetBoardId = boardId || targetSticky?.board_id || 'episode-1-pilot';

    this.setLocal(STORAGE_KEYS.STICKIES, allStickies.filter(s => s.id !== noteId));

    // Send to Server
    try {
      fetch(getApiUrl(`/api/boards/${targetBoardId}/stickies/${noteId}`), {
        method: 'DELETE',
      }).catch(() => {});
    } catch {
      // ignore
    }

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { error } = await supabase.from('sticky_notes').delete().eq('id', noteId);
        if (error) console.warn('Supabase deleteSticky error:', error.message);
      } catch (err) {
        console.warn('Error deleting sticky note from Supabase:', err);
      }
    }
  }

  // Clear all cards, stickies, and string connections across all boards
  static async clearAllBoardData() {
    // Clear Local Storage
    this.setLocal(STORAGE_KEYS.CARDS, []);
    this.setLocal(STORAGE_KEYS.STRINGS, []);
    this.setLocal(STORAGE_KEYS.STICKIES, []);

    // Clear Server API
    try {
      await fetch('/api/boards/clear-all', { method: 'POST' });
    } catch {
      // ignore
    }

    // Clear Supabase database tables if connected
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('character_cards').delete().neq('id', '___none___');
        await supabase.from('string_connections').delete().neq('id', '___none___');
        await supabase.from('sticky_notes').delete().neq('id', '___none___');
      } catch (err) {
        console.warn('Error clearing Supabase tables:', err);
      }
    }
  }

  // Bulk push/sync all boards, cards, stickies, and string connections to Supabase
  static async pushAllToSupabase(): Promise<{
    success: boolean;
    cardsCount: number;
    stickiesCount: number;
    stringsCount: number;
    error?: string;
  }> {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        success: false,
        cardsCount: 0,
        stickiesCount: 0,
        stringsCount: 0,
        error: 'Supabase credentials are not configured or invalid.',
      };
    }

    try {
      const boards = await this.loadBoards();
      const allCards = this.getLocal<CharacterCard[]>(STORAGE_KEYS.CARDS, []);
      const allStickies = this.getLocal<StickyNote[]>(STORAGE_KEYS.STICKIES, []);
      const allStrings = this.getLocal<StringConnection[]>(STORAGE_KEYS.STRINGS, []);

      // 1. Boards
      if (boards.length > 0) {
        const { error: bErr } = await supabase.from('boards').upsert(
          boards.map(b => ({
            id: b.id,
            title: b.title,
            episode_number: b.episode_number || 1,
            description: b.description || '',
          })),
          { onConflict: 'id' }
        );
        if (bErr) throw new Error(`Boards table error: ${bErr.message}`);
      }

      // 2. Cards
      if (allCards.length > 0) {
        const cleanCards = allCards.map(c => ({
          id: c.id,
          board_id: c.board_id || 'episode-1-pilot',
          name: c.name || 'Suspect',
          role: c.role || '',
          notes: c.notes || '',
          status: c.status || 'Unknown',
          x: typeof c.x === 'number' ? c.x : 100,
          y: typeof c.y === 'number' ? c.y : 100,
          z_index: typeof c.z_index === 'number' ? c.z_index : 1,
        }));
        const { error: cErr } = await supabase.from('character_cards').upsert(cleanCards, { onConflict: 'id' });
        if (cErr) throw new Error(`Character cards table error: ${cErr.message}`);
      }

      // 3. Stickies
      if (allStickies.length > 0) {
        const cleanStickies = allStickies.map(st => ({
          id: st.id,
          board_id: st.board_id || 'episode-1-pilot',
          content: st.content || '',
          color: st.color || 'parchment',
          x: typeof st.x === 'number' ? st.x : 100,
          y: typeof st.y === 'number' ? st.y : 100,
          author: st.author || '',
        }));
        const { error: stErr } = await supabase.from('sticky_notes').upsert(cleanStickies, { onConflict: 'id' });
        if (stErr) throw new Error(`Sticky notes table error: ${stErr.message}`);
      }

      // 4. Strings
      if (allStrings.length > 0) {
        const cleanStrings = allStrings.map(s => ({
          id: s.id,
          board_id: s.board_id || 'episode-1-pilot',
          source_id: s.source_id,
          target_id: s.target_id,
          label: s.label || '',
        }));
        const { error: sErr } = await supabase.from('string_connections').upsert(cleanStrings, { onConflict: 'id' });
        if (sErr) throw new Error(`String connections table error: ${sErr.message}`);
      }

      return {
        success: true,
        cardsCount: allCards.length,
        stickiesCount: allStickies.length,
        stringsCount: allStrings.length,
      };
    } catch (err: any) {
      console.error('pushAllToSupabase failed:', err);
      return {
        success: false,
        cardsCount: 0,
        stickiesCount: 0,
        stringsCount: 0,
        error: err.message || String(err),
      };
    }
  }
}

export class UserAccountStore {
  private static STORAGE_KEY_USERS = 'tp_saved_user_accounts_v1';
  private static STORAGE_KEY_CURRENT = 'tp_local_user';

  static getSavedAccountsLocal(): UserAccount[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(this.STORAGE_KEY_USERS);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  static setSavedAccountsLocal(users: UserAccount[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.STORAGE_KEY_USERS, JSON.stringify(users));
  }

  static getCurrentUserLocal(): UserAccount | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(this.STORAGE_KEY_CURRENT);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  static setCurrentUserLocal(user: UserAccount | null) {
    if (typeof window === 'undefined') return;
    if (!user) {
      localStorage.removeItem(this.STORAGE_KEY_CURRENT);
    } else {
      localStorage.setItem(this.STORAGE_KEY_CURRENT, JSON.stringify(user));
    }
  }

  // Load all accounts from server and merge with local
  static async loadAllAccounts(): Promise<UserAccount[]> {
    try {
      const res = await fetch(getApiUrl('/api/users'));
      if (res.ok) {
        const serverUsers = await res.json();
        if (Array.isArray(serverUsers) && serverUsers.length > 0) {
          this.setSavedAccountsLocal(serverUsers);
          return serverUsers;
        }
      }
    } catch (err) {
      console.warn('Failed to load accounts from server:', err);
    }
    return this.getSavedAccountsLocal();
  }

  // Register or save an account
  static async registerAccount(accountData: {
    name: string;
    email: string;
    password?: string;
    avatar?: string;
    badge_title?: string;
    department?: string;
    favorite_quote?: string;
  }): Promise<UserAccount> {
    try {
      const res = await fetch(getApiUrl('/api/users/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountData),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          this.saveLocalAccount(json.user);
          return json.user;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Registration failed');
      }
    } catch (err) {
      console.warn('Server registration failed, creating locally:', err);
    }

    // Fallback local registration
    const newAcc: UserAccount = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: accountData.name.trim(),
      email: accountData.email.toLowerCase().trim(),
      avatar: accountData.avatar || '🌲',
      badge_title: accountData.badge_title || 'Special Agent',
      department: accountData.department || 'Sheriff Dispatch',
      favorite_quote: accountData.favorite_quote || 'The owls are not what they seem.',
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
    };
    this.saveLocalAccount(newAcc);
    return newAcc;
  }

  // Login with existing account
  static async loginAccount(email: string, password?: string): Promise<UserAccount> {
    try {
      const res = await fetch(getApiUrl('/api/users/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          this.saveLocalAccount(json.user);
          return json.user;
        }
      } else {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Login failed');
      }
    } catch (err: any) {
      // If error was thrown with specific message, rethrow
      if (err.message && err.message !== 'Failed to fetch') {
        throw err;
      }
      console.warn('Server login failed, trying local store:', err);
    }

    const localUsers = this.getSavedAccountsLocal();
    const found = localUsers.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (found) {
      found.last_login = new Date().toISOString();
      this.saveLocalAccount(found);
      return found;
    }

    throw new Error('No account found with this badge email.');
  }

  // Update profile
  static async updateProfile(email: string, updates: Partial<UserAccount>): Promise<UserAccount> {
    try {
      const res = await fetch(getApiUrl(`/api/users/${encodeURIComponent(email)}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.user) {
          this.saveLocalAccount(json.user);
          return json.user;
        }
      }
    } catch (err) {
      console.warn('Server update profile failed:', err);
    }

    const localUsers = this.getSavedAccountsLocal();
    const index = localUsers.findIndex(u => u.email.toLowerCase() === email.toLowerCase().trim());
    if (index !== -1) {
      localUsers[index] = { ...localUsers[index], ...updates };
      this.setSavedAccountsLocal(localUsers);
      return localUsers[index];
    }

    throw new Error('Account not found');
  }

  private static saveLocalAccount(user: UserAccount) {
    const list = this.getSavedAccountsLocal();
    const idx = list.findIndex(u => u.email.toLowerCase() === user.email.toLowerCase());
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...user };
    } else {
      list.push(user);
    }
    this.setSavedAccountsLocal(list);
    this.setCurrentUserLocal(user);
  }
}

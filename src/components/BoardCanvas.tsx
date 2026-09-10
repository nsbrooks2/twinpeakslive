import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  CharacterCard, 
  EpisodeBoard, 
  StringConnection, 
  StickyNote, 
  PresenceUser,
  UserAccount
} from '../types';
import { BoardRepository, UserAccountStore } from '../lib/boardStore';
import { getSupabase } from '../lib/supabase';
import { TWIN_PEAKS_ROSTER_PRESETS } from '../seedData';
import { CharacterCardItem } from './CharacterCardItem';
import { StickyNoteItem } from './StickyNoteItem';
import { RedStringCanvas } from './RedStringCanvas';
import { PresenceBadge } from './PresenceBadge';
import { EpisodeSelectorModal } from './EpisodeSelectorModal';
import { CarryOverModal } from './CarryOverModal';
import { UserProfileModal } from './UserProfileModal';
import { ShareModal } from './ShareModal';
import { VideoChatPanel } from './VideoChatPanel';
import { WatchPartyModal } from './WatchPartyModal';
import { WebRTCProvider } from '../context/WebRTCContext';
import { getSupabaseCredentials, saveSupabaseCredentials, testSupabaseConnection } from '../lib/supabase';
import { realtimeClient, WatchPartySyncPayload } from '../lib/realtimeClient';
import { 
  Plus, 
  StickyNote as StickyIcon, 
  Link2, 
  Search, 
  RotateCcw, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Tv, 
  Film, 
  Coffee, 
  Shield, 
  LogOut, 
  Sparkles,
  Info,
  Layers,
  ChevronDown,
  Wifi,
  WifiOff,
  Settings,
  ArrowRightLeft,
  Share2
} from 'lucide-react';

interface CanvasProps {
  currentUser: UserAccount;
  onSignOut: () => void;
  onUserUpdated?: (user: UserAccount) => void;
}

export const BoardCanvas: React.FC<CanvasProps> = ({ currentUser, onSignOut, onUserUpdated }) => {
  // Boards & Active Board
  const [boards, setBoards] = useState<EpisodeBoard[]>([]);
  const [activeBoardId, setActiveBoardId] = useState<string>('');
  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
  const [isCarryOverModalOpen, setIsCarryOverModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [allAccounts, setAllAccounts] = useState<UserAccount[]>([]);
  const [isWatchPartyOpen, setIsWatchPartyOpen] = useState(false);
  const [activeScreeningAlert, setActiveScreeningAlert] = useState<{
    isPlaying: boolean;
    episodeNumber: number;
    updatedBy: string;
    currentTime: number;
  } | null>(null);

  // Board items
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [strings, setStrings] = useState<StringConnection[]>([]);
  const [stickies, setStickies] = useState<StickyNote[]>([]);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);

  // String Creation Mode
  const [stringSourceCardId, setStringSourceCardId] = useState<string | null>(null);

  // Filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Suspect' | 'Unknown' | 'Cleared' | 'Victim'>('All');

  // Add Card Modal
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [newCardName, setNewCardName] = useState('');
  const [newCardRole, setNewCardRole] = useState('');
  const [newCardStatus, setNewCardStatus] = useState<'Unknown' | 'Suspect' | 'Cleared' | 'Victim'>('Unknown');
  const [newCardNotes, setNewCardNotes] = useState('');

  const openAddCardModal = () => {
    setSelectedPresetId('');
    setNewCardName('');
    setNewCardRole('');
    setNewCardStatus('Unknown');
    setNewCardNotes('');
    setIsAddCardOpen(true);
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    if (!presetId || presetId === 'custom') {
      if (presetId === 'custom') {
        setNewCardName('');
        setNewCardRole('');
        setNewCardStatus('Unknown');
      }
      return;
    }
    const preset = TWIN_PEAKS_ROSTER_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setNewCardName(preset.name);
      setNewCardRole(preset.role);
      if (preset.defaultStatus) {
        setNewCardStatus(preset.defaultStatus);
      }
    }
  };

  // Canvas Viewport Pan & Zoom
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: -200, y: -50 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Supabase Connection Status & Settings Modal
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [isConnModalOpen, setIsConnModalOpen] = useState<boolean>(false);
  const [connUrl, setConnUrl] = useState<string>('');
  const [connKey, setConnKey] = useState<string>('');
  const [connStatusMessage, setConnStatusMessage] = useState<string>('');
  const [isTestingConn, setIsTestingConn] = useState<boolean>(false);

  useEffect(() => {
    const creds = getSupabaseCredentials();
    setConnUrl(creds.url);
    setConnKey(creds.key);
    if (creds.url && creds.key) {
      testSupabaseConnection().then((res) => {
        setSupabaseConnected(res.ok);
        if (res.ok) {
          setConnStatusMessage('Live database connected & syncing.');
        } else {
          setConnStatusMessage(res.message || 'Connection pending.');
        }
      });
    } else {
      setSupabaseConnected(false);
      setConnStatusMessage('Operating in offline/local storage mode.');
    }

    // Load accounts list
    UserAccountStore.loadAllAccounts().then((accs) => {
      setAllAccounts(accs);
    });
  }, []);

  const handleUpdateProfile = async (updates: Partial<UserAccount>) => {
    const updated = await UserAccountStore.updateProfile(currentUser.email, updates);
    if (onUserUpdated) {
      onUserUpdated(updated);
    }
    const accs = await UserAccountStore.loadAllAccounts();
    setAllAccounts(accs);
  };

  const handleSelectSavedAccount = (account: UserAccount) => {
    UserAccountStore.setCurrentUserLocal(account);
    if (onUserUpdated) {
      onUserUpdated(account);
    }
    setIsProfileModalOpen(false);
  };

  // Dragging cards / stickies
  const draggingItemRef = useRef<{
    id: string;
    type: 'card' | 'sticky';
    startX: number;
    startY: number;
    initialX: number;
    initialY: number;
  } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const CANVAS_WIDTH = 3200;
  const CANVAS_HEIGHT = 2200;

  // Active board object
  const activeBoard = boards.find((b) => b.id === activeBoardId) || boards[0];
  const currentEpNumber = activeBoard?.episode_number || (
    activeBoard?.title?.toLowerCase().includes('episode 5') || activeBoard?.id?.includes('episode-5') || activeBoardId?.includes('episode-5') ? 5 :
    activeBoard?.title?.toLowerCase().includes('episode 4') || activeBoard?.id?.includes('episode-4') || activeBoardId?.includes('episode-4') ? 4 :
    activeBoard?.title?.toLowerCase().includes('episode 3') || activeBoard?.id?.includes('episode-3') || activeBoardId?.includes('episode-3') ? 3 :
    activeBoard?.title?.toLowerCase().includes('episode 2') || activeBoard?.id?.includes('episode-2') || activeBoardId?.includes('episode-2') ? 2 : 1
  );

  // 1. Initial Load of Boards
  useEffect(() => {
    async function init() {
      const allBoards = await BoardRepository.loadBoards();
      setBoards(allBoards);
      if (allBoards.length > 0) {
        setActiveBoardId(allBoards[0].id);
      }
    }
    init();
  }, []);

  // 2. Load Active Board Items and Setup Realtime Sync
  useEffect(() => {
    if (!activeBoardId) return;

    let isMounted = true;
    BoardRepository.loadBoardDetails(activeBoardId).then((data) => {
      if (!isMounted) return;
      setCards(data.cards);
      setStrings(data.strings);
      setStickies(data.stickies);
    });

    // 1. WebSocket Server Realtime Integration
    realtimeClient.joinPresence(currentUser, activeBoardId, isWatchPartyOpen);

    const unsubPresence = realtimeClient.on('presence:update', (data) => {
      if (Array.isArray(data.onlineUsers)) {
        setPresenceUsers(data.onlineUsers);
      }
    });

    const unsubCardMove = realtimeClient.on('card:move', (event) => {
      setCards((prev) =>
        prev.map((c) => (c.id === event.id ? { ...c, x: event.x, y: event.y } : c))
      );
    });

    const unsubCardUpsert = realtimeClient.on('card:upsert', (event) => {
      if (event.card) {
        setCards((prev) => {
          const idx = prev.findIndex((c) => c.id === event.card.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = event.card;
            return updated;
          }
          return [...prev, event.card];
        });
      }
    });

    const unsubCardDelete = realtimeClient.on('card:delete', (event) => {
      setCards((prev) => prev.filter((c) => c.id !== event.id));
      setStrings((prev) =>
        prev.filter((s) => s.source_id !== event.id && s.target_id !== event.id)
      );
    });

    const unsubStringUpsert = realtimeClient.on('string:upsert', (event) => {
      if (event.string) {
        setStrings((prev) => {
          const idx = prev.findIndex((s) => s.id === event.string.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = event.string;
            return updated;
          }
          return [...prev, event.string];
        });
      }
    });

    const unsubStringDelete = realtimeClient.on('string:delete', (event) => {
      setStrings((prev) => prev.filter((s) => s.id !== event.id));
    });

    const unsubStickyMove = realtimeClient.on('sticky:move', (event) => {
      setStickies((prev) =>
        prev.map((s) => (s.id === event.id ? { ...s, x: event.x, y: event.y } : s))
      );
    });

    const unsubStickyUpsert = realtimeClient.on('sticky:upsert', (event) => {
      if (event.sticky) {
        setStickies((prev) => {
          const idx = prev.findIndex((s) => s.id === event.sticky.id);
          if (idx >= 0) {
            const updated = [...prev];
            updated[idx] = event.sticky;
            return updated;
          }
          return [...prev, event.sticky];
        });
      }
    });

    const unsubStickyDelete = realtimeClient.on('sticky:delete', (event) => {
      setStickies((prev) => prev.filter((s) => s.id !== event.id));
    });

    const unsubPlaybackAlert = realtimeClient.on('watch:playback', (sync: WatchPartySyncPayload) => {
      if (sync.isPlaying && sync.updatedBy !== currentUser.name) {
        setActiveScreeningAlert({
          isPlaying: true,
          episodeNumber: sync.episodeNumber || 1,
          updatedBy: sync.updatedBy,
          currentTime: sync.currentTime,
        });
      } else if (!sync.isPlaying) {
        setActiveScreeningAlert((prev) => (prev ? { ...prev, isPlaying: false } : null));
      }
    });

    // Fetch initial screening state from server
    fetch('/api/screening')
      .then((r) => r.json())
      .then((state) => {
        if (state && state.isPlaying && state.updatedBy !== currentUser.name) {
          setActiveScreeningAlert({
            isPlaying: true,
            episodeNumber: state.episodeNumber || 1,
            updatedBy: state.updatedBy,
            currentTime: state.currentTime,
          });
        }
      })
      .catch(() => {});

    // Supabase Realtime Setup (Secondary fallback)
    const supabase = getSupabase();
    let boardChannel: ReturnType<typeof supabase.channel> | null = null;
    const localBroadcast = new BroadcastChannel(`tp_caseboard_sync_${activeBoardId}`);

    // Handler for incoming sync events
    const handleRemoteEvent = (event: any) => {
      switch (event.type) {
        case 'card:move':
          setCards((prev) =>
            prev.map((c) => (c.id === event.id ? { ...c, x: event.x, y: event.y } : c))
          );
          break;
        case 'card:upsert':
          setCards((prev) => {
            const idx = prev.findIndex((c) => c.id === event.card.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = event.card;
              return updated;
            }
            return [...prev, event.card];
          });
          break;
        case 'card:delete':
          setCards((prev) => prev.filter((c) => c.id !== event.id));
          setStrings((prev) =>
            prev.filter((s) => s.source_id !== event.id && s.target_id !== event.id)
          );
          break;
        case 'string:upsert':
          setStrings((prev) => {
            const idx = prev.findIndex((s) => s.id === event.string.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = event.string;
              return updated;
            }
            return [...prev, event.string];
          });
          break;
        case 'string:delete':
          setStrings((prev) => prev.filter((s) => s.id !== event.id));
          break;
        case 'sticky:move':
          setStickies((prev) =>
            prev.map((s) => (s.id === event.id ? { ...s, x: event.x, y: event.y } : s))
          );
          break;
        case 'sticky:upsert':
          setStickies((prev) => {
            const idx = prev.findIndex((s) => s.id === event.sticky.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = event.sticky;
              return updated;
            }
            return [...prev, event.sticky];
          });
          break;
        case 'sticky:delete':
          setStickies((prev) => prev.filter((s) => s.id !== event.id));
          break;
        case 'presence:ping':
          setPresenceUsers((prev) => {
            const filtered = prev.filter((u) => u.email !== event.user.email);
            return [...filtered, event.user];
          });
          break;
      }
    };

    localBroadcast.onmessage = (e) => {
      handleRemoteEvent(e.data);
    };

    // Announce local presence
    const userPresence: PresenceUser = {
      user_id: currentUser.email,
      email: currentUser.email,
      name: currentUser.name,
      last_seen: new Date().toISOString(),
      board_id: activeBoardId,
    };
    localBroadcast.postMessage({ type: 'presence:ping', user: userPresence });

    if (supabase) {
      boardChannel = supabase.channel(`caseboard:${activeBoardId}`, {
        config: { broadcast: { self: false }, presence: { key: currentUser.email } },
      });

      boardChannel
        .on('broadcast', { event: 'sync' }, ({ payload }) => {
          handleRemoteEvent(payload);
        })
        .on('presence', { event: 'sync' }, () => {
          const state = boardChannel?.presenceState<{ name: string; email: string }>() || {};
          const users: PresenceUser[] = [];
          Object.entries(state).forEach(([key, presences]) => {
            if (Array.isArray(presences) && presences[0]) {
              users.push({
                user_id: key,
                email: (presences[0] as any).email || key,
                name: (presences[0] as any).name || key,
                last_seen: new Date().toISOString(),
                board_id: activeBoardId,
              });
            }
          });
          setPresenceUsers(users);
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await boardChannel?.track({
              name: currentUser.name,
              email: currentUser.email,
              board_id: activeBoardId,
            });
          }
        });
    }

    return () => {
      isMounted = false;
      localBroadcast.close();
      if (supabase && boardChannel) {
        supabase.removeChannel(boardChannel);
      }
      unsubPresence();
      unsubCardMove();
      unsubCardUpsert();
      unsubCardDelete();
      unsubStringUpsert();
      unsubStringDelete();
      unsubStickyMove();
      unsubStickyUpsert();
      unsubStickyDelete();
      unsubPlaybackAlert();
    };
  }, [activeBoardId, currentUser, isWatchPartyOpen]);

  // Broadcast helper
  const broadcastChange = useCallback(
    (event: any) => {
      // 1. Primary: Real-time WebSocket Server Broadcast
      realtimeClient.send(event.type, event);

      // 2. Local broadcast for multi-tab testing
      try {
        const bc = new BroadcastChannel(`tp_caseboard_sync_${activeBoardId}`);
        bc.postMessage(event);
        bc.close();
      } catch (e) {
        console.warn('BroadcastChannel error', e);
      }

      // 3. Supabase broadcast fallback
      const supabase = getSupabase();
      if (supabase && activeBoardId) {
        const channel = supabase.channel(`caseboard:${activeBoardId}`);
        channel.send({
          type: 'broadcast',
          event: 'sync',
          payload: event,
        });
      }
    },
    [activeBoardId]
  );

  // Mouse Handlers for Panning & Dragging
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Left click on background or middle click triggers pan
    if (e.button === 1 || e.target === e.currentTarget || (e.target as HTMLElement).id === 'corkboard-stage') {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        panX: pan.x,
        panY: pan.y,
      };
    }
  };

  const handleCardDragStart = (cardId: string, clientX: number, clientY: number) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;

    draggingItemRef.current = {
      id: cardId,
      type: 'card',
      startX: clientX,
      startY: clientY,
      initialX: card.x,
      initialY: card.y,
    };
  };

  const handleStickyDragStart = (stickyId: string, clientX: number, clientY: number) => {
    const sticky = stickies.find((s) => s.id === stickyId);
    if (!sticky) return;

    draggingItemRef.current = {
      id: stickyId,
      type: 'sticky',
      startX: clientX,
      startY: clientY,
      initialX: sticky.x,
      initialY: sticky.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPan({
        x: panStartRef.current.panX + dx,
        y: panStartRef.current.panY + dy,
      });
      return;
    }

    if (draggingItemRef.current) {
      const { id, type, startX, startY, initialX, initialY } = draggingItemRef.current;
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      const nextX = Math.max(20, Math.min(CANVAS_WIDTH - 300, initialX + dx));
      const nextY = Math.max(20, Math.min(CANVAS_HEIGHT - 300, initialY + dy));

      if (type === 'card') {
        setCards((prev) =>
          prev.map((c) => (c.id === id ? { ...c, x: nextX, y: nextY } : c))
        );
      } else {
        setStickies((prev) =>
          prev.map((s) => (s.id === id ? { ...s, x: nextX, y: nextY } : s))
        );
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (draggingItemRef.current) {
      const { id, type } = draggingItemRef.current;
      if (type === 'card') {
        const card = cards.find((c) => c.id === id);
        if (card) {
          BoardRepository.upsertCard(card);
          broadcastChange({ type: 'card:move', id: card.id, x: card.x, y: card.y });
        }
      } else {
        const sticky = stickies.find((s) => s.id === id);
        if (sticky) {
          BoardRepository.upsertSticky(sticky);
          broadcastChange({ type: 'sticky:move', id: sticky.id, x: sticky.x, y: sticky.y });
        }
      }
      draggingItemRef.current = null;
    }
  };

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(1.8, Math.max(0.4, prev + delta)));
  };

  const resetView = () => {
    setScale(0.85);
    setPan({ x: -100, y: -40 });
  };

  // String connection logic
  const handleSelectCardForString = (cardId: string) => {
    if (!stringSourceCardId) {
      setStringSourceCardId(cardId);
    } else if (stringSourceCardId === cardId) {
      setStringSourceCardId(null); // Deselect if clicking the same card
    } else {
      // Connect source to this card
      const existing = strings.find(
        (s) =>
          (s.source_id === stringSourceCardId && s.target_id === cardId) ||
          (s.source_id === cardId && s.target_id === stringSourceCardId)
      );

      if (existing) {
        setStringSourceCardId(null);
        return;
      }

      const newString: StringConnection = {
        id: `str-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        board_id: activeBoardId,
        source_id: stringSourceCardId,
        target_id: cardId,
        label: 'Connected',
        created_at: new Date().toISOString(),
      };

      setStrings((prev) => [...prev, newString]);
      BoardRepository.upsertString(newString);
      broadcastChange({ type: 'string:upsert', string: newString });
      setStringSourceCardId(null);
    }
  };

  // Card Operations
  const handleUpdateCard = (updated: CharacterCard) => {
    setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    BoardRepository.upsertCard(updated);
    broadcastChange({ type: 'card:upsert', card: updated });
  };

  const handleDeleteCard = (cardId: string) => {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
    setStrings((prev) =>
      prev.filter((s) => s.source_id !== cardId && s.target_id !== cardId)
    );
    BoardRepository.deleteCard(cardId, activeBoardId);
    broadcastChange({ type: 'card:delete', id: cardId });
  };

  const handleAddNewCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCardName.trim()) return;

    // Place near current center of pan viewport
    const viewCenterX = Math.max(100, -pan.x / scale + 300);
    const viewCenterY = Math.max(100, -pan.y / scale + 200);

    const newCard: CharacterCard = {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      board_id: activeBoardId,
      name: newCardName.trim(),
      role: newCardRole.trim() || 'Resident of Twin Peaks',
      notes: newCardNotes.trim(),
      status: newCardStatus,
      x: viewCenterX,
      y: viewCenterY,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    setCards((prev) => [...prev, newCard]);
    BoardRepository.upsertCard(newCard);
    broadcastChange({ type: 'card:upsert', card: newCard });

    setNewCardName('');
    setNewCardRole('');
    setNewCardNotes('');
    setNewCardStatus('Unknown');
    setSelectedPresetId('');
    setIsAddCardOpen(false);
  };

  // String Operations
  const handleUpdateString = (updated: StringConnection) => {
    setStrings((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    BoardRepository.upsertString(updated);
    broadcastChange({ type: 'string:upsert', string: updated });
  };

  const handleDeleteString = (stringId: string) => {
    setStrings((prev) => prev.filter((s) => s.id !== stringId));
    BoardRepository.deleteString(stringId);
    broadcastChange({ type: 'string:delete', id: stringId });
  };

  // Sticky Operations
  const handleAddSticky = () => {
    const viewCenterX = Math.max(80, -pan.x / scale + 250);
    const viewCenterY = Math.max(80, -pan.y / scale + 150);

    const newSticky: StickyNote = {
      id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      board_id: activeBoardId,
      content: '',
      color: 'yellow',
      x: viewCenterX,
      y: viewCenterY,
      author: currentUser.name,
      created_at: new Date().toISOString(),
    };

    setStickies((prev) => [...prev, newSticky]);
    BoardRepository.upsertSticky(newSticky);
    broadcastChange({ type: 'sticky:upsert', sticky: newSticky });
  };

  const handleUpdateSticky = (updated: StickyNote) => {
    setStickies((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    BoardRepository.upsertSticky(updated);
    broadcastChange({ type: 'sticky:upsert', sticky: updated });
  };

  const handleDeleteSticky = (id: string) => {
    setStickies((prev) => prev.filter((s) => s.id !== id));
    BoardRepository.deleteSticky(id);
    broadcastChange({ type: 'sticky:delete', id });
  };

  // Pin theory clue from Watch Party modal directly onto the corkboard
  const handlePinTheoryClue = (theoryText: string) => {
    const viewCenterX = Math.max(80, -pan.x / scale + 260 + (Math.random() * 60 - 30));
    const viewCenterY = Math.max(80, -pan.y / scale + 180 + (Math.random() * 60 - 30));

    const newSticky: StickyNote = {
      id: `sticky-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      board_id: activeBoardId,
      content: theoryText,
      color: 'crimson',
      x: viewCenterX,
      y: viewCenterY,
      author: currentUser.name,
      created_at: new Date().toISOString(),
    };

    setStickies((prev) => [...prev, newSticky]);
    BoardRepository.upsertSticky(newSticky);
    broadcastChange({ type: 'sticky:upsert', sticky: newSticky });
  };

  // Board creation
  const handleCreateBoard = async (params: {
    title: string;
    episodeNumber: number;
    description?: string;
    duplicateFromBoardId?: string;
  }) => {
    const newBoard = await BoardRepository.createBoard(params);
    setBoards((prev) => [...prev, newBoard]);
    setActiveBoardId(newBoard.id);
  };

  // Carry over / transfer evidence between episode boards
  const handleCarryOverEvidence = async (params: {
    sourceBoardId: string;
    targetBoardId: string;
    mode: 'merge' | 'replace';
    items: Array<'cards' | 'strings' | 'stickies'>;
  }) => {
    await BoardRepository.carryOverEvidence(params);

    // If the active board is either the source or the target, reload the active board's contents
    const activeData = await BoardRepository.loadBoardDetails(activeBoardId);
    setCards(activeData.cards);
    setStrings(activeData.strings);
    setStickies(activeData.stickies);

    // If target was different, and user wants to navigate to it:
    if (params.targetBoardId !== activeBoardId) {
      setActiveBoardId(params.targetBoardId);
    }
  };

  // Filtered Cards
  const filteredCards = cards.filter((card) => {
    const matchesSearch =
      card.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      card.notes.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'All' || card.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Source card for active string connecting
  const activeSourceCard = cards.find((c) => c.id === stringSourceCardId);

  // Partner user currently connected or default name
  const partnerUser = presenceUsers.find((p) => p.email !== currentUser.email);
  const defaultPartnerName = currentUser.name.toLowerCase().includes('cooper') || currentUser.name.toLowerCase().includes('dale')
    ? 'Girlfriend'
    : 'Special Agent Dale Cooper';

  return (
    <WebRTCProvider
      currentUserId={currentUser.email}
      partnerName={partnerUser?.name || defaultPartnerName}
      boardId={activeBoardId || 'episode-1-pilot'}
    >
      <div className="relative w-screen h-screen overflow-hidden bg-[#0c0705] flex flex-col select-none">
      {/* 1. TOP SHERIFF'S STATION NAVBAR */}
      <header className="relative z-30 h-16 bg-[#160d0a] border-b-2 border-[#4a2e20] px-4 flex items-center justify-between shadow-lg">
        {/* Left: App Title & Episode Selector */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">☕</span>
            <div>
              <h1 className="font-display font-black text-sm sm:text-base text-[#f5ebd4] tracking-widest leading-none">
                DAMN FINE CASE BOARD
              </h1>
              <span className="font-typewriter text-[9px] text-[#b89f89] tracking-wider uppercase">
                Twin Peaks Sheriff's Dept • 2-Person Private Board
              </span>
            </div>
          </div>

          {/* Episode Switcher Dropdown Button */}
          <button
            onClick={() => setIsEpisodeModalOpen(true)}
            className="flex items-center gap-2 bg-[#25150f] hover:bg-[#382017] border border-[#5a3928] text-[#f5ebd4] px-3 py-1.5 rounded-lg text-xs font-typewriter transition-all shadow cursor-pointer group"
            title="Switch or create episode investigation boards"
          >
            <Film className="w-3.5 h-3.5 text-[#e5c158]" />
            <span className="font-bold max-w-[140px] sm:max-w-[200px] truncate">
              {activeBoard?.title || 'Episode 1: Pilot'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#b89f89] group-hover:translate-y-0.5 transition-transform" />
          </button>

          {/* Synchronized Watch Party Trigger Button */}
          <button
            onClick={() => setIsWatchPartyOpen(true)}
            className="flex items-center gap-1.5 bg-gradient-to-r from-[#83161c] to-[#991b1b] hover:from-[#991b1b] hover:to-[#b91c1c] text-[#fdf2f2] px-3.5 py-1.5 rounded-lg text-xs font-typewriter font-bold shadow-[0_0_15px_rgba(185,28,28,0.4)] border border-[#e5c158]/50 transition-all cursor-pointer hover:scale-105"
            title={`Watch Episode ${currentEpNumber} together with synchronized play/pause, live chat, and timeline clues`}
          >
            <Tv className="w-4 h-4 text-[#e5c158] animate-pulse" />
            <span className="tracking-wide">Watch Ep. {currentEpNumber}</span>
            <span className="bg-black/40 text-[#e5c158] text-[9px] px-1.5 py-0.2 rounded font-mono hidden md:inline">
              SYNC
            </span>
          </button>
        </div>

        {/* Center: String Connection Notification if active */}
        {stringSourceCardId && (
          <div className="hidden md:flex items-center gap-2 bg-red-950 border border-red-700 text-red-200 px-3 py-1 rounded-full text-xs font-typewriter animate-pulse">
            <Link2 className="w-3.5 h-3.5 text-red-400" />
            <span>Click any target card to tie red string from "{activeSourceCard?.name}"</span>
            <button
              onClick={() => setStringSourceCardId(null)}
              className="ml-2 underline text-white hover:text-red-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Right: Cloud Sync Status, Presence Indicator, Video trigger, & Sign out */}
        <div className="flex items-center gap-3">
          {/* Supabase Realtime Connection Badge & Quick Settings */}
          <button
            onClick={() => setIsConnModalOpen(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-typewriter border transition-all cursor-pointer ${
              supabaseConnected
                ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/80'
                : 'bg-amber-950/40 border-amber-800/60 text-amber-300 hover:bg-amber-900/60'
            }`}
            title="Click to check or update Supabase Realtime database connection"
          >
            {supabaseConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="hidden sm:inline">Supabase Synced</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <WifiOff className="w-3 h-3 text-amber-400" />
                <span className="hidden sm:inline">Offline / Local</span>
              </>
            )}
            <Settings className="w-3 h-3 opacity-60 ml-0.5 hover:opacity-100" />
          </button>

          <PresenceBadge
            currentUser={currentUser}
            presenceUsers={presenceUsers}
            boardTitle={activeBoard?.title || 'Investigation'}
          />

          {/* Share & Publish Access Link Button */}
          <button
            onClick={() => setIsShareModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#83161c] hover:bg-[#991b1b] border border-[#b91c1c] text-[#fdf2f2] rounded-full text-xs font-typewriter uppercase tracking-wider font-bold shadow-md transition-all hover:scale-105 cursor-pointer"
            title="Publish and share site link with girlfriend or anyone"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Share Link</span>
          </button>

          <div className="h-6 w-[1px] bg-[#3e2518]" />

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1 bg-[#25150f] hover:bg-[#382017] border border-[#4a2e20] hover:border-[#e5c158] rounded-full transition-all cursor-pointer shadow-sm text-left group"
              title="Click to manage Officer Account, change name, avatar, rank or switch account"
            >
              <span className="text-sm select-none">{currentUser.avatar || '🌲'}</span>
              <span className="hidden sm:inline font-typewriter text-xs text-[#cfb69b] group-hover:text-[#f5ebd4]">
                <span className="text-[#f5ebd4] font-bold group-hover:text-[#e5c158]">{currentUser.name}</span>
              </span>
              <Settings className="w-3 h-3 text-[#96775d] group-hover:text-[#e5c158] transition-colors" />
            </button>
            <button
              onClick={onSignOut}
              className="p-1.5 bg-[#25150f] hover:bg-[#3b1d12] border border-[#4a2e20] text-[#cfb69b] hover:text-red-400 rounded transition-colors cursor-pointer"
              title="Lock station dossier / sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Synchronized Screening Alert Banner */}
      {activeScreeningAlert && !isWatchPartyOpen && (
        <div className="relative z-30 bg-gradient-to-r from-[#2e0e09] via-[#4d1610] to-[#2e0e09] border-b-2 border-[#b91c1c] px-4 py-2 flex items-center justify-between shadow-xl animate-fadeIn text-xs font-typewriter">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
            </span>
            <span className="text-[#f5ebd4] font-bold tracking-wide">
              📼 <span className="text-amber-300">{activeScreeningAlert.updatedBy}</span> is screening Episode {activeScreeningAlert.episodeNumber}!
            </span>
            <span className="bg-[#180e0a] text-emerald-400 px-2 py-0.5 rounded border border-[#5a3928] text-[11px] font-mono">
              {activeScreeningAlert.isPlaying ? '▶ Playing Live on Server' : '⏸ Paused'}
            </span>
          </div>
          <button
            onClick={() => setIsWatchPartyOpen(true)}
            className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] font-bold px-3.5 py-1 rounded-lg border border-[#b91c1c] shadow-[0_0_12px_rgba(185,28,28,0.5)] cursor-pointer transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95 text-xs font-typewriter uppercase tracking-wider"
          >
            <span>Join Screening Room</span>
            <span>▶</span>
          </button>
        </div>
      )}

      {/* 2. SUB-TOOLBAR: Filters, Search, and Whiteboard Actions */}
      <div className="relative z-20 h-12 bg-[#1b100b] border-b border-[#3e2518] px-4 flex items-center justify-between gap-3 text-xs font-typewriter overflow-x-auto">
        {/* Left: Quick Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={openAddCardModal}
            className="bg-[#83161c] hover:bg-[#991b1b] active:bg-[#6e1217] text-[#fdf2f2] px-3 py-1.5 rounded flex items-center gap-1.5 border border-[#b91c1c] transition-colors cursor-pointer shadow-sm font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Character Card</span>
          </button>

          <button
            onClick={handleAddSticky}
            className="bg-[#2a1b12] hover:bg-[#3d271a] text-[#f5ebd4] px-3 py-1.5 rounded flex items-center gap-1.5 border border-[#5a3928] transition-colors cursor-pointer shadow-sm"
            title="Post a freeform theory or clue sticky note"
          >
            <StickyIcon className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Theory Note</span>
          </button>

          {/* Quick string mode trigger */}
          <button
            onClick={() => {
              if (cards.length >= 2) {
                setStringSourceCardId(cards[0].id);
              }
            }}
            className={`px-3 py-1.5 rounded flex items-center gap-1.5 border transition-colors cursor-pointer shadow-sm ${
              stringSourceCardId
                ? 'bg-red-950 text-red-200 border-red-700'
                : 'bg-[#2a1b12] hover:bg-[#3d271a] text-[#f5ebd4] border-[#5a3928]'
            }`}
            title="Connect character cards with red yarn"
          >
            <Link2 className="w-3.5 h-3.5 text-red-500" />
            <span>Tie Red Yarn</span>
          </button>

          {/* Carry Over / Import Evidence Across Episodes Button */}
          <button
            onClick={() => setIsCarryOverModalOpen(true)}
            className="bg-[#241610] hover:bg-[#382017] text-[#e5c158] hover:text-[#fbf0b9] px-3 py-1.5 rounded flex items-center gap-1.5 border border-[#6b4530] hover:border-[#bfa265] transition-all cursor-pointer shadow-sm"
            title="Carry over evidence to the next episode, or bring evidence from another episode into this one"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
            <span>Carry Over Evidence</span>
          </button>
        </div>

        {/* Center: Search & Status Filters */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-[#8f745f]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter names/clues..."
              className="bg-[#100906] text-[#e8dfd8] text-xs pl-8 pr-3 py-1 rounded border border-[#44281a] focus:outline-none focus:border-[#b91c1c] w-36 sm:w-48 placeholder:text-[#6a5342]"
            />
          </div>

          <div className="hidden lg:flex items-center gap-1 bg-[#100906] p-0.5 rounded border border-[#44281a]">
            {(['All', 'Suspect', 'Unknown', 'Cleared', 'Victim'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-2 py-0.5 rounded text-[11px] transition-colors ${
                  statusFilter === st
                    ? 'bg-[#3b2014] text-[#f5ebd4] font-bold shadow'
                    : 'text-[#8f745f] hover:text-[#d8c5ad]'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Right: View Controls (Zoom In, Zoom Out, Recenter) */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => handleZoom(0.1)}
            className="p-1.5 bg-[#25150f] hover:bg-[#3b1d12] border border-[#44281a] text-[#cfb69b] rounded transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleZoom(-0.1)}
            className="p-1.5 bg-[#25150f] hover:bg-[#3b1d12] border border-[#44281a] text-[#cfb69b] rounded transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 bg-[#25150f] hover:bg-[#3b1d12] border border-[#44281a] text-[#cfb69b] rounded transition-colors flex items-center gap-1"
            title="Reset board viewport view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[10px]">Center</span>
          </button>
        </div>
      </div>

      {/* 3. MAIN CORKBOARD CANVAS VIEWPORT */}
      <main
        ref={canvasContainerRef}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`relative flex-1 overflow-hidden select-none bg-black-lodge-chevron ${
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        }`}
      >
        {/* Red curtain side trims evoking the Black Lodge */}
        <div className="absolute inset-y-0 left-0 w-4 md:w-8 bg-red-curtain pointer-events-none z-20 border-r border-[#3e080c] opacity-85" />
        <div className="absolute inset-y-0 right-0 w-4 md:w-8 bg-red-curtain pointer-events-none z-20 border-l border-[#3e080c] opacity-85" />

        {/* Transform container for pan and zoom */}
        <div
          id="corkboard-stage"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            width: CANVAS_WIDTH,
            height: CANVAS_HEIGHT,
          }}
          className="relative bg-corkboard border-wood-frame shadow-2xl transition-transform duration-75 ease-out"
        >
          {/* Subtle wooden wall backing & cork pin holes */}
          <div className="absolute top-4 left-6 pointer-events-none opacity-40 font-typewriter text-xs text-[#d6c2ab] tracking-widest uppercase">
            Sheriff Harry S. Truman • Master Evidence Board • {activeBoard?.title}
          </div>

          {/* SVG Yarn Red String Layer */}
          <RedStringCanvas
            strings={strings}
            cards={cards}
            selectedSourceCardId={stringSourceCardId}
            onSelectTargetCard={handleSelectCardForString}
            onUpdateString={handleUpdateString}
            onDeleteString={handleDeleteString}
            canvasWidth={CANVAS_WIDTH}
            canvasHeight={CANVAS_HEIGHT}
          />

          {/* Draggable Character Cards */}
          {filteredCards.map((card) => (
            <CharacterCardItem
              key={card.id}
              card={card}
              isSelectedForString={stringSourceCardId === card.id}
              onSelectForString={handleSelectCardForString}
              onUpdate={handleUpdateCard}
              onDelete={handleDeleteCard}
              onDragStart={handleCardDragStart}
            />
          ))}

          {/* Empty Corkboard Guidance when no cards exist yet */}
          {cards.length === 0 && (
            <div
              style={{
                left: 780,
                top: 260,
              }}
              className="absolute z-10 w-[500px] max-w-[90vw] bg-[#160d09]/95 border-2 border-dashed border-[#5a3928] rounded-2xl p-7 text-center shadow-2xl backdrop-blur-md select-none"
            >
              <div className="flex justify-center items-center gap-3 text-3xl mb-3">
                <span>🌲</span>
                <span className="text-4xl animate-bounce">☕</span>
                <span>📌</span>
              </div>
              <h3 className="font-display font-bold text-lg sm:text-xl text-[#f5ebd4] tracking-widest mb-1.5 uppercase">
                CASE DOSSIER OPEN • NO CARDS PINNED
              </h3>
              <p className="font-editorial italic text-xs sm:text-sm text-[#b89f89] mb-6 leading-relaxed max-w-sm mx-auto">
                The board is clean. Start your investigation by selecting characters from the roster or pinning your own custom notes.
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <button
                  onClick={openAddCardModal}
                  className="inline-flex items-center gap-2 bg-[#83161c] hover:bg-[#991b1b] active:bg-[#6e1217] text-[#fdf2f2] px-4 py-2 rounded-lg border border-[#b91c1c] font-typewriter text-xs uppercase tracking-wider font-bold shadow-lg transition-all cursor-pointer hover:scale-105"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Create Character Card</span>
                </button>
                <button
                  onClick={handleAddSticky}
                  className="inline-flex items-center gap-1.5 bg-[#25150f] hover:bg-[#382017] text-[#f5ebd4] px-3.5 py-2 rounded-lg border border-[#5a3928] font-typewriter text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  <StickyIcon className="w-3.5 h-3.5 text-amber-400" />
                  <span>+ Theory Note</span>
                </button>
                <button
                  onClick={() => setIsWatchPartyOpen(true)}
                  className="inline-flex items-center gap-1.5 bg-[#1b1e16] hover:bg-[#252b1e] text-[#a7f3d0] px-3.5 py-2 rounded-lg border border-[#065f46] font-typewriter text-xs uppercase tracking-wider transition-all cursor-pointer shadow"
                >
                  <Tv className="w-3.5 h-3.5 text-emerald-400" />
                  <span>📼 Watch Ep. {currentEpNumber} Together</span>
                </button>
              </div>
            </div>
          )}

          {/* Free-floating Draggable Sticky Notes */}
          {stickies.map((sticky) => (
            <StickyNoteItem
              key={sticky.id}
              note={sticky}
              onUpdate={handleUpdateSticky}
              onDelete={handleDeleteSticky}
              onDragStart={handleStickyDragStart}
            />
          ))}
        </div>

        {/* Mini HUD in bottom-left */}
        <div className="absolute bottom-4 left-6 z-20 pointer-events-none flex items-center gap-3">
          <div className="bg-[#1a0f0b]/90 border border-[#3e2216] px-3 py-1.5 rounded-lg text-[11px] font-typewriter text-[#c2ab95] shadow backdrop-blur-sm">
            <span>Cards: {cards.length}</span>
            <span className="mx-2">•</span>
            <span>Strings: {strings.length}</span>
            <span className="mx-2">•</span>
            <span>Theories: {stickies.length}</span>
          </div>
          <div className="hidden sm:block text-[11px] font-editorial italic text-[#8f745f]">
            Drag background or use wheel to navigate • Click card link icon to string
          </div>
        </div>
      </main>

      {/* 4. MODALS & FLOATING PANELS */}
      {/* New Character Card Modal with Roster Dropdown */}
      {isAddCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#1a0f0b] border-2 border-[#5a3928] rounded-2xl p-6 shadow-2xl text-[#f5ebd4] max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#382216] mb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-[#f5ebd4] tracking-wide flex items-center gap-2">
                  <span>📌</span>
                  <span>Pin Character to Case Board</span>
                </h3>
                <p className="font-editorial italic text-xs text-[#a08774] mt-0.5">
                  Select a character from the roster dropdown to auto-fill, or enter a custom resident.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCardOpen(false)}
                className="text-[#8f745f] hover:text-[#f5ebd4] p-1 text-lg font-mono leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewCard} className="space-y-4">
              {/* Dropdown Selector */}
              <div>
                <label className="block font-typewriter text-xs uppercase text-[#cfb69b] mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <span>☕</span>
                    <span>Twin Peaks Character Dropdown</span>
                  </span>
                  <span className="text-[10px] text-[#8f745f] lowercase font-editorial">select to populate</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedPresetId}
                    onChange={(e) => handlePresetChange(e.target.value)}
                    className="w-full bg-[#100806] border border-[#5a3928] rounded-lg px-3 py-2 text-sm text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c] cursor-pointer appearance-none pr-9 font-sans transition-colors"
                  >
                    <option value="">— Select a character from Twin Peaks roster —</option>
                    <option value="custom">✏️ Custom Character / Other Town Resident</option>
                    
                    {Array.from(new Set(TWIN_PEAKS_ROSTER_PRESETS.map((p) => p.category))).map((cat) => (
                      <optgroup key={cat} label={`── ${cat} ──`} className="bg-[#1a0f0b] text-[#cfb69b] font-bold">
                        {TWIN_PEAKS_ROSTER_PRESETS.filter((p) => p.category === cat).map((char) => (
                          <option key={char.id} value={char.id} className="text-[#f5ebd4] bg-[#140b08] font-normal">
                            {char.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-[#cfb69b] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Character Full Name */}
              <div>
                <label className="block font-typewriter text-xs uppercase text-[#cfb69b] mb-1 flex items-center justify-between">
                  <span>Character Full Name <span className="text-red-400">*</span></span>
                  {selectedPresetId && selectedPresetId !== 'custom' && (
                    <span className="text-[10px] text-emerald-400/80 font-typewriter">auto-filled</span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCardName}
                  onChange={(e) => setNewCardName(e.target.value)}
                  placeholder="e.g. Sheriff Harry S. Truman"
                  className="w-full bg-[#100806] border border-[#44281a] rounded-lg px-3 py-2 text-sm text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c] placeholder:text-[#6a5342]"
                />
              </div>

              {/* Character Role / Description */}
              <div>
                <label className="block font-typewriter text-xs uppercase text-[#cfb69b] mb-1">
                  Neutral Role / One-Line Description
                </label>
                <input
                  type="text"
                  value={newCardRole}
                  onChange={(e) => setNewCardRole(e.target.value)}
                  placeholder="e.g. Twin Peaks sheriff cooperating with Agent Cooper"
                  className="w-full bg-[#100806] border border-[#44281a] rounded-lg px-3 py-2 text-sm text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c] placeholder:text-[#6a5342]"
                />
              </div>

              {/* Initial Status Pushpin Selector */}
              <div>
                <label className="block font-typewriter text-xs uppercase text-[#cfb69b] mb-1.5">
                  Initial Pushpin Status
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Unknown', 'Suspect', 'Cleared', 'Victim'] as const).map((st) => {
                    const isSelected = newCardStatus === st;
                    const styleMap = {
                      Unknown: isSelected
                        ? 'border-amber-600 bg-amber-950/60 text-amber-200 ring-1 ring-amber-500 font-bold'
                        : 'border-[#382216] bg-[#100806] text-[#8f745f] hover:text-[#d8c5ad]',
                      Suspect: isSelected
                        ? 'border-red-600 bg-red-950/60 text-red-200 ring-1 ring-red-500 font-bold'
                        : 'border-[#382216] bg-[#100806] text-[#8f745f] hover:text-[#d8c5ad]',
                      Cleared: isSelected
                        ? 'border-emerald-600 bg-emerald-950/60 text-emerald-200 ring-1 ring-emerald-500 font-bold'
                        : 'border-[#382216] bg-[#100806] text-[#8f745f] hover:text-[#d8c5ad]',
                      Victim: isSelected
                        ? 'border-purple-600 bg-purple-950/60 text-purple-200 ring-1 ring-purple-500 font-bold'
                        : 'border-[#382216] bg-[#100806] text-[#8f745f] hover:text-[#d8c5ad]',
                    };
                    const dotMap = {
                      Unknown: 'bg-amber-500',
                      Suspect: 'bg-red-500',
                      Cleared: 'bg-emerald-500',
                      Victim: 'bg-purple-500',
                    };

                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setNewCardStatus(st)}
                        className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg border text-xs font-typewriter transition-all cursor-pointer ${styleMap[st]}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${dotMap[st]}`} />
                        <span>{st}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Initial Notes */}
              <div>
                <label className="block font-typewriter text-xs uppercase text-[#cfb69b] mb-1 flex items-center justify-between">
                  <span>Initial Clues / Case Notes</span>
                  <span className="text-[10px] text-[#8f745f] lowercase font-editorial">optional</span>
                </label>
                <textarea
                  rows={2}
                  value={newCardNotes}
                  onChange={(e) => setNewCardNotes(e.target.value)}
                  placeholder="Notes on alibis, relationships, strange behaviors, or whereabouts..."
                  className="w-full bg-[#100806] border border-[#44281a] rounded-lg px-3 py-2 text-xs text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c] resize-none placeholder:text-[#6a5342]"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#382216]">
                <button
                  type="button"
                  onClick={() => setIsAddCardOpen(false)}
                  className="font-typewriter text-xs px-4 py-2 text-[#a08774] hover:text-[#f5ebd4] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] font-typewriter text-xs uppercase tracking-wider px-5 py-2 rounded-lg border border-[#b91c1c] shadow-lg cursor-pointer flex items-center gap-2 font-bold transition-all hover:scale-105"
                >
                  <span>📌 Pin to Corkboard</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Episode Selector & Duplicator Modal */}
      <EpisodeSelectorModal
        isOpen={isEpisodeModalOpen}
        onClose={() => setIsEpisodeModalOpen(false)}
        boards={boards}
        activeBoardId={activeBoardId}
        onSelectBoard={(id) => setActiveBoardId(id)}
        onCreateBoard={handleCreateBoard}
        onOpenCarryOver={() => setIsCarryOverModalOpen(true)}
      />

      {/* Carry Over / Import Evidence Across Episodes Modal */}
      <CarryOverModal
        isOpen={isCarryOverModalOpen}
        onClose={() => setIsCarryOverModalOpen(false)}
        boards={boards}
        currentBoardId={activeBoardId}
        onCarryOver={handleCarryOverEvidence}
      />

      {/* Officer Dossier & Account Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        currentUser={currentUser}
        onUpdateProfile={handleUpdateProfile}
        onSwitchAccount={onSignOut}
        allAccounts={allAccounts}
        onSelectSavedAccount={handleSelectSavedAccount}
      />

      {/* Share Link & Publish Access Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* WebRTC Video Chat PIP Panel */}
      <VideoChatPanel />

      {/* Supabase Realtime Sync Status & Configuration Modal */}
      {isConnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#1a0f0b] border-2 border-[#5a3928] rounded-2xl p-6 shadow-2xl text-[#f5ebd4]">
            <div className="flex items-center justify-between pb-3 border-b border-[#382216] mb-4">
              <div>
                <h3 className="font-display font-bold text-lg text-[#f5ebd4] tracking-wide flex items-center gap-2">
                  <span>⚡</span>
                  <span>Supabase Realtime Sync Status</span>
                </h3>
                <p className="font-editorial italic text-xs text-[#a08774] mt-0.5">
                  Synchronize your cards, red strings, and notes across both screens simultaneously.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsConnModalOpen(false)}
                className="text-[#8f745f] hover:text-[#f5ebd4] p-1 text-lg font-mono leading-none cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Current Status Box */}
            <div
              className={`p-3.5 rounded-lg border mb-5 font-typewriter text-xs flex items-center gap-3 ${
                supabaseConnected
                  ? 'bg-emerald-950/40 border-emerald-600/70 text-emerald-200'
                  : 'bg-amber-950/40 border-amber-600/70 text-amber-200'
              }`}
            >
              <div className="text-xl">{supabaseConnected ? '🟢' : '🟡'}</div>
              <div>
                <div className="font-bold text-sm tracking-wide">
                  {supabaseConnected ? 'CONNECTED TO SUPABASE' : 'LOCAL / OFFLINE MODE'}
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">{connStatusMessage}</div>
              </div>
            </div>

            {/* Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setIsTestingConn(true);
                saveSupabaseCredentials(connUrl.trim(), connKey.trim());
                const res = await testSupabaseConnection();
                setIsTestingConn(false);
                setSupabaseConnected(res.ok);
                setConnStatusMessage(res.ok ? 'Connection verified! Reloading sync...' : (res.message || 'Connection failed'));
                if (res.ok) {
                  setTimeout(() => {
                    window.location.reload();
                  }, 1200);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block font-typewriter text-xs uppercase text-[#cfb69b] mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="url"
                  value={connUrl}
                  onChange={(e) => setConnUrl(e.target.value)}
                  placeholder="https://abcdefghijklm.supabase.co"
                  className="w-full bg-[#100806] border border-[#44281a] rounded-lg px-3 py-2 text-xs font-mono text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c] placeholder:text-[#523e30]"
                />
              </div>

              <div>
                <label className="block font-typewriter text-xs uppercase text-[#cfb69b] mb-1">
                  Supabase Anon (Public) Key
                </label>
                <input
                  type="password"
                  value={connKey}
                  onChange={(e) => setConnKey(e.target.value)}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full bg-[#100806] border border-[#44281a] rounded-lg px-3 py-2 text-xs font-mono text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c] placeholder:text-[#523e30]"
                />
              </div>

              <p className="text-[11px] font-editorial italic text-[#9e826b] leading-relaxed">
                Tip: When you and your girlfriend are both logged in, cards dragged by one person move instantaneously on the other person's screen with presence indicators.
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-[#382216]">
                <button
                  type="button"
                  onClick={() => setIsConnModalOpen(false)}
                  className="font-typewriter text-xs px-4 py-2 text-[#a08774] hover:text-[#f5ebd4] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isTestingConn}
                  className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] font-typewriter text-xs uppercase tracking-wider px-5 py-2 rounded-lg border border-[#b91c1c] shadow-lg cursor-pointer flex items-center gap-2 font-bold transition-all disabled:opacity-50"
                >
                  {isTestingConn ? 'Testing Connection...' : 'Save & Verify Connection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Synchronized Watch Party & Live Chat Modal */}
      <WatchPartyModal
        isOpen={isWatchPartyOpen}
        onClose={() => setIsWatchPartyOpen(false)}
        boardId={activeBoardId || 'episode-1-pilot'}
        boardTitle={activeBoard?.title || 'Episode 1: Pilot'}
        currentUser={currentUser}
        partnerName={partnerUser?.name || defaultPartnerName}
        onPinTheoryToBoard={handlePinTheoryClue}
        activeEpisodeNumber={currentEpNumber}
      />
    </div>
    </WebRTCProvider>
  );
};

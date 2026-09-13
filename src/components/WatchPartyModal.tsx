import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw,
  Maximize2, 
  Minimize2, 
  X, 
  MessageSquare, 
  Send, 
  Users, 
  Pin, 
  Sparkles,
  ExternalLink,
  RefreshCw,
  Tv,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Timer,
  CheckCircle2,
  Clock,
  Columns,
  AlertCircle,
  Film,
  ChevronRight,
  ChevronLeft,
  Info
} from 'lucide-react';
import { WatchPartyChatMessage, WatchPartySyncState } from '../types';
import { getSupabase } from '../lib/supabase';
import { useWebRTC } from '../context/WebRTCContext';
import { realtimeClient, WatchPartySyncPayload } from '../lib/realtimeClient';
import { 
  EPISODE_STREAMS,
  EpisodeVideoData
} from '../seedData';

interface WatchPartyModalProps {
  isOpen: boolean;
  onClose: () => void;
  boardId: string;
  boardTitle: string;
  currentUser: { name: string; email: string };
  partnerName: string;
  onPinTheoryToBoard?: (theoryText: string, videoTimestamp: string) => void;
  activeEpisodeNumber?: number;
}

// Audio beep using Web Audio API for synchronous 5-4-3-2-1 countdown
function playCountdownBeep(freq = 440, duration = 0.15) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // Ignore audio block if user hasn't interacted
  }
}

export const WatchPartyModal: React.FC<WatchPartyModalProps> = ({
  isOpen,
  onClose,
  boardId,
  boardTitle,
  currentUser,
  partnerName,
  onPinTheoryToBoard,
  activeEpisodeNumber,
}) => {
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // WebRTC Video & Audio hook
  const {
    inCall,
    isAudioMuted,
    isVideoOff,
    connectionState,
    localStream,
    remoteStream,
    startCall,
    endCall,
    toggleMic,
    toggleCamera,
    errorMsg: rtcErrorMsg,
  } = useWebRTC();

  const localWebcamRef = useRef<HTMLVideoElement | null>(null);
  const remoteWebcamRef = useRef<HTMLVideoElement | null>(null);

  // Callback refs to ensure webcam stream binds smoothly
  const handleLocalWebcamRef = useCallback(
    (el: HTMLVideoElement | null) => {
      localWebcamRef.current = el;
      if (el && localStream) {
        if (el.srcObject !== localStream) {
          el.srcObject = localStream;
        }
        el.play().catch(() => {});
      }
    },
    [localStream]
  );

  const handleRemoteWebcamRef = useCallback(
    (el: HTMLVideoElement | null) => {
      remoteWebcamRef.current = el;
      if (el && remoteStream) {
        if (el.srcObject !== remoteStream) {
          el.srcObject = remoteStream;
        }
        el.play().catch(() => {});
      }
    },
    [remoteStream]
  );

  useEffect(() => {
    if (localWebcamRef.current && localStream) {
      if (localWebcamRef.current.srcObject !== localStream) {
        localWebcamRef.current.srcObject = localStream;
      }
      localWebcamRef.current.play().catch(() => {});
    }
  }, [localStream, inCall]);

  useEffect(() => {
    if (remoteWebcamRef.current && remoteStream) {
      if (remoteWebcamRef.current.srcObject !== remoteStream) {
        remoteWebcamRef.current.srcObject = remoteStream;
      }
      remoteWebcamRef.current.play().catch(() => {});
    }
  }, [remoteStream, inCall]);

  // Dynamic helper to resolve episode number from title or id
  const resolveEpNum = (epNum?: number, title: string = '', id: string = ''): number => {
    if (epNum && EPISODE_STREAMS[epNum]) return epNum;
    const matchId = id.match(/episode-(\d+)/i);
    if (matchId && EPISODE_STREAMS[parseInt(matchId[1], 10)]) return parseInt(matchId[1], 10);
    const matchTitle = title.match(/episode\s*(\d+)/i);
    if (matchTitle && EPISODE_STREAMS[parseInt(matchTitle[1], 10)]) return parseInt(matchTitle[1], 10);
    return 1;
  };

  // Episode selection (supports all episodes configured in EPISODE_STREAMS)
  const initialEp = resolveEpNum(activeEpisodeNumber, boardTitle, boardId);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEp);
  const selectedEpisodeRef = useRef<number>(initialEp);

  useEffect(() => {
    selectedEpisodeRef.current = selectedEpisode;
  }, [selectedEpisode]);

  useEffect(() => {
    const ep = resolveEpNum(activeEpisodeNumber, boardTitle, boardId);
    setSelectedEpisode(ep);
    const epData = EPISODE_STREAMS[ep] || EPISODE_STREAMS[1];
    setDuration(epData.durationSeconds);
  }, [activeEpisodeNumber, boardId, boardTitle]);

  const activeStream: EpisodeVideoData = EPISODE_STREAMS[selectedEpisode] || EPISODE_STREAMS[1];

  // Fullscreen Cinema + Sidebar Mode state
  const [isFullscreenCinema, setIsFullscreenCinema] = useState<boolean>(false);
  const [isSidebarVisible, setIsSidebarVisible] = useState<boolean>(true);

  // Playback companion stopwatch state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(activeStream.durationSeconds || 5640);
  const [pausedBy, setPausedBy] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Connected to Screening Room');
  const [lastActionBy, setLastActionBy] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{ message: string; timestamp: number } | null>(null);

  // Ready Check state
  const [isSelfReady, setIsSelfReady] = useState<boolean>(false);
  const [isPartnerReady, setIsPartnerReady] = useState<boolean>(false);

  // Synchronized countdown state (e.g. 5, 4, 3, 2, 1, 0)
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [countdownInitiator, setCountdownInitiator] = useState<string | null>(null);
  const countdownIntervalRef = useRef<any>(null);

  // Chat & Clues state
  const [messages, setMessages] = useState<WatchPartyChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState<string>('');
  const [isTheoryClue, setIsTheoryClue] = useState<boolean>(false);

  // Sync state tracking to prevent feedback loops
  const isBroadcastingRef = useRef<boolean>(false);
  const lastSyncTimestampRef = useRef<number>(0);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  // Toast auto-clear
  useEffect(() => {
    if (!actionToast) return;
    const timer = setTimeout(() => {
      setActionToast(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [actionToast]);

  // Synchronized companion stopwatch ticking
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        if (duration > 0 && prev >= duration) {
          setIsPlaying(false);
          return duration;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, duration]);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Broadcast companion stopwatch state to partner
  const broadcastPlayback = useCallback(
    (actionPlaying: boolean, actionTime: number, episodeNumber?: number) => {
      if (isBroadcastingRef.current) return;
      const now = Date.now();
      lastSyncTimestampRef.current = now;
      const epNum = episodeNumber !== undefined ? episodeNumber : selectedEpisodeRef.current;

      const syncData: WatchPartySyncPayload = {
        isOpen: true,
        isPlaying: actionPlaying,
        currentTime: actionTime,
        episodeNumber: epNum,
        updatedBy: currentUser.name,
        updatedAt: now,
      };

      if (!actionPlaying) {
        setPausedBy(currentUser.name);
        setActionToast({
          message: `⏸️ You paused companion timer for both at ${formatTime(actionTime)}`,
          timestamp: Date.now(),
        });
      } else {
        setPausedBy(null);
        setActionToast({
          message: `▶️ Companion timer resumed for both`,
          timestamp: Date.now(),
        });
      }

      // 1. Server WebSocket Relay
      realtimeClient.broadcastPlayback(syncData);

      // 2. Supabase fallback
      const supabase = getSupabase();
      if (supabase) {
        const ch = supabase.channel(`watchparty:${boardId}`);
        ch.send({
          type: 'broadcast',
          event: 'watch_event',
          payload: { type: 'playback', data: syncData },
        }).catch(() => {});
      }
    },
    [boardId, currentUser.name]
  );

  // Toggle ready status
  const handleToggleReady = () => {
    const nextReady = !isSelfReady;
    setIsSelfReady(nextReady);

    const payload = {
      user: currentUser.name,
      isReady: nextReady,
    };

    realtimeClient.broadcastReady(payload);

    const supabase = getSupabase();
    if (supabase) {
      const ch = supabase.channel(`watchparty:${boardId}`);
      ch.send({
        type: 'broadcast',
        event: 'watch_event',
        payload: { type: 'ready', data: payload },
      }).catch(() => {});
    }

    setActionToast({
      message: nextReady
        ? `✅ You are marked Ready! (Google Drive cued up)`
        : `⏳ Marked Not Ready`,
      timestamp: Date.now(),
    });
  };

  // Launch synchronized countdown (default 5 seconds for ample reaction time)
  const handleTriggerCountdown = (seconds = 5) => {
    const payload = {
      seconds,
      initiatedBy: currentUser.name,
    };

    realtimeClient.broadcastCountdown(payload);

    const supabase = getSupabase();
    if (supabase) {
      const ch = supabase.channel(`watchparty:${boardId}`);
      ch.send({
        type: 'broadcast',
        event: 'watch_event',
        payload: { type: 'countdown', data: payload },
      }).catch(() => {});
    }
  };

  // Execute countdown locally when event received
  const startCountdownSequence = useCallback((seconds: number, initiator: string) => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    setCountdownInitiator(initiator);
    setCountdownValue(seconds);
    playCountdownBeep(520, 0.2);

    let step = seconds;
    countdownIntervalRef.current = setInterval(() => {
      step -= 1;
      if (step > 0) {
        setCountdownValue(step);
        playCountdownBeep(520, 0.2);
      } else if (step === 0) {
        setCountdownValue(0);
        // Triumphant cheer tone on zero!
        playCountdownBeep(920, 0.45);
        setIsPlaying(true);
        setCurrentTime(0);
        setActionToast({
          message: `🎬 PRESS PLAY ON GOOGLE DRIVE RIGHT NOW!`,
          timestamp: Date.now(),
        });
      } else {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setCountdownValue(null);
        setCountdownInitiator(null);
      }
    }, 1000);
  }, []);

  // Realtime Server & WebSocket Synchronization Listeners
  useEffect(() => {
    if (!isOpen) return;

    realtimeClient.updateActivity(boardId, true);

    // Fetch saved chat from server disk
    fetch(`/api/chat/${boardId}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data);
        }
      })
      .catch(() => {});

    // Fetch initial screening state from server
    fetch('/api/screening')
      .then((r) => r.json())
      .then((state) => {
        if (state) {
          if (state.episodeNumber && state.episodeNumber !== selectedEpisodeRef.current) {
            setSelectedEpisode(state.episodeNumber);
            const epData = EPISODE_STREAMS[state.episodeNumber] || EPISODE_STREAMS[1];
            setDuration(epData.durationSeconds);
          }
          if (state.isPlaying) {
            const latency = Math.max(0, (Date.now() - (state.updatedAt || Date.now())) / 1000);
            setCurrentTime((state.currentTime || 0) + latency);
            setIsPlaying(true);
            setSyncStatus(`In Sync with ${state.updatedBy}`);
          } else if (state.currentTime > 0) {
            setCurrentTime(state.currentTime);
          }
        }
      })
      .catch(() => {});

    // 1. Listen to playback sync from server
    const unsubscribePlayback = realtimeClient.on('watch:playback', (sync: WatchPartySyncPayload) => {
      if (sync.updatedBy === currentUser.name) return;

      isBroadcastingRef.current = true;
      setLastActionBy(sync.updatedBy);
      setSyncStatus(`In Sync with ${sync.updatedBy}`);

      if (sync.episodeNumber && sync.episodeNumber !== selectedEpisodeRef.current) {
        const newEpNum = sync.episodeNumber;
        setSelectedEpisode(newEpNum);
        const newStream = EPISODE_STREAMS[newEpNum] || EPISODE_STREAMS[1];
        setDuration(newStream.durationSeconds);
        setActionToast({
          message: `📼 ${sync.updatedBy} switched to ${newStream.title}`,
          timestamp: Date.now(),
        });
      }

      const latencyAdjust = sync.updatedAt ? Math.max(0, (Date.now() - sync.updatedAt) / 1000) : 0;
      setCurrentTime(sync.currentTime + (sync.isPlaying ? latencyAdjust : 0));
      setIsPlaying(sync.isPlaying);

      if (!sync.isPlaying) {
        setPausedBy(sync.updatedBy);
        setActionToast({
          message: `⏸️ Paused by ${sync.updatedBy} at ${formatTime(sync.currentTime)}`,
          timestamp: Date.now(),
        });
      } else {
        setPausedBy(null);
        setActionToast({
          message: `▶️ Resumed by ${sync.updatedBy}`,
          timestamp: Date.now(),
        });
      }

      setTimeout(() => {
        isBroadcastingRef.current = false;
      }, 300);
    });

    // 2. Listen to Chat from server
    const unsubscribeChat = realtimeClient.on('watch:chat', (payload) => {
      const { message } = payload;
      if (message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      }
    });

    // 3. Listen to Synchronized Countdown
    const unsubscribeCountdown = realtimeClient.on('watch:countdown', (payload) => {
      startCountdownSequence(payload.seconds || 5, payload.initiatedBy || 'Partner');
    });

    // 4. Listen to Ready Check
    const unsubscribeReady = realtimeClient.on('watch:ready', (payload) => {
      if (payload.user !== currentUser.name) {
        setIsPartnerReady(payload.isReady);
        setActionToast({
          message: payload.isReady
            ? `✅ ${payload.user} is READY! (Cued up at 0:00)`
            : `⏳ ${payload.user} is getting cued up...`,
          timestamp: Date.now(),
        });
      }
    });

    // Supabase Channel Backup for countdown, ready, chat
    const supabase = getSupabase();
    let supabaseChannel: any = null;
    if (supabase) {
      supabaseChannel = supabase
        .channel(`watchparty:${boardId}`)
        .on('broadcast', { event: 'watch_event' }, ({ payload }: any) => {
          if (!payload) return;
          if (payload.type === 'countdown') {
            startCountdownSequence(payload.data.seconds || 5, payload.data.initiatedBy);
          } else if (payload.type === 'ready') {
            if (payload.data.user !== currentUser.name) {
              setIsPartnerReady(payload.data.isReady);
            }
          } else if (payload.type === 'playback' && payload.data.updatedBy !== currentUser.name) {
            setCurrentTime(payload.data.currentTime || 0);
            setIsPlaying(!!payload.data.isPlaying);
          }
        })
        .subscribe();
    }

    return () => {
      realtimeClient.updateActivity(boardId, false);
      unsubscribePlayback();
      unsubscribeChat();
      unsubscribeCountdown();
      unsubscribeReady();
      if (supabase && supabaseChannel) {
        supabase.removeChannel(supabaseChannel);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [isOpen, boardId, currentUser.name, startCountdownSequence]);

  // Scroll chat on new message
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Switch between episodes directly in screening room
  const handleSelectEpisode = (epNum: number) => {
    setSelectedEpisode(epNum);
    const newStream = EPISODE_STREAMS[epNum] || EPISODE_STREAMS[1];
    setDuration(newStream.durationSeconds);
    setCurrentTime(0);
    setIsPlaying(false);
    setIsSelfReady(false);
    setIsPartnerReady(false);
    setActionToast({
      message: `📼 Switched Screening Room to ${newStream.title}`,
      timestamp: Date.now(),
    });
    broadcastPlayback(false, 0, epNum);
  };

  // Play / Pause toggle for companion timer
  const handleTogglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);
    broadcastPlayback(nextState, currentTime);
  };

  // Reset companion timer to 0
  const handleResetTimer = () => {
    setCurrentTime(0);
    setIsPlaying(false);
    broadcastPlayback(false, 0);
    setActionToast({
      message: `🔄 Companion timer reset to 00:00 for both`,
      timestamp: Date.now(),
    });
  };

  // Seek companion timer
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    broadcastPlayback(isPlaying, newTime);
  };

  // Jump companion timer
  const handleSkip = (seconds: number) => {
    const target = Math.max(0, Math.min(duration, currentTime + seconds));
    setCurrentTime(target);
    broadcastPlayback(isPlaying, target);
  };

  // Send Chat message
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim()) return;

    const newMsg: WatchPartyChatMessage = {
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      sender_name: currentUser.name,
      sender_email: currentUser.email,
      timestamp: new Date().toISOString(),
      video_time: Math.round(currentTime),
      text: inputMsg.trim(),
      is_theory_clue: isTheoryClue,
    };

    setMessages((prev) => [...prev, newMsg]);
    setInputMsg('');

    realtimeClient.sendChatMessage(boardId, newMsg);

    fetch(`/api/chat/${boardId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg),
    }).catch(() => {});
  };

  // Pin a clue directly from chat into the corkboard
  const handlePinClueToBoard = (msg: WatchPartyChatMessage) => {
    if (onPinTheoryToBoard) {
      onPinTheoryToBoard(
        `[Ep. ${selectedEpisode} @ ${formatTime(msg.video_time)}] ${msg.text} (noted by ${msg.sender_name})`,
        formatTime(msg.video_time)
      );
      setActionToast({
        message: `📌 Pinned timestamp clue to Investigation Board!`,
        timestamp: Date.now(),
      });
    }
  };

  // Toggle browser fullscreen / cinema mode
  const handleToggleFullscreenCinema = () => {
    setIsFullscreenCinema((prev) => !prev);
  };

  if (!isOpen) return null;

  return (
    <div 
      ref={modalContainerRef}
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isFullscreenCinema ? 'p-0 bg-black' : 'p-2 sm:p-4 bg-black/95 backdrop-blur-md'
      } animate-fadeIn select-none`}
    >
      <div 
        className={`w-full ${
          isFullscreenCinema 
            ? 'w-screen h-screen rounded-none border-0' 
            : 'max-w-[96vw] xl:max-w-7xl h-[94vh] rounded-2xl border-2 border-[#5a3928] shadow-[0_25px_60px_rgba(0,0,0,0.95)]'
        } bg-[#140b08] flex flex-col overflow-hidden transition-all text-[#f5ebd4]`}
      >
        {/* 1. Header Bar: Twin Peaks Sheriff Station Screening Room */}
        <div className="h-14 bg-[#1a0f0b] border-b border-[#3e2518] px-3 sm:px-4 flex items-center justify-between flex-shrink-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
            <span className="text-xl flex-shrink-0">📼</span>
            <div className="flex items-center gap-2 flex-wrap truncate">
              <h3 className="font-display font-black text-xs sm:text-sm md:text-base tracking-widest text-[#f5ebd4] uppercase truncate">
                TWIN PEAKS SCREENING ROOM
              </h3>

              {/* Episode Switcher Buttons */}
              <div className="flex items-center gap-1 bg-[#100806] border border-[#44281a] p-0.5 rounded-lg">
                {Object.keys(EPISODE_STREAMS).map(Number).sort((a, b) => a - b).map((epNum) => {
                  const epData = EPISODE_STREAMS[epNum];
                  if (!epData) return null;
                  const isSelected = selectedEpisode === epNum;
                  return (
                    <button
                      key={epNum}
                      onClick={() => handleSelectEpisode(epNum)}
                      className={`px-2 py-0.5 rounded text-[10px] font-typewriter font-bold tracking-wider uppercase transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#83161c] text-[#fdf2f2] border border-[#b91c1c] shadow-[0_0_10px_rgba(185,28,28,0.4)]'
                          : 'text-[#9c8472] hover:text-[#f5ebd4] hover:bg-[#25150e]'
                      }`}
                      title={`Switch Screening Room to ${epData.title}`}
                    >
                      Ep. {epNum}
                    </button>
                  );
                })}
              </div>

              <span className="bg-[#1f2937] text-[#93c5fd] text-[10px] font-bold px-2 py-0.5 rounded font-typewriter tracking-wider uppercase border border-[#374151] hidden md:inline-block">
                Google Drive Stream
              </span>
            </div>
          </div>

          {/* Controls: Ready Check, Countdown Trigger, Fullscreen & Close */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0">
            {/* Quick Synchronized Countdown Button */}
            <button
              onClick={() => handleTriggerCountdown(5)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 bg-[#83161c] hover:bg-[#991b1b] border border-[#b91c1c] text-[#fdf2f2] rounded-lg text-xs font-typewriter font-bold transition-all shadow cursor-pointer hover:scale-105 active:scale-95"
              title="Start synchronized 5-second countdown for both users to click Play"
            >
              <Timer className="w-3.5 h-3.5 text-amber-300 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="hidden sm:inline">Start</span>
              <span>5s Countdown</span>
            </button>

            {/* Ready Status Toggle */}
            <button
              onClick={handleToggleReady}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-typewriter border transition-all cursor-pointer ${
                isSelfReady 
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300' 
                  : 'bg-[#25150f] border-[#4a2e20] text-[#cfb69b] hover:text-[#f5ebd4]'
              }`}
              title="Signal to partner that your Google Drive video is cued and ready"
            >
              <CheckCircle2 className={`w-3.5 h-3.5 ${isSelfReady ? 'text-emerald-400' : 'text-[#8f745f]'}`} />
              <span className="hidden md:inline">{isSelfReady ? 'Ready' : 'Cue Ready'}</span>
            </button>

            {/* Pop-Out Google Drive in new tab */}
            <a
              href={activeStream.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden lg:flex items-center gap-1 px-2 py-1 bg-[#25150f] hover:bg-[#382017] border border-[#4a2e20] text-[#e5c158] hover:text-amber-300 rounded-lg text-xs font-typewriter transition-colors cursor-pointer"
              title={`Open ${activeStream.title} directly in Google Drive`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Pop-Out</span>
            </a>

            {/* Toggle Fullscreen Cinema + Sidebar */}
            <button
              onClick={handleToggleFullscreenCinema}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-typewriter border transition-all cursor-pointer ${
                isFullscreenCinema 
                  ? 'bg-[#3e2518] text-[#f5ebd4] border-[#6b3520]' 
                  : 'bg-[#25150f] hover:bg-[#382017] border-[#4a2e20] text-[#e5c158] hover:text-amber-200'
              }`}
              title={isFullscreenCinema ? 'Exit Fullscreen Cinema' : 'Fullscreen Episode + Video Call Sidebar'}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isFullscreenCinema ? 'Normal View' : 'Cinema + Sidebar'}</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 bg-[#25150f] hover:bg-[#5a1c1c] border border-[#4a2e20] text-[#cfb69b] hover:text-red-300 rounded-lg transition-colors cursor-pointer"
              title="Close Screening Room"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 2. Main Content: Unobstructed Video Stage (Left) + Video Call & Chat Sidebar (Right) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#0c0604] relative">
          {/* Left: Google Drive Video Stage (Completely Unobstructed!) */}
          <div className="flex-1 flex flex-col justify-between bg-black relative overflow-hidden">
            {/* The Google Drive Video Screen (100% Unobstructed, No overlapping PiPs) */}
            <div className="flex-1 w-full h-full relative bg-black flex items-center justify-center">
              <iframe
                key={activeStream.driveFileId}
                src={activeStream.embedUrl}
                title={`Twin Peaks ${activeStream.title} Video Stream`}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
              />

              {/* Synchronized 5-4-3-2-1 Countdown Overlay */}
              {countdownValue !== null && (
                <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center animate-fadeIn pointer-events-none select-none">
                  <div className="text-center">
                    <div className="text-8xl sm:text-9xl font-display font-black text-[#e5c158] animate-ping duration-1000 drop-shadow-[0_0_35px_rgba(229,193,88,0.7)]">
                      {countdownValue > 0 ? countdownValue : 'START!'}
                    </div>
                    <div className="font-typewriter text-base sm:text-xl text-[#fdf2f2] font-bold tracking-widest mt-6 uppercase bg-[#83161c] px-6 py-2 rounded-xl border border-[#b91c1c] shadow-2xl">
                      {countdownValue > 0 
                        ? `GET READY TO PRESS PLAY (${countdownInitiator})` 
                        : '▶️ PRESS PLAY ON GOOGLE DRIVE RIGHT NOW!'}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Toast Notification */}
              {actionToast && (
                <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-30 animate-fadeIn">
                  <div className="bg-[#1a0f0b]/95 border-2 border-[#b91c1c] text-[#fdf2f2] px-4 py-2 rounded-xl shadow-2xl font-typewriter text-xs sm:text-sm font-bold flex items-center gap-2 backdrop-blur-md">
                    <span>{actionToast.message}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Synchronized Companion Watch Bar (Bottom Bar) */}
            <div className="bg-[#160d09] border-t border-[#3e2518] px-3 sm:px-4 py-2 sm:py-2.5 flex flex-col gap-1.5 z-10">
              {/* Ready Check & Instructions Strip */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-typewriter">
                <div className="flex items-center gap-2 text-[#cfb69b]">
                  <span className="flex items-center gap-1">
                    <span className="font-bold">You:</span>
                    {isSelfReady ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    ) : (
                      <span className="text-amber-400">Cue to 0:00</span>
                    )}
                  </span>
                  <span className="text-[#5a3928]">•</span>
                  <span className="flex items-center gap-1">
                    <span className="font-bold">{partnerName}:</span>
                    {isPartnerReady ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Ready
                      </span>
                    ) : (
                      <span className="text-[#8f745f]">Waiting...</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-[#a08774] hidden sm:flex">
                  <Info className="w-3.5 h-3.5 text-[#e5c158]" />
                  <span>Cue episode to 0:00, then click "Start 5s Countdown" to press play together!</span>
                </div>
              </div>

              {/* Timeline Scrubber & Controls */}
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-[#e5c158] w-14 text-right font-bold">
                  {formatTime(currentTime)}
                </span>
                <input
                  type="range"
                  min="0"
                  max={duration || 5640}
                  step="1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="flex-1 h-2 bg-[#25150f] rounded-lg appearance-none cursor-pointer accent-[#b91c1c] border border-[#44281a]"
                />
                <span className="font-mono text-xs text-[#8f745f] w-14">
                  {formatTime(duration)}
                </span>
              </div>

              {/* Companion Stopwatch Control Buttons */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={handleTogglePlay}
                    className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer shadow flex items-center gap-1.5 font-typewriter text-xs font-bold ${
                      isPlaying
                        ? 'bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] border-[#b91c1c]'
                        : 'bg-[#065f46] hover:bg-[#047857] text-[#ecfdf5] border-[#059669]'
                    }`}
                    title="Play or pause synchronized stopwatch timer"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-3.5 h-3.5 fill-current" />
                        <span>Pause Stopwatch</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Resume Stopwatch</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleTriggerCountdown(5)}
                    className="px-3 py-1.5 bg-[#25150f] hover:bg-[#382017] text-[#e5c158] hover:text-amber-200 rounded-lg border border-[#5a3928] text-xs font-typewriter transition-all cursor-pointer flex items-center gap-1 font-bold shadow"
                    title="Start 5-second synchronized countdown"
                  >
                    <Timer className="w-3.5 h-3.5" />
                    <span>5s Countdown</span>
                  </button>

                  <button
                    onClick={() => handleTriggerCountdown(3)}
                    className="px-2.5 py-1.5 bg-[#25150f] hover:bg-[#382017] text-[#cfb69b] hover:text-[#f5ebd4] rounded-lg border border-[#44281a] text-xs font-typewriter transition-all cursor-pointer"
                    title="Start 3-second quick countdown"
                  >
                    3s Quick
                  </button>

                  <button
                    onClick={handleResetTimer}
                    className="p-1.5 bg-[#25150f] hover:bg-[#382017] text-[#cfb69b] hover:text-[#f5ebd4] rounded-lg border border-[#44281a] text-xs transition-colors cursor-pointer"
                    title="Reset companion timer to 00:00"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Right: Pin Timestamp Note */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const timeStamp = formatTime(currentTime);
                      if (onPinTheoryToBoard) {
                        onPinTheoryToBoard(
                          `[Episode ${selectedEpisode} Timestamp ${timeStamp}] Suspect observation or clue spotted during watch party!`,
                          timeStamp
                        );
                        setActionToast({
                          message: `📌 Pinned timestamp ${timeStamp} to Corkboard!`,
                          timestamp: Date.now(),
                        });
                      }
                    }}
                    className="px-2.5 sm:px-3 py-1.5 bg-[#2e1910] hover:bg-[#422316] border border-[#5a3928] text-[#e5c158] hover:text-amber-200 rounded-lg text-xs font-typewriter transition-colors cursor-pointer flex items-center gap-1.5 shadow"
                    title="Pin this timecode directly to the corkboard"
                  >
                    <Pin className="w-3.5 h-3.5" />
                    <span>Pin Note @ {formatTime(currentTime)}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Toggle Button when Sidebar is Collapsed in Fullscreen */}
          {!isSidebarVisible && (
            <button
              onClick={() => setIsSidebarVisible(true)}
              className="absolute top-4 right-4 z-40 bg-[#1a0f0b]/90 hover:bg-[#25150f] border-2 border-[#b91c1c] text-[#e5c158] px-3 py-2 rounded-xl text-xs font-typewriter flex items-center gap-2 shadow-2xl backdrop-blur-md cursor-pointer transition-all hover:scale-105"
              title="Show Partner Video Call & Chat Sidebar"
            >
              <Video className="w-4 h-4 text-emerald-400" />
              <span>Show Video Sidebar ({partnerName})</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}

          {/* Right: Dedicated Video Call & Realtime Chat Sidebar (Never covers the video!) */}
          {isSidebarVisible && (
            <div className="w-full lg:w-80 xl:w-92 flex flex-col border-t lg:border-t-0 lg:border-l border-[#3e2518] bg-[#140b08] z-20 flex-shrink-0">
              {/* Section A: Live Video Call Dock */}
              <div className="bg-[#1a0f0b] border-b border-[#3e2518] p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-red-500" />
                    <span className="font-typewriter text-xs font-bold uppercase tracking-wider text-[#f5ebd4]">
                      Sheriff Video Call
                    </span>
                    <span className={`w-2 h-2 rounded-full ${inCall ? 'bg-emerald-400 animate-ping' : 'bg-amber-600'}`} />
                  </div>

                  <button
                    onClick={() => setIsSidebarVisible(false)}
                    className="text-[#8f745f] hover:text-[#f5ebd4] p-1 rounded transition-colors cursor-pointer"
                    title="Collapse sidebar to maximize video"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Video Screens */}
                <div className="space-y-2">
                  {inCall ? (
                    <div className="flex flex-col gap-2">
                      {/* Partner Remote Video (Prominent Display) */}
                      <div className="relative aspect-[16/10] bg-black rounded-lg overflow-hidden border border-[#4a2e20] shadow-inner flex items-center justify-center">
                        <video
                          ref={handleRemoteWebcamRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        {!remoteStream && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center bg-[#0d0705]">
                            <span className="text-2xl mb-1 animate-bounce">🦉</span>
                            <span className="font-typewriter text-xs text-[#cfb69b] font-bold">
                              Connecting to {partnerName}...
                            </span>
                            <span className="font-editorial italic text-[11px] text-[#8e7360] mt-0.5">
                              The owls are not what they seem
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-1.5 left-1.5 bg-black/80 text-[10px] font-typewriter text-[#e5c158] px-2 py-0.5 rounded border border-[#3e2518] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span>{partnerName}</span>
                        </div>
                      </div>

                      {/* Your Own Local Camera Preview & Controls */}
                      <div className="relative aspect-[16/6] bg-[#0d0705] rounded-lg overflow-hidden border border-[#3e2518] flex items-center justify-center">
                        <video
                          ref={handleLocalWebcamRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover transform -scale-x-100"
                        />
                        {isVideoOff && (
                          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center text-[10px] font-typewriter text-red-300">
                            <VideoOff className="w-4 h-4 mb-0.5 text-red-400" />
                            <span>Camera Off</span>
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1.5 bg-black/80 text-[9px] font-typewriter text-[#d8c5ad] px-1.5 py-0.5 rounded">
                          You ({currentUser.name})
                        </div>

                        {/* Quick Controls in Local Cam */}
                        <div className="absolute bottom-1 right-1.5 flex items-center gap-1">
                          <button
                            onClick={toggleMic}
                            className={`p-1 rounded text-[10px] font-typewriter cursor-pointer ${
                              isAudioMuted ? 'bg-red-900 text-red-200' : 'bg-black/80 text-emerald-300'
                            }`}
                            title={isAudioMuted ? 'Unmute' : 'Mute'}
                          >
                            {isAudioMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={toggleCamera}
                            className={`p-1 rounded text-[10px] font-typewriter cursor-pointer ${
                              isVideoOff ? 'bg-red-900 text-red-200' : 'bg-black/80 text-emerald-300'
                            }`}
                            title={isVideoOff ? 'Turn Cam On' : 'Turn Cam Off'}
                          >
                            {isVideoOff ? <VideoOff className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Disconnect button */}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-typewriter text-[#8f745f]">
                          WebRTC Voice & Video Active
                        </span>
                        <button
                          onClick={endCall}
                          className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 px-2.5 py-1 rounded text-[11px] font-typewriter flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <PhoneOff className="w-3 h-3" />
                          <span>End Call</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Start Call Panel */
                    <div className="bg-[#120906] border border-[#3e2518] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                      <p className="font-typewriter text-xs text-[#d8c5ad] mb-2 font-bold">
                        Co-Watch with {partnerName} on Camera!
                      </p>
                      <button
                        onClick={() => startCall()}
                        className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] px-4 py-2 rounded-lg border border-[#b91c1c] font-typewriter text-xs uppercase tracking-wider font-bold shadow transition-all cursor-pointer flex items-center gap-2 hover:scale-105"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-amber-300" />
                        <span>Start Video Call</span>
                      </button>
                      <p className="font-editorial italic text-[10px] text-[#8e7360] mt-1.5">
                        Private peer-to-peer audio & video call
                      </p>
                    </div>
                  )}

                  {rtcErrorMsg && (
                    <div className="bg-red-950/80 border border-red-800 text-red-200 text-[10px] p-1.5 rounded flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span>{rtcErrorMsg}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section B: Synchronized Live Chat & Theory Clues Log */}
              <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[#160d09]">
                {/* Chat Header */}
                <div className="px-3 py-2 bg-[#1e120d] border-b border-[#382216] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-[#e5c158]" />
                    <span className="font-typewriter text-xs uppercase font-bold text-[#f5ebd4] tracking-wider">
                      Case Discussion & Notes
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">
                    ● Real-Time
                  </span>
                </div>

                {/* Message List */}
                <div
                  ref={chatScrollRef}
                  className="flex-1 overflow-y-auto p-3 space-y-2.5 font-typewriter text-xs"
                >
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 text-[#8f745f]">
                      <Sparkles className="w-5 h-5 mb-1 text-[#e5c158]/50" />
                      <p className="text-xs font-typewriter">No notes yet.</p>
                      <p className="text-[11px] font-editorial italic mt-1 text-[#a08774]">
                        Discuss suspects or pin timestamps as you watch together!
                      </p>
                    </div>
                  )}

                  {messages.map((msg) => {
                    const isSelf = msg.sender_email === currentUser.email;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} animate-fadeIn`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5 text-[10px] text-[#a08774]">
                          <span className="font-bold text-[#cfb69b]">{msg.sender_name}</span>
                          {msg.video_time !== undefined && (
                            <span className="text-[#e5c158] font-mono bg-[#25150f] px-1 rounded">
                              @{formatTime(msg.video_time)}
                            </span>
                          )}
                        </div>
                        <div
                          className={`p-2.5 rounded-xl max-w-[90%] break-words relative shadow ${
                            msg.is_theory_clue
                              ? 'bg-[#2d1b09] border border-amber-600/70 text-amber-100'
                              : isSelf
                              ? 'bg-[#83161c] text-[#fdf2f2] border border-[#b91c1c]'
                              : 'bg-[#20130d] text-[#e8dfd8] border border-[#3e2518]'
                          }`}
                        >
                          {msg.is_theory_clue && (
                            <div className="flex items-center gap-1 text-[10px] text-amber-300 font-bold mb-1 uppercase tracking-wider">
                              <Sparkles className="w-3 h-3" />
                              <span>Clue Observation</span>
                            </div>
                          )}
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                          {onPinTheoryToBoard && (
                            <button
                              onClick={() => handlePinClueToBoard(msg)}
                              className="mt-1.5 text-[10px] text-amber-300 hover:text-white flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                              title="Pin this clue to the active investigation board"
                            >
                              <Pin className="w-2.5 h-2.5" />
                              <span>Pin to Corkboard</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Chat Input Bar */}
                <form
                  onSubmit={handleSendMessage}
                  className="p-2.5 bg-[#1a0f0b] border-t border-[#382216] flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-[11px] font-typewriter text-[#d8c5ad] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isTheoryClue}
                        onChange={(e) => setIsTheoryClue(e.target.checked)}
                        className="accent-[#b91c1c] rounded"
                      />
                      <span>Mark as Clue</span>
                    </label>
                    <span className="text-[10px] font-mono text-[#8f745f]">
                      Timecode @ {formatTime(currentTime)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={inputMsg}
                      onChange={(e) => setInputMsg(e.target.value)}
                      placeholder={
                        isTheoryClue
                          ? 'Note a clue at this timestamp...'
                          : 'Discuss scene with partner...'
                      }
                      className="flex-1 bg-[#25150f] border border-[#4a2e20] rounded-lg px-3 py-1.5 text-xs font-typewriter text-[#f5ebd4] placeholder-[#8f745f] focus:outline-none focus:border-[#b91c1c]"
                    />
                    <button
                      type="submit"
                      className="p-2 bg-[#83161c] hover:bg-[#991b1b] border border-[#b91c1c] text-[#fdf2f2] rounded-lg transition-colors cursor-pointer"
                      title="Send message"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

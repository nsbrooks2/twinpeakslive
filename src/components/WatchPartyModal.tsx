import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Maximize2, 
  Minimize2, 
  Send, 
  StickyNote as StickyIcon, 
  Film, 
  MessageSquare, 
  Sparkles, 
  Users, 
  Clock, 
  Compass, 
  X, 
  AlertCircle, 
  ExternalLink, 
  Pin,
  RefreshCw,
  Tv,
  CheckCircle2,
  Info,
  Video,
  VideoOff,
  Mic,
  MicOff,
  PhoneCall,
  PhoneOff,
  Radio,
  Timer
} from 'lucide-react';
import { WatchPartyChatMessage, WatchPartySyncState } from '../types';
import { getSupabase } from '../lib/supabase';
import { useWebRTC } from '../context/WebRTCContext';
import { realtimeClient, WatchPartySyncPayload } from '../lib/realtimeClient';
import { 
  EPISODE_STREAMS,
  EpisodeVideoData,
  EPISODE_1_EMBED_URL, 
  EPISODE_1_VIEW_URL, 
  EPISODE_2_EMBED_URL,
  EPISODE_2_VIEW_URL,
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

// Audio beep using Web Audio API for synchronous 3-2-1 countdown
function playCountdownBeep(freq = 440, duration = 0.15) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // ignore audio block
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // Callback refs to ensure webcam never goes blank
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

  // Episode selection (supports all episodes configured in EPISODE_STREAMS)
  const initialEp = activeEpisodeNumber || (
    boardTitle.toLowerCase().includes('episode 5') || boardId.includes('episode-5') ? 5 :
    boardTitle.toLowerCase().includes('episode 4') || boardId.includes('episode-4') ? 4 :
    boardTitle.toLowerCase().includes('episode 3') || boardId.includes('episode-3') ? 3 :
    boardTitle.toLowerCase().includes('episode 2') || boardId.includes('episode-2') ? 2 : 1
  );
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEp);
  const selectedEpisodeRef = useRef<number>(initialEp);

  useEffect(() => {
    selectedEpisodeRef.current = selectedEpisode;
  }, [selectedEpisode]);

  useEffect(() => {
    if (activeEpisodeNumber) {
      setSelectedEpisode(activeEpisodeNumber);
      const epData = EPISODE_STREAMS[activeEpisodeNumber] || EPISODE_STREAMS[1];
      setDuration(epData.durationSeconds);
    } else if (boardTitle.toLowerCase().includes('episode 5') || boardId.includes('episode-5')) {
      setSelectedEpisode(5);
      setDuration(EPISODE_STREAMS[5]?.durationSeconds || 2940);
    } else if (boardTitle.toLowerCase().includes('episode 4') || boardId.includes('episode-4')) {
      setSelectedEpisode(4);
      setDuration(EPISODE_STREAMS[4]?.durationSeconds || 2940);
    } else if (boardTitle.toLowerCase().includes('episode 3') || boardId.includes('episode-3')) {
      setSelectedEpisode(3);
      setDuration(EPISODE_STREAMS[3]?.durationSeconds || 2940);
    } else if (boardTitle.toLowerCase().includes('episode 2') || boardId.includes('episode-2')) {
      setSelectedEpisode(2);
      setDuration(EPISODE_STREAMS[2]?.durationSeconds || 2880);
    }
  }, [activeEpisodeNumber, boardId, boardTitle]);

  const activeStream: EpisodeVideoData = EPISODE_STREAMS[selectedEpisode] || EPISODE_STREAMS[1];

  // Default to synchronized HTML5 video player so Dale and partner can play simultaneously!
  const [playerMode, setPlayerMode] = useState<'html5' | 'drive-stream'>('html5');
  const [customVideoUrl, setCustomVideoUrl] = useState<string>('');

  // Playback state & synchronized companion timer
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(activeStream.durationSeconds || 5640);
  const [pausedBy, setPausedBy] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string>('Connected to Server');
  const [lastActionBy, setLastActionBy] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<{ message: string; timestamp: number } | null>(null);
  const [showInfoBanner, setShowInfoBanner] = useState<boolean>(true);
  const [isWebcamDockMinimized, setIsWebcamDockMinimized] = useState<boolean>(false);
  const [isTheaterExpanded, setIsTheaterExpanded] = useState<boolean>(false);

  // Synchronized countdown state
  const [countdownValue, setCountdownValue] = useState<number | null>(null);
  const [countdownInitiator, setCountdownInitiator] = useState<string | null>(null);

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
    }, 3500);
    return () => clearTimeout(timer);
  }, [actionToast]);

  // Companion timer ticking when active
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

  // Broadcast helper
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
          message: `⏸️ You paused for both at ${formatTime(actionTime)}`,
          timestamp: Date.now(),
        });
      } else {
        setPausedBy(null);
        setActionToast({
          message: `▶️ You resumed playback for both`,
          timestamp: Date.now(),
        });
      }

      // 1. Primary: Server WebSocket Relay
      realtimeClient.broadcastPlayback(syncData);

      // 2. Local broadcast for same-tab fallback
      try {
        const localBroadcast = new BroadcastChannel(`tp_watchparty_sync_${boardId}`);
        localBroadcast.postMessage({ type: 'playback', data: syncData });
        localBroadcast.close();
      } catch (err) {
        console.warn('BroadcastChannel error', err);
      }

      // 3. Supabase fallback
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

  // Realtime Server & WebSocket Synchronization
  useEffect(() => {
    if (!isOpen) return;

    // Mark as watching on server
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
            const targetTime = (state.currentTime || 0) + latency;
            setCurrentTime(targetTime);
            setIsPlaying(true);
            setSyncStatus(`Synced with ${state.updatedBy}`);
            if (videoRef.current) {
              videoRef.current.currentTime = targetTime;
              videoRef.current.play().catch(() => {});
            }
          } else if (state.currentTime > 0) {
            setCurrentTime(state.currentTime);
            if (videoRef.current) {
              videoRef.current.currentTime = state.currentTime;
            }
          }
        }
      })
      .catch(() => {});

    // 1. Listen to playback sync from server
    const unsubscribePlayback = realtimeClient.on('watch:playback', (sync: WatchPartySyncPayload) => {
      if (sync.updatedBy === currentUser.name) return; // ignore own broadcast

      isBroadcastingRef.current = true;
      setLastActionBy(sync.updatedBy);
      setSyncStatus(`Synced with ${sync.updatedBy}`);

      // If partner changed episode
      if (sync.episodeNumber && sync.episodeNumber !== selectedEpisodeRef.current) {
        const newEpNum = sync.episodeNumber;
        setSelectedEpisode(newEpNum);
        const newStream = EPISODE_STREAMS[newEpNum] || EPISODE_STREAMS[1];
        setDuration(newStream.durationSeconds);
        setActionToast({
          message: `📼 ${sync.updatedBy} switched Screening Room to ${newStream.title}`,
          timestamp: Date.now(),
        });
      }

      // Latency correction
      const latencyAdjust = sync.updatedAt ? Math.max(0, (Date.now() - sync.updatedAt) / 1000) : 0;
      const targetTime = sync.currentTime + (sync.isPlaying ? latencyAdjust : 0);

      setCurrentTime(targetTime);
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

      // Direct HTML5 Video Sync
      if (videoRef.current) {
        if (Math.abs(videoRef.current.currentTime - targetTime) > 0.8) {
          videoRef.current.currentTime = targetTime;
        }

        if (sync.isPlaying && videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        } else if (!sync.isPlaying && !videoRef.current.paused) {
          videoRef.current.pause();
        }
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
      setCountdownInitiator(payload.initiatedBy);
      setCountdownValue(3);
      playCountdownBeep(520, 0.2);

      let step = 3;
      const timer = setInterval(() => {
        step -= 1;
        if (step > 0) {
          setCountdownValue(step);
          playCountdownBeep(520, 0.2);
        } else if (step === 0) {
          setCountdownValue(0);
          playCountdownBeep(880, 0.4);
          setIsPlaying(true);
          if (videoRef.current) {
            videoRef.current.play().catch(() => {});
          }
        } else {
          clearInterval(timer);
          setCountdownValue(null);
          setCountdownInitiator(null);
        }
      }, 1000);
    });

    return () => {
      realtimeClient.updateActivity(boardId, false);
      unsubscribePlayback();
      unsubscribeChat();
      unsubscribeCountdown();
    };
  }, [isOpen, boardId, currentUser.name]);

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
    setActionToast({
      message: `📼 Switched Screening Room to ${newStream.title}`,
      timestamp: Date.now(),
    });
    broadcastPlayback(false, 0, epNum);
  };

  // Play / Pause toggle
  const handleTogglePlay = () => {
    const nextState = !isPlaying;
    setIsPlaying(nextState);

    if (videoRef.current) {
      if (nextState) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }

    broadcastPlayback(nextState, currentTime);
  };

  // Seek handler
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
    broadcastPlayback(isPlaying, newTime);
  };

  // Jump by delta seconds
  const handleSkip = (seconds: number) => {
    const target = Math.max(0, Math.min(duration, currentTime + seconds));
    setCurrentTime(target);
    if (videoRef.current) {
      videoRef.current.currentTime = target;
    }
    broadcastPlayback(isPlaying, target);
  };

  // Synchronized 3-2-1 countdown launch
  const handleTriggerCountdown = () => {
    realtimeClient.broadcastCountdown({
      seconds: 3,
      initiatedBy: currentUser.name,
    });
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

    // Broadcast over WebSocket
    realtimeClient.sendChatMessage(boardId, newMsg);

    // Save to server REST API
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
        message: `📌 Pinned timestamp to Investigation Board!`,
        timestamp: Date.now(),
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/95 backdrop-blur-md animate-fadeIn select-none">
      <div 
        className={`w-full ${
          isTheaterExpanded ? 'max-w-[99vw] h-[98vh]' : 'max-w-7xl h-[92vh]'
        } bg-[#140b08] border-2 border-[#5a3928] rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] flex flex-col overflow-hidden transition-all text-[#f5ebd4]`}
      >
        {/* 1. Header Bar: Twin Peaks Sheriff Station Theater */}
        <div className="h-14 bg-[#1a0f0b] border-b border-[#3e2518] px-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xl">📼</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display font-black text-sm sm:text-base tracking-widest text-[#f5ebd4] uppercase">
                  SCREENING ROOM
                </h3>

                {/* Episode Switcher Selector */}
                <div className="flex items-center gap-1 bg-[#100806] border border-[#44281a] p-0.5 rounded-lg">
                  {Object.keys(EPISODE_STREAMS).map(Number).sort((a, b) => a - b).map((epNum) => {
                    const epData = EPISODE_STREAMS[epNum];
                    if (!epData) return null;
                    const isSelected = selectedEpisode === epNum;
                    return (
                      <button
                        key={epNum}
                        onClick={() => handleSelectEpisode(epNum)}
                        className={`px-2.5 py-0.5 rounded text-[10px] font-typewriter font-bold tracking-wider uppercase transition-all cursor-pointer ${
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

                <span className="bg-[#83161c] text-[#fdf2f2] text-[10px] font-bold px-2 py-0.5 rounded font-typewriter tracking-wider uppercase border border-[#b91c1c] hidden sm:inline-block">
                  {activeStream.badge}
                </span>

                {/* Player Mode Switcher */}
                <div className="hidden md:flex items-center gap-1 bg-[#100806] border border-[#3e2216] p-0.5 rounded-md text-[10px] font-typewriter">
                  <button
                    onClick={() => setPlayerMode('html5')}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      playerMode === 'html5'
                        ? 'bg-[#3d1a10] text-[#e5c158] font-bold border border-[#6b3520]'
                        : 'text-[#8f745f] hover:text-[#f5ebd4]'
                    }`}
                  >
                    ⚡ Synced HTML5
                  </button>
                  <button
                    onClick={() => setPlayerMode('drive-stream')}
                    className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                      playerMode === 'drive-stream'
                        ? 'bg-[#3d1a10] text-[#e5c158] font-bold border border-[#6b3520]'
                        : 'text-[#8f745f] hover:text-[#f5ebd4]'
                    }`}
                  >
                    Google Drive
                  </button>
                </div>
              </div>
              <p className="font-typewriter text-[10px] text-[#a08774] hidden sm:block">
                Synchronized Video • Live Webcam & Microphone • Realtime Case Chat
              </p>
            </div>
          </div>

          {/* Sync Status Badge & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 bg-[#25150f] border border-[#44281a] px-3 py-1 rounded-full text-xs font-typewriter text-[#d8c5ad]">
              <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <span>{isPlaying ? 'Playing in Sync' : pausedBy ? `Paused by ${pausedBy}` : 'Paused'}</span>
              {lastActionBy && (
                <span className="text-[10px] opacity-75 hidden md:inline">
                  ({lastActionBy})
                </span>
              )}
            </div>

            {/* Open in Dedicated Window / Google Drive */}
            <a
              href={activeStream.viewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-[#25150f] hover:bg-[#382017] border border-[#4a2e20] text-[#e5c158] hover:text-amber-300 rounded-lg text-xs font-typewriter transition-colors cursor-pointer"
              title={`Open ${activeStream.title} in Google Drive player`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Pop-Out</span>
            </a>

            <button
              onClick={() => setIsTheaterExpanded(!isTheaterExpanded)}
              className="p-1.5 bg-[#25150f] hover:bg-[#382017] border border-[#4a2e20] text-[#cfb69b] hover:text-[#f5ebd4] rounded-lg transition-colors cursor-pointer"
              title={isTheaterExpanded ? 'Normal Size' : 'Expand Theater View'}
            >
              {isTheaterExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              className="p-1.5 bg-[#25150f] hover:bg-[#5a1c1c] border border-[#4a2e20] text-[#cfb69b] hover:text-red-300 rounded-lg transition-colors cursor-pointer"
              title="Close Screening Room"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Informative explanation banner */}
        {showInfoBanner && (
          <div className="bg-[#24130c] border-b border-[#44281a] px-4 py-1.5 flex items-center justify-between text-xs font-typewriter text-[#d8c5ad]">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#e5c158] flex-shrink-0" />
              <span>
                <strong>Co-Watching Live:</strong> Pausing, resuming, or seeking will automatically update both of your screens. Talk freely with the microphone and webcam on the right!
              </span>
            </div>
            <button 
              onClick={() => setShowInfoBanner(false)}
              className="text-[#8f745f] hover:text-[#f5ebd4] p-0.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 2. Main Content Grid: Video Stage (Left) + Live Video Call & Chat (Right) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden bg-[#0c0604]">
          {/* Left: Video Player Section */}
          <div className="flex-1 flex flex-col justify-between bg-black relative overflow-hidden group">
            {/* The Video Screen */}
            <div className="flex-1 flex items-center justify-center relative bg-[#050302]">
              {playerMode === 'drive-stream' ? (
                /* Google Drive Transcoded Video Stream */
                <div className="w-full h-full relative flex items-center justify-center">
                  <iframe
                    key={activeStream.driveFileId}
                    src={activeStream.embedUrl}
                    title={`Twin Peaks ${activeStream.title} Video Stream`}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                /* Direct Synchronized HTML5 Video Mode */
                <div className="w-full h-full flex flex-col items-center justify-center relative">
                  <video
                    ref={videoRef}
                    key={`${activeStream.driveFileId}-${selectedEpisode}`}
                    src={customVideoUrl || `/api/episodes/${selectedEpisode}/video`}
                    preload="auto"
                    playsInline
                    controls={false}
                    className="w-full h-full object-contain cursor-pointer"
                    onTimeUpdate={() => {
                      if (videoRef.current) {
                        setCurrentTime(videoRef.current.currentTime);
                      }
                    }}
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        setDuration(videoRef.current.duration || activeStream.durationSeconds);
                      }
                    }}
                    onPlay={() => {
                      if (!isPlaying) handleTogglePlay();
                    }}
                    onPause={() => {
                      if (isPlaying) handleTogglePlay();
                    }}
                  />
                </div>
              )}

              {/* Synchronous 3-2-1 Countdown Overlay */}
              {countdownValue !== null && (
                <div className="absolute inset-0 z-40 bg-black/85 flex flex-col items-center justify-center animate-fadeIn">
                  <div className="text-center">
                    <div className="text-7xl sm:text-9xl font-display font-black text-[#e5c158] animate-ping duration-1000">
                      {countdownValue > 0 ? countdownValue : 'GO!'}
                    </div>
                    <div className="font-typewriter text-sm sm:text-base text-[#f5ebd4] tracking-widest mt-4 uppercase">
                      Synchronized Playback Initiated by {countdownInitiator}
                    </div>
                  </div>
                </div>
              )}

              {/* High-Visibility Action Toast */}
              {actionToast && (
                <div className="absolute top-4 inset-x-0 flex justify-center pointer-events-none z-30 animate-fadeIn">
                  <div className="bg-[#1a0f0b]/95 border-2 border-[#b91c1c] text-[#fdf2f2] px-5 py-2 rounded-xl shadow-2xl font-typewriter text-xs sm:text-sm font-bold flex items-center gap-2 backdrop-blur-md">
                    <span>{actionToast.message}</span>
                  </div>
                </div>
              )}

              {/* Pause Notification Overlay when paused */}
              {!isPlaying && pausedBy && (
                <div className="absolute bottom-6 left-6 z-20 pointer-events-auto bg-[#1b0f0b]/95 border-2 border-amber-600/80 rounded-xl p-3 shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fadeIn">
                  <div className="p-2 bg-amber-950/80 border border-amber-600 rounded-lg text-amber-300">
                    <Pause className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <div className="font-display text-xs text-[#f5ebd4] font-bold">
                      Episode Paused by {pausedBy}
                    </div>
                    <div className="font-typewriter text-[11px] text-amber-200/90 font-mono">
                      At {formatTime(currentTime)}
                    </div>
                  </div>
                  <button
                    onClick={handleTogglePlay}
                    className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] px-3.5 py-1.5 rounded-lg border border-[#b91c1c] text-xs font-typewriter uppercase tracking-wider font-bold transition-all cursor-pointer shadow hover:scale-105"
                  >
                    Resume for Both ▶
                  </button>
                </div>
              )}
            </div>

            {/* Synchronized Dual-Control Watch Bar & Timeline */}
            <div className="bg-gradient-to-t from-[#140b08] via-[#1a0f0b]/98 to-[#160d09] p-3 sm:p-4 border-t border-[#3e2518] flex flex-col gap-2 z-10">
              {/* Timeline Scrubber */}
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

              {/* Controls row */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  {/* Primary Dual-Control Play / Pause */}
                  <button
                    onClick={handleTogglePlay}
                    className={`px-4 py-2 rounded-lg border transition-all cursor-pointer shadow flex items-center gap-2 font-typewriter text-xs font-bold ${
                      isPlaying
                        ? 'bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] border-[#b91c1c]'
                        : 'bg-[#065f46] hover:bg-[#047857] text-[#ecfdf5] border-[#059669] animate-pulse'
                    }`}
                    title="Play or pause the episode simultaneously for both viewers"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="w-4 h-4 fill-current" />
                        <span>Pause for Both</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        <span>Play for Both</span>
                      </>
                    )}
                  </button>

                  {/* Skip backward / forward */}
                  <button
                    onClick={() => handleSkip(-10)}
                    className="px-2.5 py-2 bg-[#25150f] hover:bg-[#382017] text-[#cfb69b] hover:text-[#f5ebd4] rounded-lg border border-[#44281a] text-xs font-mono transition-colors cursor-pointer"
                    title="Rewind 10 seconds together"
                  >
                    -10s
                  </button>
                  <button
                    onClick={() => handleSkip(10)}
                    className="px-2.5 py-2 bg-[#25150f] hover:bg-[#382017] text-[#cfb69b] hover:text-[#f5ebd4] rounded-lg border border-[#44281a] text-xs font-mono transition-colors cursor-pointer"
                    title="Fast forward 10 seconds together"
                  >
                    +10s
                  </button>

                  {/* 3-2-1 Synchronous Countdown Button */}
                  <button
                    onClick={handleTriggerCountdown}
                    className="px-2.5 py-2 bg-[#25150f] hover:bg-[#382017] text-[#e5c158] hover:text-amber-200 rounded-lg border border-[#5a3928] text-xs font-typewriter transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Trigger a synchronized 3-2-1 audio countdown to start together"
                  >
                    <Timer className="w-3.5 h-3.5" />
                    <span>Sync 3-2-1 Start</span>
                  </button>

                  {/* Force Sync */}
                  <button
                    onClick={() => broadcastPlayback(isPlaying, currentTime)}
                    className="p-2 bg-[#25150f] hover:bg-[#382017] text-[#a08774] hover:text-[#e5c158] rounded-lg border border-[#44281a] text-xs font-typewriter transition-colors cursor-pointer flex items-center gap-1"
                    title="Nudge partner to align exactly with this timecode"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">Sync Now</span>
                  </button>
                </div>

                {/* Right: Pin Timestamp Note */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const timeStamp = formatTime(currentTime);
                      if (onPinTheoryToBoard) {
                        onPinTheoryToBoard(
                          `[Episode ${selectedEpisode} Timestamp ${timeStamp}] Suspect sighting or clue spotted during watch party!`,
                          timeStamp
                        );
                        setActionToast({
                          message: `📌 Pinned timestamp ${timeStamp} to Board!`,
                          timestamp: Date.now(),
                        });
                      }
                    }}
                    className="px-3 py-2 bg-[#2e1910] hover:bg-[#422316] border border-[#5a3928] text-[#e5c158] hover:text-amber-200 rounded-lg text-xs font-typewriter transition-colors cursor-pointer flex items-center gap-1.5 shadow"
                    title="Pin this exact timestamp as an investigation sticky note on the corkboard"
                  >
                    <Pin className="w-3.5 h-3.5" />
                    <span>Pin Note @ {formatTime(currentTime)}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Live Video Call & Realtime Chat Sidebar */}
          <div className="w-full lg:w-96 flex flex-col border-t lg:border-t-0 lg:border-l border-[#3e2518] bg-[#140b08]">
            {/* Section A: Webcam & Audio Call Dock */}
            <div className="bg-[#1a0f0b] border-b border-[#3e2518] p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tv className="w-4 h-4 text-red-500" />
                  <span className="font-typewriter text-xs font-bold uppercase tracking-wider text-[#f5ebd4]">
                    Sheriff Video Link
                  </span>
                  <span className={`w-2 h-2 rounded-full ${inCall ? 'bg-emerald-400 animate-ping' : 'bg-amber-600'}`} />
                </div>
                <button
                  onClick={() => setIsWebcamDockMinimized(!isWebcamDockMinimized)}
                  className="p-1 text-[#8f745f] hover:text-[#f5ebd4] rounded cursor-pointer"
                  title={isWebcamDockMinimized ? 'Expand video call' : 'Minimize video call'}
                >
                  {isWebcamDockMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
                </button>
              </div>

              {!isWebcamDockMinimized && (
                <div className="space-y-2">
                  {inCall ? (
                    <div className="grid grid-cols-2 gap-2 aspect-[16/7] bg-black rounded-lg overflow-hidden border border-[#3e2518]">
                      {/* Partner Remote Webcam Screen */}
                      <div className="relative bg-[#0d0705] flex items-center justify-center overflow-hidden">
                        <video
                          ref={handleRemoteWebcamRef}
                          autoPlay
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        {!remoteStream && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center pointer-events-none">
                            <span className="text-xl mb-1 animate-bounce">🦉</span>
                            <span className="font-typewriter text-[10px] text-[#cfb69b]">
                              Connecting to {partnerName}...
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-1 left-1 bg-black/70 text-[9px] font-typewriter text-[#e5c158] px-1.5 py-0.5 rounded">
                          {partnerName}
                        </div>
                      </div>

                      {/* Your Own Local Webcam Screen */}
                      <div className="relative bg-[#0d0705] flex items-center justify-center overflow-hidden">
                        <video
                          ref={handleLocalWebcamRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover transform -scale-x-100"
                        />
                        {isVideoOff && (
                          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-[10px] font-typewriter text-red-300">
                            <VideoOff className="w-4 h-4 mb-1 text-red-400" />
                            <span>Camera Off</span>
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 bg-black/70 text-[9px] font-typewriter text-[#d8c5ad] px-1.5 py-0.5 rounded flex items-center gap-1">
                          {isAudioMuted ? <MicOff className="w-2.5 h-2.5 text-red-400" /> : <Mic className="w-2.5 h-2.5 text-emerald-400" />}
                          <span>You</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Inactive Call Placeholder with Start Call Button */
                    <div className="bg-[#120906] border border-[#3e2518] rounded-lg p-3 text-center flex flex-col items-center justify-center">
                      <p className="font-typewriter text-xs text-[#d8c5ad] mb-2 font-bold">
                        Talk and see each other while watching!
                      </p>
                      <button
                        onClick={() => startCall()}
                        className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] px-4 py-2 rounded-lg border border-[#b91c1c] font-typewriter text-xs uppercase tracking-wider font-bold shadow transition-all cursor-pointer flex items-center gap-2 hover:scale-105"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-amber-300" />
                        <span>Start Video & Voice Link</span>
                      </button>
                      <p className="font-editorial italic text-[11px] text-[#8e7360] mt-1.5">
                        Peer-to-peer WebRTC video with camera & microphone controls
                      </p>
                    </div>
                  )}

                  {/* Camera, Microphone & Call Controls Toolbar */}
                  {inCall && (
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleMic}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-typewriter flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isAudioMuted
                              ? 'bg-red-950 border-red-700 text-red-200'
                              : 'bg-[#2a170f] border-[#4a2e20] hover:bg-[#382017] text-[#f5ebd4]'
                          }`}
                          title={isAudioMuted ? 'Turn microphone ON' : 'Turn microphone OFF (Mute)'}
                        >
                          {isAudioMuted ? <MicOff className="w-3.5 h-3.5 text-red-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                          <span>{isAudioMuted ? 'Mic Muted' : 'Mic ON'}</span>
                        </button>

                        <button
                          onClick={toggleCamera}
                          className={`px-3 py-1.5 rounded-lg border text-xs font-typewriter flex items-center gap-1.5 transition-colors cursor-pointer ${
                            isVideoOff
                              ? 'bg-red-950 border-red-700 text-red-200'
                              : 'bg-[#2a170f] border-[#4a2e20] hover:bg-[#382017] text-[#f5ebd4]'
                          }`}
                          title={isVideoOff ? 'Turn camera ON' : 'Turn camera OFF'}
                        >
                          {isVideoOff ? <VideoOff className="w-3.5 h-3.5 text-red-400" /> : <Video className="w-3.5 h-3.5 text-emerald-400" />}
                          <span>{isVideoOff ? 'Cam Off' : 'Cam ON'}</span>
                        </button>
                      </div>

                      <button
                        onClick={endCall}
                        className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 px-3 py-1.5 rounded-lg text-xs font-typewriter flex items-center gap-1 cursor-pointer transition-colors"
                        title="Disconnect video call"
                      >
                        <PhoneOff className="w-3.5 h-3.5" />
                        <span>Disconnect</span>
                      </button>
                    </div>
                  )}

                  {rtcErrorMsg && (
                    <div className="bg-red-950/80 border border-red-800 text-red-200 text-[10px] p-1.5 rounded flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      <span>{rtcErrorMsg}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Section B: Synchronized Live Chat & Theory Clues Log */}
            <div className="flex-1 flex flex-col justify-between overflow-hidden bg-[#160d09]">
              {/* Chat Header */}
              <div className="px-3 py-2 bg-[#1e120d] border-b border-[#382216] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#e5c158]" />
                  <span className="font-typewriter text-xs uppercase font-bold text-[#f5ebd4] tracking-wider">
                    Episode Discussion & Clues
                  </span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400">
                  ● Real-Time WebSocket
                </span>
              </div>

              {/* Message List */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto p-3 space-y-3 font-typewriter text-xs"
              >
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
                        className={`p-2.5 rounded-xl max-w-[88%] break-words relative shadow ${
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
                            <span>Theory / Clue Observation</span>
                          </div>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>

                        {/* Quick action to pin theory to corkboard */}
                        {onPinTheoryToBoard && (
                          <button
                            onClick={() => handlePinClueToBoard(msg)}
                            className="mt-1.5 text-[10px] text-amber-300 hover:text-white flex items-center gap-1 bg-black/40 px-1.5 py-0.5 rounded cursor-pointer transition-colors"
                            title="Pin this clue to the active investigation board"
                          >
                            <Pin className="w-2.5 h-2.5" />
                            <span>Pin to Board</span>
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
                className="p-2.5 bg-[#1a0f0b] border-t border-[#382216] flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-1.5 text-[11px] font-typewriter text-[#d8c5ad] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTheoryClue}
                      onChange={(e) => setIsTheoryClue(e.target.checked)}
                      className="accent-[#b91c1c] rounded"
                    />
                    <span>Mark as Case Clue</span>
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
                        ? 'Record clue observation at current timestamp...'
                        : 'Discuss scene with partner...'
                    }
                    className="flex-1 bg-[#25150f] border border-[#4a2e20] rounded-lg px-3 py-2 text-xs font-typewriter text-[#f5ebd4] placeholder-[#8f745f] focus:outline-none focus:border-[#b91c1c]"
                  />
                  <button
                    type="submit"
                    className="p-2 bg-[#83161c] hover:bg-[#991b1b] border border-[#b91c1c] text-[#fdf2f2] rounded-lg transition-colors cursor-pointer"
                    title="Send message"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

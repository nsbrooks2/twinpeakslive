import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from '../context/WebRTCContext';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  PhoneCall,
  Minimize2, 
  Maximize2, 
  Tv, 
  AlertCircle
} from 'lucide-react';

function playChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.8);
  } catch {
    // ignore
  }
}

interface VideoProps {
  currentUserId?: string;
  partnerName?: string;
  boardId?: string;
}

export const VideoChatPanel: React.FC<VideoProps> = () => {
  const {
    inCall,
    isRinging,
    isAudioMuted,
    isVideoOff,
    connectionState,
    errorMsg,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    declineCall,
    endCall,
    toggleMic,
    toggleCamera,
    partnerName,
  } = useWebRTC();

  const [isMinimized, setIsMinimized] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Play chime on incoming ring
  useEffect(() => {
    if (isRinging) {
      playChime();
      const interval = setInterval(playChime, 3000);
      return () => clearInterval(interval);
    }
  }, [isRinging]);

  // Ensure remote audio stream is playing even if video container is hidden or muted
  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      if (remoteAudioRef.current.srcObject !== remoteStream) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
      remoteAudioRef.current
        .play()
        .then(() => setAudioBlocked(false))
        .catch((err) => {
          console.warn('[VideoChat] Audio autoplay blocked by browser policy:', err);
          setAudioBlocked(true);
        });
    }
  }, [remoteStream, inCall]);

  const unlockAudio = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current
        .play()
        .then(() => setAudioBlocked(false))
        .catch(() => {});
    }
  };

  // Callback refs ensure the stream is attached IMMEDIATELY when the element mounts or unminimizes
  const handleRemoteVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      remoteVideoRef.current = el;
      if (el && remoteStream) {
        if (el.srcObject !== remoteStream) {
          el.srcObject = remoteStream;
        }
        el.setAttribute('playsinline', 'true');
        el.play().catch(() => {});
      }
    },
    [remoteStream]
  );

  const handleLocalVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      localVideoRef.current = el;
      if (el && localStream) {
        if (el.srcObject !== localStream) {
          el.srcObject = localStream;
        }
        el.setAttribute('playsinline', 'true');
        el.play().catch(() => {});
      }
    },
    [localStream]
  );

  // Sync streams whenever stream or minimization state changes
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, inCall, isMinimized]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      if (remoteVideoRef.current.srcObject !== remoteStream) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteStream, inCall, isMinimized]);

  // If partner is ringing us, show high-priority incoming call dialog with user-gesture answer button
  if (isRinging) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
        <div className="relative w-full max-w-sm bg-[#1e100a] border-4 border-[#b91c1c] rounded-2xl p-6 shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-[#f5ebd4] text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-950 border-2 border-red-600 flex items-center justify-center animate-bounce shadow-[0_0_25px_rgba(220,38,38,0.7)]">
            <PhoneCall className="w-8 h-8 text-amber-300 animate-pulse" />
          </div>
          <div>
            <span className="font-typewriter text-[11px] text-[#e5c158] uppercase tracking-widest font-bold">
              Dispatch Transmission
            </span>
            <h3 className="font-display font-black text-lg text-[#f5ebd4] mt-1">
              Incoming Video Call
            </h3>
            <p className="font-typewriter text-xs text-[#cfb69b] mt-1">
              {partnerName || 'Partner Detective'} is calling you live from Michigan / Alabama!
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => acceptCall()}
              className="flex-1 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-800 text-white font-typewriter text-xs uppercase tracking-wider font-bold py-3.5 px-4 rounded-xl shadow-lg border border-emerald-500 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-105 active:scale-95 min-h-[44px]"
            >
              <Video className="w-4 h-4" />
              <span>Answer Call</span>
            </button>
            <button
              onClick={() => declineCall()}
              className="bg-red-950 hover:bg-red-900 active:bg-red-950 text-red-200 font-typewriter text-xs uppercase tracking-wider py-3.5 px-4 rounded-xl border border-red-800 transition-all cursor-pointer min-h-[44px]"
            >
              <span>Decline</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // If not in call and closed, show floating button to start video link
  if (!inCall) {
    return (
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40">
        <button
          onClick={() => startCall()}
          className="group relative flex items-center gap-2 bg-[#83161c] hover:bg-[#991b1b] active:bg-[#6b1216] border-2 border-[#b91c1c] text-[#fdf2f2] px-3.5 py-2.5 sm:px-4 sm:py-2.5 rounded-full shadow-[0_10px_25px_rgba(153,27,27,0.5)] transition-all transform hover:scale-105 active:scale-95 font-typewriter text-xs tracking-wider cursor-pointer min-h-[44px]"
          title="Start webcam and audio link with partner"
        >
          <Tv className="w-4 h-4 text-amber-300 animate-pulse flex-shrink-0" />
          <span className="truncate max-w-[170px] sm:max-w-none">Call Partner (Cam/Mic)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
        </button>
      </div>
    );
  }

  // Minimized PIP widget
  if (isMinimized) {
    return (
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 bg-[#1c120e] border-2 border-[#5a3928] rounded-xl p-2.5 sm:p-3 shadow-2xl flex items-center gap-2.5 sm:gap-3 animate-slideUp max-w-[calc(100vw-24px)]">
        {/* Hidden persistent remote audio tag */}
        <audio ref={remoteAudioRef} autoPlay playsInline />

        <div className="relative w-12 h-12 sm:w-14 sm:h-14 bg-black rounded-lg overflow-hidden border border-[#3e2518] flex items-center justify-center flex-shrink-0">
          <video
            ref={handleRemoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
          {!remoteStream && (
            <span className="text-xl select-none">🦉</span>
          )}
          <div className="absolute inset-0 bg-red-900/10 pointer-events-none" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-display text-xs text-[#f5ebd4] font-bold truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping flex-shrink-0" />
            <span className="truncate">Live Video Link</span>
          </div>
          <p className="font-typewriter text-[10px] text-[#a08774] truncate">
            {connectionState === 'connected' ? `Live with ${partnerName}` : 'Connecting...'}
          </p>
          {audioBlocked && (
            <button
              onClick={unlockAudio}
              className="text-[10px] text-amber-400 underline font-typewriter cursor-pointer hover:text-amber-200"
            >
              Tap to unmute partner audio
            </button>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-2 hover:bg-[#341d13] text-[#e8dfd8] rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Expand video window"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={endCall}
            className="p-2 bg-red-900/80 hover:bg-red-800 text-white rounded transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="End call"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Full Sheriff CRT Monitor Bezel Window
  return (
    <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-40 w-[calc(100vw-24px)] max-w-sm sm:w-96 bg-[#1a0f0b] border-4 border-[#3e2216] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden animate-scaleIn">
      {/* Hidden persistent remote audio tag */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* 90s TV Monitor Header */}
      <div className="bg-[#2a170f] border-b border-[#44281a] px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
          </div>
          <span className="font-typewriter text-[11px] text-[#f5ebd4] tracking-wider uppercase font-bold">
            SHERIFF TV-LINK // {partnerName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1 text-[#9c8472] hover:text-[#f5ebd4] rounded transition-colors cursor-pointer"
            title="Minimize to PIP"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={endCall}
            className="p-1 text-red-400 hover:text-red-200 rounded transition-colors cursor-pointer"
            title="Disconnect call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Unmute alert if browser blocked audio */}
      {audioBlocked && (
        <div
          onClick={unlockAudio}
          className="bg-amber-950/90 border-b border-amber-700 px-3 py-2 text-center text-amber-200 text-xs font-typewriter cursor-pointer hover:bg-amber-900 transition-colors"
        >
          🔊 Browser muted incoming audio. <strong>Tap here to unmute</strong>
        </div>
      )}

      {/* Screen area with CRT Scanlines */}
      <div className="relative aspect-video bg-black overflow-hidden group">
        {/* Dedicated audio element ensuring remote audio track always outputs */}
        <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

        {/* Remote video stream (Partner) */}
        <video
          ref={handleRemoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

        {/* Unblock audio tap prompt if browser restricted autoplay */}
        {audioBlocked && (
          <button
            onClick={unlockAudio}
            className="absolute top-2 left-2 z-30 bg-amber-500 hover:bg-amber-400 text-black text-[11px] font-bold font-typewriter px-2.5 py-1 rounded shadow-lg animate-pulse cursor-pointer flex items-center gap-1.5"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Tap to Unmute Audio</span>
          </button>
        )}

        {/* Fallback placeholder if partner video not yet flowing */}
        {!remoteStream && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none">
            <div className="text-3xl mb-1 select-none animate-bounce">🦉</div>
            <span className="font-typewriter text-xs text-[#d8c5ad] tracking-wider uppercase">
              {connectionState === 'connected'
                ? `${partnerName} (Connected)`
                : `Waiting for ${partnerName} to connect...`}
            </span>
            <span className="font-editorial italic text-[11px] text-[#8e7360] mt-1">
              Twin Peaks Dispatch Video Relay
            </span>
          </div>
        )}

        {/* Local video PIP (You) */}
        <div className="absolute top-2 right-2 w-24 h-18 bg-[#180e0a] border border-[#5a3928] rounded-md overflow-hidden shadow-lg">
          <video
            ref={handleLocalVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />
          <div className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] font-typewriter text-[#d8c5ad] px-1 text-center truncate">
            {isVideoOff ? 'Cam Off' : 'You'}
          </div>
        </div>

        {/* Subtle VHS scanlines & vignette */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)50%,rgba(0,0,0,0.3)50%)] bg-[length:100%_4px] pointer-events-none opacity-40" />
      </div>

      {/* Error warning if any */}
      {errorMsg && (
        <div className="bg-red-950/80 border-t border-red-800 text-red-200 text-[11px] p-2 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Retro Controller Bar */}
      <div className="bg-[#24130d] p-3 flex items-center justify-between border-t border-[#3e2216]">
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMic}
            className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
              isAudioMuted
                ? 'bg-red-950 border-red-700 text-red-300'
                : 'bg-[#361e14] border-[#5a3928] hover:bg-[#4d2c1e] text-[#f5ebd4]'
            }`}
            title={isAudioMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isAudioMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={toggleCamera}
            className={`min-w-[42px] min-h-[42px] flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
              isVideoOff
                ? 'bg-red-950 border-red-700 text-red-300'
                : 'bg-[#361e14] border-[#5a3928] hover:bg-[#4d2c1e] text-[#f5ebd4]'
            }`}
            title={isVideoOff ? 'Enable camera' : 'Disable camera'}
          >
            {isVideoOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-typewriter text-[10px] text-[#9c8472] uppercase tracking-wider">
            {connectionState === 'connected' ? 'LIVE' : connectionState}
          </span>
          <button
            onClick={endCall}
            className="bg-[#83161c] hover:bg-[#991b1b] active:bg-[#6e1217] border border-[#b91c1c] text-[#fdf2f2] px-3.5 py-2 min-h-[42px] rounded-lg text-xs font-typewriter uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer font-bold"
            title="End call"
          >
            <PhoneOff className="w-4 h-4" />
            <span>End Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};

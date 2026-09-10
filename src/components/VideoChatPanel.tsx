import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWebRTC } from '../context/WebRTCContext';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  PhoneOff, 
  Minimize2, 
  Maximize2, 
  Tv, 
  AlertCircle
} from 'lucide-react';

interface VideoProps {
  currentUserId?: string;
  partnerName?: string;
  boardId?: string;
}

export const VideoChatPanel: React.FC<VideoProps> = () => {
  const {
    inCall,
    isAudioMuted,
    isVideoOff,
    connectionState,
    errorMsg,
    localStream,
    remoteStream,
    startCall,
    endCall,
    toggleMic,
    toggleCamera,
    partnerName,
  } = useWebRTC();

  const [isMinimized, setIsMinimized] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  // Callback refs ensure the stream is attached IMMEDIATELY when the element mounts or unminimizes
  const handleRemoteVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      remoteVideoRef.current = el;
      if (el && remoteStream) {
        if (el.srcObject !== remoteStream) {
          el.srcObject = remoteStream;
        }
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

  // If not in call and closed, show floating button to start video link
  if (!inCall) {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => startCall()}
          className="group relative flex items-center gap-2.5 bg-[#83161c] hover:bg-[#991b1b] border-2 border-[#b91c1c] text-[#fdf2f2] px-4 py-2.5 rounded-full shadow-[0_10px_25px_rgba(153,27,27,0.5)] transition-all transform hover:scale-105 active:scale-95 font-typewriter text-xs tracking-wider cursor-pointer"
          title="Start webcam and audio link with partner"
        >
          <Tv className="w-4 h-4 text-amber-300 animate-pulse" />
          <span>Call Partner (Webcam & Mic)</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
        </button>
      </div>
    );
  }

  // Minimized PIP widget
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-40 bg-[#1c120e] border-2 border-[#5a3928] rounded-xl p-3 shadow-2xl flex items-center gap-3 animate-slideUp">
        <div className="relative w-14 h-14 bg-black rounded-lg overflow-hidden border border-[#3e2518] flex items-center justify-center">
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
        <div>
          <div className="flex items-center gap-1.5 font-display text-xs text-[#f5ebd4] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Video Link Active</span>
          </div>
          <p className="font-typewriter text-[10px] text-[#a08774]">
            {connectionState === 'connected' ? `Live with ${partnerName}` : 'Connecting...'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(false)}
            className="p-1.5 hover:bg-[#341d13] text-[#e8dfd8] rounded transition-colors cursor-pointer"
            title="Expand video window"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            onClick={endCall}
            className="p-1.5 bg-red-900/80 hover:bg-red-800 text-white rounded transition-colors cursor-pointer"
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
    <div className="fixed bottom-5 right-5 z-40 w-80 sm:w-96 bg-[#1a0f0b] border-4 border-[#3e2216] rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] overflow-hidden animate-scaleIn">
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

      {/* Screen area with CRT Scanlines */}
      <div className="relative aspect-video bg-black overflow-hidden group">
        {/* Remote video stream (Partner) */}
        <video
          ref={handleRemoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />

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
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
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
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
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
            className="bg-[#83161c] hover:bg-[#991b1b] border border-[#b91c1c] text-[#fdf2f2] px-3 py-1.5 rounded text-xs font-typewriter uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
            title="End call"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End</span>
          </button>
        </div>
      </div>
    </div>
  );
};

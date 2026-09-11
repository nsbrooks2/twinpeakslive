import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { WebRTCManager } from '../lib/webrtcService';

interface WebRTCContextType {
  inCall: boolean;
  isRinging: boolean;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  connectionState: RTCPeerConnectionState;
  errorMsg: string | null;
  incomingCallFrom: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: () => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  endCall: () => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  partnerName: string;
}

const WebRTCContext = createContext<WebRTCContextType | null>(null);

export const useWebRTC = () => {
  const context = useContext(WebRTCContext);
  if (!context) {
    throw new Error('useWebRTC must be used within a WebRTCProvider');
  }
  return context;
};

interface WebRTCProviderProps {
  children: React.ReactNode;
  currentUserId: string;
  partnerName: string;
  boardId: string;
}

export const WebRTCProvider: React.FC<WebRTCProviderProps> = ({
  children,
  currentUserId,
  partnerName,
  boardId,
}) => {
  const [inCall, setInCall] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [incomingCallFrom, setIncomingCallFrom] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const rtcManagerRef = useRef<WebRTCManager | null>(null);

  useEffect(() => {
    const manager = new WebRTCManager(currentUserId, boardId);
    rtcManagerRef.current = manager;

    manager.onRemoteStreamCallback = (stream) => {
      setRemoteStream(stream);
    };

    manager.onConnectionStateChangeCallback = (state) => {
      setConnectionState(state);
    };

    manager.onIncomingCallCallback = (from) => {
      setIncomingCallFrom(from);
      setIsRinging(true);
    };

    return () => {
      manager.cleanup();
      setInCall(false);
      setIsRinging(false);
      setLocalStream(null);
      setRemoteStream(null);
    };
  }, [currentUserId, boardId]);

  const startCall = async () => {
    setErrorMsg(null);
    try {
      if (!rtcManagerRef.current) return;
      const stream = await rtcManagerRef.current.startLocalMedia(!isVideoOff, !isAudioMuted);
      setLocalStream(stream);
      setInCall(true);
      await rtcManagerRef.current.initiateCall();
    } catch (err: unknown) {
      console.error('Failed to start call / get media:', err);
      const msg = err instanceof Error ? err.message : 'Media permission denied';
      setErrorMsg(`Webcam / Mic Error: ${msg}. Check browser permissions.`);
    }
  };

  const acceptCall = async () => {
    setErrorMsg(null);
    try {
      if (!rtcManagerRef.current) return;
      const stream = await rtcManagerRef.current.startLocalMedia(!isVideoOff, !isAudioMuted);
      setLocalStream(stream);
      setIsRinging(false);
      setInCall(true);
      await rtcManagerRef.current.acceptPendingCall();
    } catch (err: unknown) {
      console.error('Failed to accept call:', err);
      const msg = err instanceof Error ? err.message : 'Media permission denied';
      setErrorMsg(`Webcam / Mic Error: ${msg}. Check browser permissions.`);
    }
  };

  const declineCall = () => {
    setIsRinging(false);
    setIncomingCallFrom(null);
    if (rtcManagerRef.current) {
      rtcManagerRef.current.endCall(true);
    }
  };

  const endCall = () => {
    if (rtcManagerRef.current) {
      rtcManagerRef.current.endCall(true);
    }
    setLocalStream(null);
    setRemoteStream(null);
    setInCall(false);
    setIsRinging(false);
    setIncomingCallFrom(null);
    setConnectionState('closed');
  };

  const toggleMic = () => {
    if (rtcManagerRef.current) {
      const muted = rtcManagerRef.current.toggleMute();
      setIsAudioMuted(muted);
    }
  };

  const toggleCamera = () => {
    if (rtcManagerRef.current) {
      const off = rtcManagerRef.current.toggleCamera();
      setIsVideoOff(off);
    }
  };

  return (
    <WebRTCContext.Provider
      value={{
        inCall,
        isRinging,
        isAudioMuted,
        isVideoOff,
        connectionState,
        errorMsg,
        incomingCallFrom,
        localStream,
        remoteStream,
        startCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMic,
        toggleCamera,
        partnerName,
      }}
    >
      {children}
    </WebRTCContext.Provider>
  );
};

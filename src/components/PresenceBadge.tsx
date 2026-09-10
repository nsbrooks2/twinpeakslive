import React, { useState } from 'react';
import { PresenceUser } from '../types';
import { Users, Server, Shield, Radio, CheckCircle2, Video, X } from 'lucide-react';

interface PresenceProps {
  currentUser: { email: string; name: string; role?: string };
  presenceUsers: PresenceUser[];
  boardTitle: string;
  isServerConnected?: boolean;
}

export const PresenceBadge: React.FC<PresenceProps> = ({
  currentUser,
  presenceUsers,
  boardTitle,
  isServerConnected = true,
}) => {
  const [isRosterOpen, setIsRosterOpen] = useState(false);

  // Filter other users on the server
  const otherUsers = presenceUsers.filter(
    (u) => u.email !== currentUser.email && u.name !== currentUser.name
  );

  const isPartnerOnline = otherUsers.length > 0;
  const partnerName = otherUsers[0]?.name || (currentUser.name.includes('Dale') ? 'Girlfriend' : 'Agent Dale Cooper');

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Main Server Presence Pill */}
        <button
          onClick={() => setIsRosterOpen(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-typewriter tracking-wide transition-all cursor-pointer shadow-md ${
            isPartnerOnline
              ? 'bg-[#2a0f0d] border-[#b91c1c] text-[#fca5a5] hover:bg-[#3d1411] shadow-[0_0_15px_rgba(185,28,28,0.35)]'
              : 'bg-[#1a100c] border-[#382216] text-[#cfb69b] hover:bg-[#25150f]'
          }`}
          title="Click to view Sheriff Dispatch Server Roster"
        >
          {/* Pulsing indicator */}
          <span className="relative flex h-2.5 w-2.5">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isPartnerOnline ? 'bg-red-400' : 'bg-emerald-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                isPartnerOnline ? 'bg-red-600' : 'bg-emerald-500'
              }`}
            />
          </span>

          <span className="font-semibold">
            {isPartnerOnline ? `${partnerName} & You Online` : 'Server: 1 Online (You)'}
          </span>

          <span className="bg-[#120906] px-1.5 py-0.5 rounded text-[10px] text-[#e5c158] border border-[#3e2216]">
            {presenceUsers.length || 1} on server
          </span>
        </button>
      </div>

      {/* Sheriff Dispatch Server Roster Modal */}
      {isRosterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#180e0a] border-2 border-[#5a3928] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scaleIn">
            {/* Header */}
            <div className="bg-[#24130c] border-b border-[#44281a] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 bg-[#3a1b12] rounded-lg text-[#e5c158] border border-[#5a3928]">
                  <Server className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-[#f5ebd4] tracking-wider uppercase">
                    Sheriff Dispatch Server
                  </h3>
                  <div className="flex items-center gap-1.5 text-[10px] font-typewriter text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Real-Time WebSocket Link Active</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsRosterOpen(false)}
                className="p-1 text-[#8f745f] hover:text-[#f5ebd4] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content: Connected Agents List */}
            <div className="p-4 space-y-4">
              <div>
                <div className="text-[11px] font-typewriter uppercase tracking-wider text-[#a08774] mb-2 flex items-center justify-between">
                  <span>Connected Agents on Server ({presenceUsers.length || 1})</span>
                  <span className="text-[10px] text-[#e5c158]">Automatic Sync</span>
                </div>

                <div className="space-y-2">
                  {/* Current User */}
                  <div className="bg-[#20130d] border border-[#3e2518] rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[#83161c] border border-[#b91c1c] flex items-center justify-center font-display font-bold text-sm text-[#fdf2f2] shadow">
                        {currentUser.name.charAt(0)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-display text-xs font-bold text-[#f5ebd4]">
                            {currentUser.name}
                          </span>
                          <span className="bg-[#3e1e16] text-[#e5c158] text-[9px] px-1.5 py-0.5 rounded font-typewriter uppercase">
                            You
                          </span>
                        </div>
                        <div className="text-[11px] font-typewriter text-[#8f745f]">
                          {currentUser.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-typewriter text-emerald-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      <span>Connected</span>
                    </div>
                  </div>

                  {/* Remote Users */}
                  {otherUsers.map((u, idx) => (
                    <div
                      key={u.user_id || u.email || idx}
                      className="bg-[#20130d] border border-[#5a3928] rounded-xl p-3 flex items-center justify-between shadow"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-amber-900/60 border border-amber-600/70 flex items-center justify-center font-display font-bold text-sm text-amber-200 shadow">
                          {u.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-display text-xs font-bold text-[#f5ebd4]">
                              {u.name}
                            </span>
                            <span className="bg-[#44281a] text-[#cfb69b] text-[9px] px-1.5 py-0.5 rounded font-typewriter uppercase">
                              Active Partner
                            </span>
                          </div>
                          <div className="text-[11px] font-typewriter text-[#8f745f]">
                            {u.email}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-1.5 text-[11px] font-typewriter text-emerald-400 font-bold">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>Online</span>
                        </div>
                        {u.isWatching && (
                          <div className="flex items-center gap-1 text-[10px] font-typewriter text-[#e5c158] mt-0.5">
                            <Video className="w-3 h-3" />
                            <span>In Screening Room</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Partner offline helper */}
                  {otherUsers.length === 0 && (
                    <div className="bg-[#1a0f0b] border border-dashed border-[#44281a] rounded-xl p-3 text-center">
                      <div className="text-xl mb-1">🌲</div>
                      <div className="font-display text-xs text-[#cfb69b] font-semibold">
                        Waiting for Investigative Partner
                      </div>
                      <p className="text-[11px] font-typewriter text-[#8f745f] mt-1">
                        Open the website in another tab or have your partner connect — their presence, episode playback, and clue edits will instantly appear here on the server.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Server System Stats */}
              <div className="bg-[#120906] border border-[#3e2216] rounded-xl p-3 space-y-1.5 text-[11px] font-typewriter text-[#a08774]">
                <div className="flex justify-between">
                  <span>Server Port:</span>
                  <span className="text-[#f5ebd4]">3000 (Express & WebSocket)</span>
                </div>
                <div className="flex justify-between">
                  <span>Case Board Sync:</span>
                  <span className="text-emerald-400 font-bold">Real-time Bi-directional</span>
                </div>
                <div className="flex justify-between">
                  <span>Disk Persistence:</span>
                  <span className="text-emerald-400 font-bold">data/db.json (Saved on close)</span>
                </div>
                <div className="flex justify-between">
                  <span>Screening Room Sync:</span>
                  <span className="text-emerald-400 font-bold">Synchronized Playback</span>
                </div>
              </div>

              <button
                onClick={() => setIsRosterOpen(false)}
                className="w-full py-2 bg-[#2d170f] hover:bg-[#3d1f15] border border-[#5a3928] text-[#f5ebd4] rounded-xl font-typewriter text-xs font-bold transition-all cursor-pointer"
              >
                Close Roster
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

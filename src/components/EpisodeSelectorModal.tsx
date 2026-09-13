import React, { useState } from 'react';
import { EpisodeBoard } from '../types';
import { EPISODE_STREAMS } from '../seedData';
import { Plus, Copy, FolderPlus, Clock, Film, CheckCircle2, ChevronRight, X, ArrowRightLeft, RotateCcw } from 'lucide-react';
import { BoardRepository } from '../lib/boardStore';

interface EpisodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  boards: EpisodeBoard[];
  activeBoardId: string;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: (params: {
    title: string;
    episodeNumber: number;
    description?: string;
    duplicateFromBoardId?: string;
  }) => Promise<void>;
  onOpenCarryOver?: () => void;
}

export const EpisodeSelectorModal: React.FC<EpisodeModalProps> = ({
  isOpen,
  onClose,
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onOpenCarryOver,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creationMode, setCreationMode] = useState<'duplicate' | 'blank'>('duplicate');
  const [sourceBoardId, setSourceBoardId] = useState(activeBoardId || boards[0]?.id || '');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const nextEpisodeNum = boards.length + 1;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setLoading(true);
    try {
      await onCreateBoard({
        title: newTitle.trim(),
        episodeNumber: nextEpisodeNum,
        description: newDescription.trim(),
        duplicateFromBoardId: creationMode === 'duplicate' ? sourceBoardId : undefined,
      });
      setIsCreating(false);
      setNewTitle('');
      setNewDescription('');
      onClose();
    } catch (err) {
      console.error('Failed to create episode board:', err);
    } finally {
      setLoading(false);
    }
  };

  const startNewEpisodeFlow = () => {
    setNewTitle(`Episode ${nextEpisodeNum}`);
    setSourceBoardId(activeBoardId || boards[boards.length - 1]?.id || '');
    setCreationMode('duplicate');
    setIsCreating(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#1c120e] border-4 border-[#4a2e20] rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-[#e8dfd8] overflow-hidden">
        {/* Top Twin Peaks header stripe */}
        <div className="bg-[#12281d] border-b-2 border-[#bfa265] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌲</span>
            <div>
              <h2 className="font-display font-black text-xl text-[#f5ebd4] tracking-wider uppercase">
                Twin Peaks Case Files
              </h2>
              <p className="font-typewriter text-xs text-[#a3c2b1]">
                Sheriff Station Episode Dossier Archives
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#9ea49f] hover:text-[#f5ebd4] p-1 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {!isCreating ? (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <span className="font-typewriter text-xs text-[#b89f89] uppercase tracking-wider">
                  Recorded Case Boards ({boards.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      BoardRepository.resetToAllDefaultBoards();
                      window.location.reload();
                    }}
                    className="bg-[#1a281e] hover:bg-[#25392b] text-[#86efac] px-2.5 py-1.5 rounded text-xs font-typewriter uppercase tracking-wider flex items-center gap-1.5 transition-all border border-[#2e5238] hover:border-[#4ade80] cursor-pointer shadow"
                    title="Force sync & restore all Season 1 episode boards (Episodes 1 to 8)"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sync Episodes 1-8</span>
                  </button>
                  {onOpenCarryOver && boards.length > 1 && (
                    <button
                      onClick={() => {
                        onClose();
                        onOpenCarryOver();
                      }}
                      className="bg-[#241610] hover:bg-[#382017] text-[#e5c158] px-3 py-1.5 rounded text-xs font-typewriter uppercase tracking-wider flex items-center gap-1.5 transition-all border border-[#6b4530] hover:border-[#bfa265] cursor-pointer shadow"
                      title="Carry over or merge evidence across episode boards"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                      <span>Carry Over Board</span>
                    </button>
                  )}
                  <button
                    onClick={startNewEpisodeFlow}
                    className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] px-3.5 py-1.5 rounded text-xs font-typewriter uppercase tracking-wider flex items-center gap-1.5 transition-all shadow hover:shadow-red-950/50 cursor-pointer border border-[#b91c1c]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ New Episode Board</span>
                  </button>
                </div>
              </div>

              {/* Boards list */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {boards.map((b) => {
                  const isActive = b.id === activeBoardId;
                  const formattedDate = new Date(b.updated_at || b.created_at).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        onSelectBoard(b.id);
                        onClose();
                      }}
                      className={`group p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        isActive
                          ? 'bg-[#311a12] border-[#b91c1c] shadow-[0_0_15px_rgba(185,28,28,0.3)]'
                          : 'bg-[#150d09] border-[#382216] hover:bg-[#25150e] hover:border-[#5a3928]'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 p-2 rounded ${isActive ? 'bg-red-950 text-red-400' : 'bg-[#27170f] text-[#a88d77]'}`}>
                          <Film className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-base text-[#f5ebd4] tracking-wide">
                              {b.title}
                            </h3>
                            {isActive && (
                              <span className="flex items-center gap-1 font-typewriter text-[10px] bg-red-950/80 text-red-300 border border-red-800 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                Active Board
                              </span>
                            )}
                            {Boolean(EPISODE_STREAMS[b.episode_number]) && (
                              <span className="flex items-center gap-1 font-typewriter text-[10px] bg-amber-950/60 text-[#e5c158] border border-amber-800/80 px-2 py-0.5 rounded-full">
                                📼 Video Ready
                              </span>
                            )}
                          </div>
                          {b.description && (
                            <p className="font-editorial italic text-xs text-[#a08774] mt-0.5 max-w-md line-clamp-1">
                              {b.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 font-typewriter text-[10px] text-[#78614e]">
                            <Clock className="w-3 h-3" />
                            <span>Last updated: {formattedDate}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-[#78614e] group-hover:text-[#f5ebd4] transition-colors">
                        <span className="font-typewriter text-xs hidden sm:inline">Open Case</span>
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="border-b border-[#382216] pb-2">
                <h3 className="font-display font-bold text-lg text-[#f5ebd4]">
                  New Episode Investigation Board
                </h3>
                <p className="font-editorial italic text-xs text-[#a08774]">
                  Create a new whiteboard canvas for your next watch session.
                </p>
              </div>

              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                  Episode Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Episode 2: Zen, or the Skill to Catch a Killer"
                  className="w-full bg-[#0e0705] border border-[#44281a] rounded px-3 py-2 text-sm text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c]"
                />
              </div>

              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                  Investigation Log / Notes (Optional)
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="e.g. Tibetan method rocks and bottles inquiry..."
                  className="w-full bg-[#0e0705] border border-[#44281a] rounded px-3 py-2 text-sm text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c]"
                />
              </div>

              {/* Starting Mode Choice: Duplicate vs Blank */}
              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-2">
                  Board Starting Configuration:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setCreationMode('duplicate')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      creationMode === 'duplicate'
                        ? 'bg-[#2b1810] border-[#b91c1c] text-[#f5ebd4]'
                        : 'bg-[#120a07] border-[#382216] text-[#9c8472] hover:border-[#523322]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Copy className="w-4 h-4 text-red-500" />
                      <span className="font-typewriter text-xs font-bold uppercase">
                        Duplicate Previous Board
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug">
                      Clones all character cards, clues, alibis, pins, and red strings as a starting point. Old episode remains intact!
                    </p>
                  </div>

                  <div
                    onClick={() => setCreationMode('blank')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      creationMode === 'blank'
                        ? 'bg-[#2b1810] border-[#b91c1c] text-[#f5ebd4]'
                        : 'bg-[#120a07] border-[#382216] text-[#9c8472] hover:border-[#523322]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <FolderPlus className="w-4 h-4 text-amber-500" />
                      <span className="font-typewriter text-xs font-bold uppercase">
                        Start Blank Canvas
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug">
                      Opens an empty clean corkboard with zero pre-existing pins. Add characters freely as you watch.
                    </p>
                  </div>
                </div>
              </div>

              {creationMode === 'duplicate' && boards.length > 0 && (
                <div>
                  <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                    Clone Characters & Strings From:
                  </label>
                  <select
                    value={sourceBoardId}
                    onChange={(e) => setSourceBoardId(e.target.value)}
                    className="w-full bg-[#0e0705] border border-[#44281a] rounded px-3 py-2 text-xs text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c]"
                  >
                    {boards.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} (Episode {b.episode_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#382216]">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="font-typewriter text-xs px-4 py-2 text-[#9c8472] hover:text-[#f5ebd4]"
                >
                  Back to List
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] font-typewriter text-xs uppercase tracking-wider px-4 py-2 rounded border border-[#b91c1c] shadow cursor-pointer transition-all"
                >
                  {loading ? 'Archiving...' : 'Create Episode Board'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

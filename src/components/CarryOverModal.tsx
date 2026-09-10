import React, { useState } from 'react';
import { EpisodeBoard } from '../types';
import { ArrowRightLeft, Check, AlertCircle, Copy, Merge, RefreshCw, X, ShieldAlert } from 'lucide-react';

interface CarryOverModalProps {
  isOpen: boolean;
  onClose: () => void;
  boards: EpisodeBoard[];
  currentBoardId: string;
  onCarryOver: (params: {
    sourceBoardId: string;
    targetBoardId: string;
    mode: 'merge' | 'replace';
    items: Array<'cards' | 'strings' | 'stickies'>;
  }) => Promise<void>;
}

export const CarryOverModal: React.FC<CarryOverModalProps> = ({
  isOpen,
  onClose,
  boards,
  currentBoardId,
  onCarryOver,
}) => {
  // Transfer direction: 'bring_into_current' (bring another episode board into this one)
  // or 'send_to_other' (carry over this current board into another episode)
  const [direction, setDirection] = useState<'bring_into_current' | 'send_to_other'>('bring_into_current');
  
  // Default source and target
  const otherBoards = boards.filter((b) => b.id !== currentBoardId);
  const [selectedOtherBoardId, setSelectedOtherBoardId] = useState(otherBoards[0]?.id || '');
  
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [includeCards, setIncludeCards] = useState(true);
  const [includeStrings, setIncludeStrings] = useState(true);
  const [includeStickies, setIncludeStickies] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentBoard = boards.find((b) => b.id === currentBoardId) || boards[0];
  const otherBoard = boards.find((b) => b.id === selectedOtherBoardId) || otherBoards[0];

  const sourceBoard = direction === 'bring_into_current' ? otherBoard : currentBoard;
  const targetBoard = direction === 'bring_into_current' ? currentBoard : otherBoard;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceBoard || !targetBoard) return;
    if (!includeCards && !includeStrings && !includeStickies) {
      alert('Please select at least one item type to transfer.');
      return;
    }

    const items: Array<'cards' | 'strings' | 'stickies'> = [];
    if (includeCards) items.push('cards');
    if (includeStrings) items.push('strings');
    if (includeStickies) items.push('stickies');

    setLoading(true);
    try {
      await onCarryOver({
        sourceBoardId: sourceBoard.id,
        targetBoardId: targetBoard.id,
        mode,
        items,
      });

      setSuccessMessage(
        `Successfully transferred evidence from "${sourceBoard.title}" into "${targetBoard.title}"!`
      );
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Carry over failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-[#1a0f0b] border-4 border-[#4a2e20] rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-[#e8dfd8] overflow-hidden">
        {/* Header */}
        <div className="bg-[#12281d] border-b-2 border-[#bfa265] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌲</span>
            <div>
              <h2 className="font-display font-black text-lg text-[#f5ebd4] tracking-wider uppercase flex items-center gap-2">
                <span>Carry Over / Transfer Evidence</span>
              </h2>
              <p className="font-typewriter text-xs text-[#a3c2b1]">
                Twin Peaks Sheriff Dossier Cross-Episode Investigator Bridge
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#9ea49f] hover:text-[#f5ebd4] p-1 rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {successMessage ? (
            <div className="p-5 rounded-lg bg-emerald-950/80 border-2 border-emerald-600 text-emerald-200 text-center font-typewriter text-sm flex flex-col items-center gap-2">
              <Check className="w-8 h-8 text-emerald-400" />
              <span>{successMessage}</span>
            </div>
          ) : (
            <>
              {/* Transfer Direction Toggle */}
              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-2">
                  1. Select Transfer Direction
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setDirection('bring_into_current')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      direction === 'bring_into_current'
                        ? 'bg-[#2f1911] border-[#b91c1c] text-[#f5ebd4] shadow-[0_0_15px_rgba(185,28,28,0.25)]'
                        : 'bg-[#120a07] border-[#382216] text-[#9c8472] hover:border-[#523322]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <RefreshCw className="w-4 h-4 text-amber-400" />
                      <span className="font-typewriter text-xs font-bold uppercase text-[#f5ebd4]">
                        Bring into This Board
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug">
                      Import evidence, suspect photos, and strings from a previous episode into your current board (<span className="text-[#e5c158] font-bold">{currentBoard?.title}</span>).
                    </p>
                  </div>

                  <div
                    onClick={() => setDirection('send_to_other')}
                    className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                      direction === 'send_to_other'
                        ? 'bg-[#2f1911] border-[#b91c1c] text-[#f5ebd4] shadow-[0_0_15px_rgba(185,28,28,0.25)]'
                        : 'bg-[#120a07] border-[#382216] text-[#9c8472] hover:border-[#523322]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <Copy className="w-4 h-4 text-red-500" />
                      <span className="font-typewriter text-xs font-bold uppercase text-[#f5ebd4]">
                        Carry over to Next / Other
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug">
                      Take your current evidence from <span className="text-[#e5c158] font-bold">{currentBoard?.title}</span> and copy it into another episode board.
                    </p>
                  </div>
                </div>
              </div>

              {/* Source & Destination Display */}
              <div className="bg-[#120906] border border-[#44281a] p-4 rounded-lg">
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-2">
                  2. Choose Episodes
                </label>
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  {/* Source box */}
                  <div className="w-full sm:flex-1 bg-[#1c110c] border border-[#3e2316] p-3 rounded-lg">
                    <span className="font-typewriter text-[10px] text-[#b89f89] uppercase tracking-wider block mb-1">
                      From Source Board:
                    </span>
                    {direction === 'send_to_other' ? (
                      <div className="font-display font-bold text-sm text-[#f5ebd4]">
                        {currentBoard?.title}
                      </div>
                    ) : (
                      <select
                        value={selectedOtherBoardId}
                        onChange={(e) => setSelectedOtherBoardId(e.target.value)}
                        className="w-full bg-[#0c0604] border border-[#44281a] rounded px-2.5 py-1.5 text-xs text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c]"
                      >
                        {otherBoards.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title} (Episode {b.episode_number})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Transfer indicator */}
                  <div className="p-2 rounded-full bg-[#25150f] border border-[#4a2e20] text-red-400">
                    <ArrowRightLeft className="w-4 h-4" />
                  </div>

                  {/* Target box */}
                  <div className="w-full sm:flex-1 bg-[#1c110c] border border-[#3e2316] p-3 rounded-lg">
                    <span className="font-typewriter text-[10px] text-[#b89f89] uppercase tracking-wider block mb-1">
                      To Target Board:
                    </span>
                    {direction === 'bring_into_current' ? (
                      <div className="font-display font-bold text-sm text-[#f5ebd4]">
                        {currentBoard?.title}
                      </div>
                    ) : (
                      <select
                        value={selectedOtherBoardId}
                        onChange={(e) => setSelectedOtherBoardId(e.target.value)}
                        className="w-full bg-[#0c0604] border border-[#44281a] rounded px-2.5 py-1.5 text-xs text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c]"
                      >
                        {otherBoards.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title} (Episode {b.episode_number})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Items to include */}
              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-2">
                  3. Items to Transfer
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      includeCards ? 'bg-[#29170f] border-red-800 text-[#f5ebd4]' : 'bg-[#100806] border-[#382216] text-[#78614e]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={includeCards}
                      onChange={(e) => setIncludeCards(e.target.checked)}
                      className="accent-[#b91c1c]"
                    />
                    <span className="font-typewriter text-xs font-bold">Character Cards</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      includeStrings ? 'bg-[#29170f] border-red-800 text-[#f5ebd4]' : 'bg-[#100806] border-[#382216] text-[#78614e]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={includeStrings}
                      onChange={(e) => setIncludeStrings(e.target.checked)}
                      className="accent-[#b91c1c]"
                    />
                    <span className="font-typewriter text-xs font-bold">Red Strings</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      includeStickies ? 'bg-[#29170f] border-red-800 text-[#f5ebd4]' : 'bg-[#100806] border-[#382216] text-[#78614e]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={includeStickies}
                      onChange={(e) => setIncludeStickies(e.target.checked)}
                      className="accent-[#b91c1c]"
                    />
                    <span className="font-typewriter text-xs font-bold">Theory Notes</span>
                  </label>
                </div>
              </div>

              {/* Merge vs Replace Mode */}
              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-2">
                  4. Transfer Action Mode
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setMode('merge')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      mode === 'merge'
                        ? 'bg-[#2b1810] border-[#b91c1c] text-[#f5ebd4]'
                        : 'bg-[#120a07] border-[#382216] text-[#9c8472] hover:border-[#523322]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Merge className="w-4 h-4 text-emerald-400" />
                      <span className="font-typewriter text-xs font-bold uppercase">
                        Merge with Existing (Recommended)
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug">
                      Keeps all current pins on the target board intact, and brings over cards/clues that don't already exist.
                    </p>
                  </div>

                  <div
                    onClick={() => setMode('replace')}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      mode === 'replace'
                        ? 'bg-[#2b1810] border-amber-600 text-[#f5ebd4]'
                        : 'bg-[#120a07] border-[#382216] text-[#9c8472] hover:border-[#523322]'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                      <span className="font-typewriter text-xs font-bold uppercase text-amber-300">
                        Exact Clone / Overwrite
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug">
                      Replaces the target board's selected items with the exact snapshot from the source episode board.
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-[#382216]">
                <button
                  type="button"
                  onClick={onClose}
                  className="font-typewriter text-xs px-4 py-2 text-[#9c8472] hover:text-[#f5ebd4] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || otherBoards.length === 0}
                  className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] font-typewriter text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg border border-[#b91c1c] shadow-lg cursor-pointer flex items-center gap-2 font-bold transition-all disabled:opacity-50"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>{loading ? 'Transferring Evidence...' : 'Execute Carry-Over'}</span>
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

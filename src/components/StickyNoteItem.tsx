import React from 'react';
import { StickyNote } from '../types';
import { Trash2, GripHorizontal, Link2 } from 'lucide-react';

interface StickyProps {
  note: StickyNote;
  isSelectedForString?: boolean;
  onSelectForString?: (id: string) => void;
  onUpdate: (updated: StickyNote) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string, clientX: number, clientY: number) => void;
}

const COLOR_STYLES: Record<StickyNote['color'], { bg: string; text: string; border: string; tape: string }> = {
  parchment: {
    bg: 'bg-[#f4ebd0]',
    text: 'text-[#2b180d]',
    border: 'border-[#dfcfb0]',
    tape: 'bg-[#cfb995]/80',
  },
  yellow: {
    bg: 'bg-[#fef08a]',
    text: 'text-[#362402]',
    border: 'border-[#facc15]',
    tape: 'bg-[#fef9c3]/80',
  },
  crimson: {
    bg: 'bg-[#fecaca]',
    text: 'text-[#450a0a]',
    border: 'border-[#f87171]',
    tape: 'bg-[#fee2e2]/80',
  },
  green: {
    bg: 'bg-[#bbf7d0]',
    text: 'text-[#052e16]',
    border: 'border-[#86efac]',
    tape: 'bg-[#dcfce7]/80',
  },
  wood: {
    bg: 'bg-[#fed7aa]',
    text: 'text-[#431407]',
    border: 'border-[#fdba74]',
    tape: 'bg-[#ffedd5]/80',
  },
};

export const StickyNoteItem: React.FC<StickyProps> = ({
  note,
  isSelectedForString = false,
  onSelectForString,
  onUpdate,
  onDelete,
  onDragStart,
}) => {
  const currentStyle = COLOR_STYLES[note.color] || COLOR_STYLES.parchment;

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('textarea, button, select, input, a')) {
      return;
    }
    e.stopPropagation();
    onDragStart(note.id, e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('textarea, button, select, input, a')) {
      return;
    }
    if (e.touches.length === 1) {
      e.stopPropagation();
      onDragStart(note.id, e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const cycleColor = () => {
    const colors: StickyNote['color'][] = ['parchment', 'yellow', 'crimson', 'green', 'wood'];
    const nextIdx = (colors.indexOf(note.color) + 1) % colors.length;
    onUpdate({ ...note, color: colors[nextIdx] });
  };

  return (
    <div
      id={`sticky-${note.id}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        transform: `translate3d(${note.x}px, ${note.y}px, 0)`,
        zIndex: 15,
        touchAction: 'none',
      }}
      className={`absolute w-60 p-3 rounded shadow-[0_8px_20px_rgba(0,0,0,0.5)] border ${currentStyle.bg} ${currentStyle.text} ${currentStyle.border} select-none cursor-grab active:cursor-grabbing touch-none transition-transform duration-75`}
    >
      {/* Tape strip at top */}
      <div
        className={`absolute -top-3 left-1/2 -translate-x-1/2 w-20 h-4 ${currentStyle.tape} border border-black/10 shadow-sm rotate-[-1.5deg] backdrop-blur-[1px]`}
      />

      {/* String connection pin on top right */}
      {onSelectForString && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelectForString(note.id);
          }}
          className={`absolute -top-2 right-2 p-1.5 rounded-full shadow-md transition-all z-20 cursor-pointer ${
            isSelectedForString
              ? 'bg-red-600 text-white animate-pulse ring-2 ring-red-400'
              : 'bg-[#d8c5ad] hover:bg-red-800 hover:text-white text-[#5c3e28] border border-[#a89078]'
          }`}
          title={isSelectedForString ? 'Click another card or note to link' : 'Connect red string to this note'}
        >
          <Link2 className="w-3.5 h-3.5" />
        </button>
      )}

      <div className="flex items-center justify-between mt-1 mb-2 text-xs opacity-75">
        <div className="flex items-center gap-1 cursor-move">
          <GripHorizontal className="w-3.5 h-3.5" />
          <span className="font-typewriter text-[10px] uppercase tracking-wider">
            {note.author || 'THEORY / CLUE'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 pr-6">
          <button
            onClick={cycleColor}
            className="w-3.5 h-3.5 rounded-full border border-black/20 hover:scale-110 transition-transform cursor-pointer"
            style={{ backgroundColor: note.color === 'parchment' ? '#d6c7a7' : note.color }}
            title="Cycle sticky color"
          />
          <button
            onClick={() => onDelete(note.id)}
            className="hover:text-red-700 transition-colors p-0.5 cursor-pointer"
            title="Discard sticky note"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      <textarea
        rows={4}
        value={note.content}
        onChange={(e) => onUpdate({ ...note, content: e.target.value })}
        placeholder="Write a theory, strange omen, or clue..."
        className="w-full bg-transparent font-typewriter text-xs leading-relaxed outline-none resize-none placeholder:text-black/40"
      />
    </div>
  );
};

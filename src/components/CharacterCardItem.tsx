import React, { useState, useRef } from 'react';
import { CharacterCard, PinStatus } from '../types';
import { Trash2, Link2, Eye, ShieldCheck, UserX, HelpCircle, GripVertical } from 'lucide-react';

interface CardProps {
  card: CharacterCard;
  isSelectedForString: boolean;
  onSelectForString: (cardId: string) => void;
  onUpdate: (updated: CharacterCard) => void;
  onDelete: (cardId: string) => void;
  onDragStart: (cardId: string, clientX: number, clientY: number) => void;
}

const STATUS_CONFIG: Record<PinStatus, { label: string; pinClass: string; badgeClass: string; icon: React.ReactNode }> = {
  Unknown: {
    label: 'Unknown',
    pinClass: 'pushpin-gold',
    badgeClass: 'bg-amber-950/70 text-amber-300 border-amber-800/80',
    icon: <HelpCircle className="w-3 h-3" />,
  },
  Suspect: {
    label: 'Suspect',
    pinClass: 'pushpin-crimson',
    badgeClass: 'bg-red-950/80 text-red-300 border-red-800/90 font-bold',
    icon: <UserX className="w-3 h-3" />,
  },
  Cleared: {
    label: 'Cleared',
    pinClass: 'pushpin-forest',
    badgeClass: 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80',
    icon: <ShieldCheck className="w-3 h-3" />,
  },
  Victim: {
    label: 'Victim',
    pinClass: 'pushpin-purple',
    badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-800/80',
    icon: <Eye className="w-3 h-3" />,
  },
};

export const CharacterCardItem: React.FC<CardProps> = ({
  card,
  isSelectedForString,
  onSelectForString,
  onUpdate,
  onDelete,
  onDragStart,
}) => {
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const statusInfo = STATUS_CONFIG[card.status] || STATUS_CONFIG.Unknown;

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only trigger drag if clicking the header or background, not inside interactive inputs or buttons
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, option')) {
      return;
    }
    onDragStart(card.id, e.clientX, e.clientY);
  };

  const cycleStatus = () => {
    const statuses: PinStatus[] = ['Unknown', 'Suspect', 'Cleared', 'Victim'];
    const nextIdx = (statuses.indexOf(card.status) + 1) % statuses.length;
    onUpdate({ ...card, status: statuses[nextIdx], updated_at: new Date().toISOString() });
  };

  return (
    <div
      id={`card-${card.id}`}
      onMouseDown={handleMouseDown}
      style={{
        transform: `translate3d(${card.x}px, ${card.y}px, 0)`,
        zIndex: card.z_index || 10,
      }}
      className={`absolute w-72 rounded-lg bg-[#f0e6d6] text-[#1c130e] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.65)] select-none border transition-shadow cursor-grab active:cursor-grabbing ${
        isSelectedForString
          ? 'ring-4 ring-red-600 shadow-[0_0_20px_rgba(220,38,38,0.7)] border-red-600'
          : 'border-[#c7b59e] hover:shadow-[0_12px_28px_rgba(0,0,0,0.8)]'
      }`}
    >
      {/* Brass / Color Pushpin on top edge */}
      <div
        className={`pushpin ${statusInfo.pinClass}`}
        title={`Pin: ${statusInfo.label} (Click status badge to change)`}
      />

      {/* String connection anchor indicator */}
      <button
        onClick={() => onSelectForString(card.id)}
        className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${
          isSelectedForString
            ? 'bg-red-600 text-white animate-pulse'
            : 'bg-[#d8c5ad] hover:bg-red-800 hover:text-white text-[#5c3e28]'
        }`}
        title={isSelectedForString ? 'Click another card to complete string' : 'Connect red string from this card'}
      >
        <Link2 className="w-3.5 h-3.5" />
      </button>

      {/* Top row: Drag grip and Pin status toggle */}
      <div className="flex items-center gap-2 mb-2 pr-6">
        <GripVertical className="w-4 h-4 text-[#8a725e] flex-shrink-0" />
        <button
          onClick={cycleStatus}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-typewriter border cursor-pointer transition-all ${statusInfo.badgeClass}`}
          title="Click to cycle status: Unknown → Suspect → Cleared → Victim"
        >
          {statusInfo.icon}
          <span>{statusInfo.label}</span>
        </button>
      </div>

      {/* Character Name */}
      <div className="mb-1.5">
        {isEditingName ? (
          <input
            type="text"
            autoFocus
            value={card.name}
            onChange={(e) => onUpdate({ ...card, name: e.target.value })}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
            className="w-full bg-[#dfd0be] font-display font-bold text-base text-[#241208] px-1.5 py-0.5 rounded border border-[#a89078] outline-none"
          />
        ) : (
          <h3
            onClick={() => setIsEditingName(true)}
            className="font-display font-black text-lg text-[#1f1008] tracking-wide leading-tight hover:text-[#7f1d1d] cursor-pointer"
            title="Click to edit character name"
          >
            {card.name}
          </h3>
        )}
      </div>

      {/* Neutral Role description */}
      <div className="mb-3 text-[12px] text-[#4a3628] leading-snug border-b border-[#cfbdab] pb-2">
        {isEditingRole ? (
          <input
            type="text"
            autoFocus
            value={card.role}
            onChange={(e) => onUpdate({ ...card, role: e.target.value })}
            onBlur={() => setIsEditingRole(false)}
            onKeyDown={(e) => e.key === 'Enter' && setIsEditingRole(false)}
            className="w-full bg-[#dfd0be] text-xs text-[#241208] px-1.5 py-0.5 rounded border border-[#a89078] outline-none font-editorial italic"
          />
        ) : (
          <p
            onClick={() => setIsEditingRole(true)}
            className="font-editorial italic hover:text-[#1f1008] cursor-pointer"
            title="Click to edit role description"
          >
            {card.role || <span className="text-[#8c7462]">Click to add role...</span>}
          </p>
        )}
      </div>

      {/* Freeform Notes Textarea */}
      <div>
        <label className="block text-[10px] font-typewriter uppercase tracking-widest text-[#78614e] mb-1 flex items-center justify-between">
          <span>Case Notes / Alibi:</span>
          <span className="text-[9px] text-[#9b8370]">auto-syncs</span>
        </label>
        <textarea
          rows={3}
          value={card.notes}
          onChange={(e) =>
            onUpdate({ ...card, notes: e.target.value, updated_at: new Date().toISOString() })
          }
          placeholder="Jot down clues, alibis, sightings..."
          className="w-full bg-[#fcf8f2] text-[#24150d] font-typewriter text-xs p-2 rounded border border-[#c4b19c] focus:outline-none focus:border-[#991b1b] focus:ring-1 focus:ring-[#991b1b] resize-none leading-relaxed placeholder:text-[#a08976]"
        />
      </div>

      {/* Footer info & delete button */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#dfcebe]/80 text-[10px] text-[#8c7360] min-h-[28px]">
        {isConfirmingDelete ? (
          <div className="flex items-center justify-between w-full bg-red-950/15 px-2 py-1 rounded border border-red-800/30 animate-fadeIn">
            <span className="font-typewriter text-red-900 font-bold text-[10px]">Remove card?</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(card.id);
                }}
                className="bg-[#83161c] hover:bg-[#991b1b] text-white px-2 py-0.5 rounded font-typewriter text-[10px] font-bold shadow-sm transition-colors cursor-pointer"
                title="Confirm deletion"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsConfirmingDelete(false);
                }}
                className="bg-[#dfd0be] hover:bg-[#cfbda9] text-[#241208] px-1.5 py-0.5 rounded font-typewriter text-[10px] transition-colors cursor-pointer"
                title="Cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <span className="font-typewriter">Twin Peaks Dept.</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsConfirmingDelete(true);
              }}
              className="text-[#967660] hover:text-red-700 hover:bg-red-100/60 p-1 rounded transition-colors cursor-pointer"
              title="Delete character card"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

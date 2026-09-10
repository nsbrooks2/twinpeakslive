import React, { useState } from 'react';
import { CharacterCard, StringConnection } from '../types';
import { Trash2, Edit2, Check, X } from 'lucide-react';

interface StringCanvasProps {
  strings: StringConnection[];
  cards: CharacterCard[];
  selectedSourceCardId: string | null;
  onSelectTargetCard: (targetCardId: string) => void;
  onUpdateString: (str: StringConnection) => void;
  onDeleteString: (stringId: string) => void;
  canvasWidth: number;
  canvasHeight: number;
}

export const RedStringCanvas: React.FC<StringCanvasProps> = ({
  strings,
  cards,
  selectedSourceCardId,
  onSelectTargetCard,
  onUpdateString,
  onDeleteString,
  canvasWidth,
  canvasHeight,
}) => {
  const [editingStringId, setEditingStringId] = useState<string | null>(null);
  const [tempLabel, setTempLabel] = useState('');

  // Map cards by ID for instant O(1) coordinate lookup
  const cardMap = new Map<string, CharacterCard>();
  cards.forEach((c) => cardMap.set(c.id, c));

  const CARD_WIDTH = 288;
  const PIN_OFFSET_X = CARD_WIDTH / 2;
  const PIN_OFFSET_Y = 12;

  const startEditLabel = (str: StringConnection) => {
    setEditingStringId(str.id);
    setTempLabel(str.label || '');
  };

  const saveEditLabel = (str: StringConnection) => {
    onUpdateString({ ...str, label: tempLabel.trim() });
    setEditingStringId(null);
  };

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ width: canvasWidth, height: canvasHeight, zIndex: 12 }}
    >
      <svg
        className="w-full h-full"
        style={{ overflow: 'visible' }}
      >
        <defs>
          {/* Subtle drop shadow for woolen red yarn */}
          <filter id="yarn-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodColor="#000" floodOpacity="0.8" />
          </filter>
        </defs>

        {strings.map((str) => {
          const source = cardMap.get(str.source_id);
          const target = cardMap.get(str.target_id);
          if (!source || !target) return null;

          const x1 = source.x + PIN_OFFSET_X;
          const y1 = source.y + PIN_OFFSET_Y;
          const x2 = target.x + PIN_OFFSET_X;
          const y2 = target.y + PIN_OFFSET_Y;

          // Natural catenary / gravitational sag for physical wool yarn
          const dx = x2 - x1;
          const dy = y2 - y1;
          const distance = Math.hypot(dx, dy);
          const sag = Math.min(60, distance * 0.08); // curve sag
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2 + sag;

          const pathData = `M ${x1} ${y1} Q ${midX} ${midY} ${x2} ${y2}`;

          return (
            <g key={str.id} className="pointer-events-auto group">
              {/* Outer stroke glow on hover */}
              <path
                d={pathData}
                fill="none"
                stroke="transparent"
                strokeWidth="16"
                className="cursor-pointer"
                onClick={() => startEditLabel(str)}
              />

              {/* Red yarn base shadow & line */}
              <path
                d={pathData}
                fill="none"
                stroke="#150000"
                strokeWidth="3.5"
                opacity="0.6"
                transform="translate(2, 4)"
              />

              {/* Twisted red yarn strand 1 */}
              <path
                d={pathData}
                fill="none"
                stroke="#b91c1c"
                strokeWidth="2.8"
                strokeLinecap="round"
                className="transition-colors group-hover:stroke-[#ef4444]"
              />

              {/* Wool fiber texture / stitch */}
              <path
                d={pathData}
                fill="none"
                stroke="#f87171"
                strokeWidth="1.2"
                strokeDasharray="4, 3"
                opacity="0.85"
              />

              {/* Pin anchor points */}
              <circle cx={x1} cy={y1} r="4" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="1" />
              <circle cx={x2} cy={y2} r="4" fill="#7f1d1d" stroke="#fca5a5" strokeWidth="1" />

              {/* Midpoint String Tag / Label */}
              <foreignObject
                x={midX - 80}
                y={midY - 14}
                width="160"
                height="34"
                className="overflow-visible"
              >
                <div className="flex items-center justify-center">
                  {editingStringId === str.id ? (
                    <div className="bg-[#f5ebd4] border border-[#a88265] rounded px-1.5 py-0.5 shadow-lg flex items-center gap-1">
                      <input
                        type="text"
                        autoFocus
                        value={tempLabel}
                        onChange={(e) => setTempLabel(e.target.value)}
                        placeholder="Label..."
                        className="w-20 bg-transparent text-[10px] font-typewriter text-[#291307] outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditLabel(str);
                          if (e.key === 'Escape') setEditingStringId(null);
                        }}
                      />
                      <button
                        onClick={() => saveEditLabel(str)}
                        className="text-green-800 hover:text-green-950"
                        title="Save label"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => onDeleteString(str.id)}
                        className="text-red-700 hover:text-red-900"
                        title="Cut string"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => startEditLabel(str)}
                      className="bg-[#faf3e0] hover:bg-[#fffaee] border border-[#bfa286] text-[#3b1d0e] px-2 py-0.5 rounded shadow-md text-[10px] font-typewriter tracking-wide cursor-pointer flex items-center gap-1 select-none transition-transform hover:scale-105"
                      title="Click to edit label or cut string"
                    >
                      <span className="max-w-[120px] truncate">
                        {str.label || <span className="text-[#8a6e57] italic">add label</span>}
                      </span>
                      <Edit2 className="w-2.5 h-2.5 text-[#8a6e57] opacity-60 group-hover:opacity-100" />
                    </div>
                  )}
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

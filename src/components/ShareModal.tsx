import React, { useState } from 'react';
import { Share2, Copy, Check, ExternalLink, Globe, Shield, Users, Sparkles, X, Heart } from 'lucide-react';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sharedUrl?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  sharedUrl,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Use the canonical shared deployment URL or current browser URL
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const finalShareUrl =
    sharedUrl ||
    (currentOrigin && !currentOrigin.includes('localhost')
      ? window.location.href
      : 'https://ais-pre-i7aluykvrg324tovfisuwa-330207957035.us-east1.run.app');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(finalShareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#190f0b] border-4 border-[#4a2e20] rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-[#e8dfd8] overflow-hidden">
        {/* Header */}
        <div className="bg-[#1b3d2b] border-b-2 border-[#e5c158] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌲</span>
            <div>
              <h2 className="font-display font-black text-lg text-[#f5ebd4] tracking-wider uppercase">
                Publish & Share Link
              </h2>
              <p className="font-typewriter text-xs text-[#a3c2b1]">
                Invite your girlfriend & fellow detectives to the investigation
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Main Direct Link Box */}
          <div className="bg-[#120a07] border-2 border-[#5a3928] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-typewriter text-xs text-[#e5c158] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />
                <span>Public Shareable URL</span>
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-700/60">
                Ready to Access
              </span>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={finalShareUrl}
                className="w-full bg-[#080403] border border-[#3e2417] rounded-lg px-3 py-2 text-xs font-mono text-[#f5ebd4] select-all focus:outline-none focus:border-[#e5c158]"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg font-typewriter text-xs uppercase tracking-wider font-bold transition-all cursor-pointer whitespace-nowrap ${
                  copied
                    ? 'bg-emerald-700 text-white'
                    : 'bg-[#83161c] hover:bg-[#991b1b] text-white border border-[#b91c1c] shadow-md'
                }`}
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied!' : 'Copy Link'}</span>
              </button>
            </div>

            <p className="font-typewriter text-[11px] text-[#9c8472] leading-relaxed">
              Anyone with this link can open the whiteboard from any phone, laptop, or browser.
            </p>
          </div>

          {/* Quick instructions for girlfriend access */}
          <div className="space-y-3 font-typewriter text-xs text-[#d1b194]">
            <div className="p-3 bg-[#23140e] border border-[#48281a] rounded-lg space-y-1.5">
              <div className="font-bold text-[#f5ebd4] flex items-center gap-2">
                <Heart className="w-4 h-4 text-red-400 fill-red-400" />
                <span>How Your Girlfriend Joins:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[#b89f89] text-[11px] pl-1">
                <li>Send her the copied link via text message, Discord, or WhatsApp.</li>
                <li>When she opens the link, she can click <strong>"Enter as Girlfriend"</strong> or click <strong>"Create New Account"</strong> to choose her own detective name & avatar.</li>
                <li>She'll immediately see the case board, all characters, evidence notes, and video watch party!</li>
              </ol>
            </div>

            <div className="p-3 bg-[#131c17] border border-[#2b4c37] rounded-lg space-y-1.5 text-emerald-200">
              <div className="font-bold text-emerald-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>AI Studio Permanent Share:</span>
              </div>
              <p className="text-[11px] text-[#a4c5b3] leading-relaxed">
                You can also click the <strong>Share</strong> button at the top right of the Google AI Studio toolbar to deploy a public snapshot or permanent Cloud Run version for anyone on the internet.
              </p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-[#382014]">
            <a
              href={finalShareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-typewriter text-xs text-[#e5c158] hover:text-[#fbf0b9] flex items-center gap-1.5 transition-colors underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Test Link in New Tab</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="bg-[#2d1b13] hover:bg-[#45291c] border border-[#5a3928] text-[#f5ebd4] font-typewriter text-xs uppercase px-4 py-2 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

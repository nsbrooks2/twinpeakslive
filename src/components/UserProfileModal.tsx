import React, { useState } from 'react';
import { UserAccount } from '../types';
import { User, Shield, BadgeCheck, Sparkles, X, Check, Coffee, Trees } from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount;
  onUpdateProfile: (updates: Partial<UserAccount>) => Promise<void>;
  onSwitchAccount: () => void;
  allAccounts: UserAccount[];
  onSelectSavedAccount: (account: UserAccount) => void;
}

const AVATAR_OPTIONS = ['☕', '🌲', '⭐', '🦉', '🍩', '🕵️‍♂️', '📼', '📻', '🥧', '🔦'];

export const UserProfileModal: React.FC<ProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateProfile,
  onSwitchAccount,
  allAccounts,
  onSelectSavedAccount,
}) => {
  const [name, setName] = useState(currentUser.name);
  const [avatar, setAvatar] = useState(currentUser.avatar || '🌲');
  const [badgeTitle, setBadgeTitle] = useState(currentUser.badge_title || 'Special Agent');
  const [department, setDepartment] = useState(currentUser.department || 'Sheriff Dispatch');
  const [favoriteQuote, setFavoriteQuote] = useState(
    currentUser.favorite_quote || 'The owls are not what they seem.'
  );
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      await onUpdateProfile({
        name: name.trim(),
        avatar,
        badge_title: badgeTitle.trim(),
        department: department.trim(),
        favorite_quote: favoriteQuote.trim(),
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error('Failed to update profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const otherAccounts = allAccounts.filter(
    (a) => a.email.toLowerCase() !== currentUser.email.toLowerCase()
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#1a0f0b] border-4 border-[#4a2e20] rounded-xl shadow-[0_25px_60px_rgba(0,0,0,0.95)] text-[#e8dfd8] overflow-hidden">
        {/* Modal Header */}
        <div className="bg-[#12281d] border-b-2 border-[#bfa265] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{avatar}</span>
            <div>
              <h2 className="font-display font-black text-lg text-[#f5ebd4] tracking-wider uppercase">
                Officer Dossier & Credentials
              </h2>
              <p className="font-typewriter text-xs text-[#a3c2b1]">
                Twin Peaks Sheriff's Department Active Account
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

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {savedSuccess && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-600 rounded-lg text-emerald-200 text-xs font-typewriter flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>Officer credentials successfully updated and saved to station records!</span>
            </div>
          )}

          {/* Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-2">
                Choose Station Badge Icon / Avatar
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setAvatar(icon)}
                    className={`w-10 h-10 rounded-lg text-lg flex items-center justify-center transition-all cursor-pointer ${
                      avatar === icon
                        ? 'bg-[#3b1d13] border-2 border-[#e5c158] scale-110 shadow-[0_0_10px_rgba(229,193,88,0.4)]'
                        : 'bg-[#120a07] border border-[#3e2417] hover:border-[#6b4530]'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                Investigator Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Agent Dale Cooper, Harry Truman"
                className="w-full bg-[#110906] border border-[#44281a] rounded px-3 py-2 text-sm text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                  Rank / Title
                </label>
                <input
                  type="text"
                  value={badgeTitle}
                  onChange={(e) => setBadgeTitle(e.target.value)}
                  placeholder="Special Agent / Lead Investigator"
                  className="w-full bg-[#110906] border border-[#44281a] rounded px-3 py-2 text-sm text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c]"
                />
              </div>

              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="FBI / Sheriff Dept"
                  className="w-full bg-[#110906] border border-[#44281a] rounded px-3 py-2 text-sm text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c]"
                />
              </div>
            </div>

            <div>
              <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                Badge Email (Account Key)
              </label>
              <input
                type="email"
                disabled
                value={currentUser.email}
                className="w-full bg-[#0c0604] border border-[#2a170f] rounded px-3 py-2 text-sm text-[#8c7462] cursor-not-allowed font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                Signature Case Quote
              </label>
              <input
                type="text"
                value={favoriteQuote}
                onChange={(e) => setFavoriteQuote(e.target.value)}
                placeholder="The owls are not what they seem."
                className="w-full bg-[#110906] border border-[#44281a] rounded px-3 py-2 text-sm text-[#f5ebd4] focus:outline-none focus:border-[#b91c1c] italic"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onSwitchAccount}
                className="font-typewriter text-xs text-[#e5c158] hover:text-[#fbf0b9] underline cursor-pointer"
              >
                Sign Out / Switch Station Account
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] font-typewriter text-xs uppercase tracking-wider px-5 py-2.5 rounded-lg border border-[#b91c1c] shadow-lg cursor-pointer font-bold transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Officer Profile'}
              </button>
            </div>
          </form>

          {/* Quick Switch to other saved accounts on this device/server */}
          {otherAccounts.length > 0 && (
            <div className="border-t border-[#382216] pt-4">
              <span className="font-typewriter text-xs text-[#b89f89] uppercase tracking-wider block mb-2">
                Quick-Switch to Other Saved Accounts ({otherAccounts.length}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {otherAccounts.map((acc) => (
                  <button
                    key={acc.id || acc.email}
                    type="button"
                    onClick={() => onSelectSavedAccount(acc)}
                    className="p-2.5 bg-[#120a07] hover:bg-[#25150f] border border-[#3e2417] hover:border-[#e5c158] rounded-lg text-left transition-all cursor-pointer flex items-center gap-2.5"
                  >
                    <span className="text-xl">{acc.avatar || '🌲'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-display font-bold text-xs text-[#f5ebd4] truncate">
                        {acc.name}
                      </div>
                      <div className="font-typewriter text-[10px] text-[#9c8472] truncate">
                        {acc.badge_title || acc.email}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

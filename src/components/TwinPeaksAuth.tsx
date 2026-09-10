import React, { useState, useEffect } from 'react';
import { getSupabase, getSupabaseCredentials, saveSupabaseCredentials, SUPABASE_SQL_SCHEMA } from '../lib/supabase';
import { UserAccountStore } from '../lib/boardStore';
import { UserAccount } from '../types';
import { Key, Trees, Sparkles, Database, Check, AlertCircle, UserPlus, UserCheck, Shield, ChevronRight } from 'lucide-react';

interface AuthProps {
  onAuthenticated: (user: UserAccount) => void;
}

const AVATAR_SELECTIONS = ['☕', '🌲', '⭐', '🦉', '🍩', '🕵️‍♂️', '📼', '📻', '🥧', '🔦'];

export const TwinPeaksAuth: React.FC<AuthProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'signin' | 'signup' | 'select'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🌲');
  const [badgeTitle, setBadgeTitle] = useState('Special Agent');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // List of saved user accounts from server/local
  const [savedAccounts, setSavedAccounts] = useState<UserAccount[]>([]);

  // Supabase manual credentials config
  const creds = getSupabaseCredentials();
  const [supabaseUrl, setSupabaseUrl] = useState(creds.url);
  const [supabaseKey, setSupabaseKey] = useState(creds.key);
  const [copiedSql, setCopiedSql] = useState(false);

  useEffect(() => {
    // Load existing accounts from disk/server & localStorage
    async function fetchAccounts() {
      const accounts = await UserAccountStore.loadAllAccounts();
      setSavedAccounts(accounts);
      if (accounts.length > 0 && mode === 'signin' && !email) {
        // Default to select view if saved accounts exist
        setMode('select');
      }
    }
    fetchAccounts();
  }, []);

  const handleSelectAccount = async (account: UserAccount) => {
    setLoading(true);
    try {
      // Mark as current user and record login time
      const logged = await UserAccountStore.loginAccount(account.email).catch(() => account);
      onAuthenticated(logged);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate saved account.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    if (!email) {
      setErrorMsg('Please provide a valid badge email.');
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    if (mode === 'signup') {
      if (!name.trim()) {
        setErrorMsg('Please choose your investigator name.');
        setLoading(false);
        return;
      }

      try {
        // Register in our server / local store
        const user = await UserAccountStore.registerAccount({
          name: name.trim(),
          email: email.toLowerCase().trim(),
          password,
          avatar,
          badge_title: badgeTitle.trim() || 'Special Agent',
          department: 'Twin Peaks Sheriff Dispatch',
          favorite_quote: 'The owls are not what they seem.',
        });

        // Also register in Supabase if configured
        if (supabase && password) {
          try {
            await supabase.auth.signUp({
              email: email.trim(),
              password,
              options: {
                data: { display_name: name.trim() },
              },
            });
          } catch (supaErr) {
            console.warn('Supabase optional signup notice:', supaErr);
          }
        }

        onAuthenticated(user);
      } catch (err: any) {
        setErrorMsg(err.message || 'Registration failed. Please try again.');
      }
    } else {
      // Sign In mode
      try {
        // Try server / store login
        const user = await UserAccountStore.loginAccount(email, password);

        // Also sign in Supabase if configured
        if (supabase && password) {
          try {
            await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
          } catch (supaErr) {
            console.warn('Supabase optional signin notice:', supaErr);
          }
        }

        onAuthenticated(user);
      } catch (err: any) {
        // If not found, check Supabase
        if (supabase) {
          try {
            const { data, error } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (error) {
              setErrorMsg(error.message);
            } else if (data.user) {
              const userName = data.user.user_metadata?.display_name || email.split('@')[0];
              const userAcc = await UserAccountStore.registerAccount({
                name: userName,
                email: data.user.email || email,
                password,
                avatar: '🌲',
                badge_title: 'Special Agent',
              });
              onAuthenticated(userAcc);
              return;
            }
          } catch (supErr: any) {
            setErrorMsg(supErr.message || 'Invalid credentials.');
          }
        } else {
          setErrorMsg(err.message || 'Account not found. Please create a new account.');
        }
      }
    }

    setLoading(false);
  };

  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(supabaseUrl, supabaseKey);
    setShowConfig(false);
    setErrorMsg('Supabase credentials saved successfully. You can now log in!');
  };

  const copySqlSchema = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-lodge-chevron-sharp p-4 overflow-hidden">
      {/* Red curtain backdrop framing */}
      <div className="absolute inset-y-0 left-0 w-8 md:w-20 bg-red-curtain opacity-90 border-r border-[#4a080d] pointer-events-none z-10" />
      <div className="absolute inset-y-0 right-0 w-8 md:w-20 bg-red-curtain opacity-90 border-l border-[#4a080d] pointer-events-none z-10" />

      {/* Subtle misty ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-red-950/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-20 w-full max-w-md">
        {/* Iconic Twin Peaks Welcome Road Sign Header */}
        <div className="relative bg-[#1b3d2b] border-4 border-[#e5c158] rounded-xl p-6 shadow-[0_20px_50px_rgba(0,0,0,0.8)] text-center mb-6 overflow-hidden">
          {/* Subtle wood-grain pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#e5c158_1px,transparent_1px)] [background-size:16px_16px]" />

          {/* Douglas Fir silhouettes & owl motif */}
          <div className="flex justify-between items-center px-4 mb-2 text-[#e5c158]/80">
            <Trees className="w-6 h-6 stroke-[1.5]" />
            <div className="text-[10px] tracking-[0.3em] uppercase font-typewriter text-[#e5c158]/90">
              SHERIFF'S DEPARTMENT ARCHIVE
            </div>
            <div className="text-lg select-none" title="The owls are not what they seem">
              🦉
            </div>
          </div>

          <h1 className="font-display text-2xl md:text-3xl font-black tracking-widest text-[#f5ebd4] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] uppercase">
            Welcome to
          </h1>
          <div className="font-display text-3xl md:text-4xl font-extrabold text-[#e5c158] tracking-wider my-1 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            TWIN PEAKS
          </div>
          <div className="font-typewriter text-xs text-[#d1e7dd] tracking-widest mt-1 border-t border-[#e5c158]/30 pt-2 flex items-center justify-center gap-2">
            <span>POP. 51,201</span>
            <span>•</span>
            <span className="text-[#f5ebd4]">DAMN FINE CASE BOARD</span>
          </div>
        </div>

        {/* Auth Card styled as Station Dossier terminal */}
        <div className="bg-[#1e1411]/95 border-2 border-[#5a3928] rounded-xl p-6 shadow-2xl backdrop-blur-sm relative">
          <div className="flex items-center justify-between border-b border-[#44281a] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse" />
              <span className="font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider">
                {mode === 'signup'
                  ? 'New Officer Enlistment'
                  : mode === 'select'
                  ? 'Station Officer Roster'
                  : 'Station Dossier Sign-In'}
              </span>
            </div>
            <button
              onClick={() => setShowConfig(!showConfig)}
              className="text-[#96775d] hover:text-[#d6beaa] text-xs flex items-center gap-1 transition-colors cursor-pointer"
              title="Configure Supabase Cloud Persistence"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{getSupabase() ? 'Connected' : 'Setup'}</span>
            </button>
          </div>

          {showConfig && (
            <div className="space-y-4 mb-4 bg-[#140b08] p-4 rounded-lg border border-[#3f2518]">
              <div className="flex items-center justify-between">
                <h3 className="font-typewriter text-xs text-[#e5c158] font-bold uppercase">
                  Supabase Project Settings
                </h3>
                <button
                  type="button"
                  onClick={() => setShowConfig(false)}
                  className="text-xs text-[#a08269] hover:text-white"
                >
                  ✕ Close
                </button>
              </div>
              <p className="text-[11px] text-[#a08269] leading-relaxed">
                Connect your Supabase project to sync live multi-device boards.
              </p>
              <form onSubmit={handleSaveConfig} className="space-y-3">
                <div>
                  <label className="block text-[10px] uppercase font-typewriter text-[#8f745f] mb-1">
                    Supabase Project URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://xyzcompany.supabase.co"
                    value={supabaseUrl}
                    onChange={(e) => setSupabaseUrl(e.target.value)}
                    className="w-full bg-[#0a0504] border border-[#3e2518] text-xs text-[#e8dfd8] px-3 py-2 rounded focus:outline-none focus:border-[#c2410c]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-typewriter text-[#8f745f] mb-1">
                    Supabase Anon Key
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOi..."
                    value={supabaseKey}
                    onChange={(e) => setSupabaseKey(e.target.value)}
                    className="w-full bg-[#0a0504] border border-[#3e2518] text-xs text-[#e8dfd8] px-3 py-2 rounded focus:outline-none focus:border-[#c2410c]"
                  />
                </div>
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={copySqlSchema}
                    className="text-[11px] text-[#e5c158] hover:underline flex items-center gap-1"
                  >
                    {copiedSql ? <Check className="w-3 h-3 text-green-400" /> : <Database className="w-3 h-3" />}
                    <span>{copiedSql ? 'SQL Copied!' : 'Copy SQL Schema'}</span>
                  </button>
                  <button
                    type="submit"
                    className="bg-[#2a4d38] hover:bg-[#346045] text-[#f5ebd4] text-xs px-3 py-1.5 rounded font-typewriter tracking-wide transition-colors"
                  >
                    Save Credentials
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* VIEW 1: SELECT FROM SAVED STATION ACCOUNTS */}
          {mode === 'select' && (
            <div className="space-y-4">
              <div className="text-xs font-typewriter text-[#cfb69b] text-center mb-1 uppercase tracking-wider">
                Select Your Officer Badge to Enter:
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {savedAccounts.map((acc) => (
                  <button
                    key={acc.id || acc.email}
                    onClick={() => handleSelectAccount(acc)}
                    disabled={loading}
                    className="w-full p-3 bg-[#2d1b13] hover:bg-[#45291c] border border-[#5a3928] hover:border-[#e5c158] rounded-xl text-left transition-all flex items-center justify-between group shadow-sm cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl flex-shrink-0 group-hover:scale-110 transition-transform">
                        {acc.avatar || '🌲'}
                      </span>
                      <div className="min-w-0 truncate">
                        <div className="font-display font-black text-sm text-[#f5ebd4] group-hover:text-[#e5c158] transition-colors truncate">
                          {acc.name}
                        </div>
                        <div className="font-typewriter text-[11px] text-[#a88a73] truncate">
                          {acc.badge_title || 'Investigator'} • {acc.email}
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#8c6b54] group-hover:text-[#e5c158] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                  </button>
                ))}
              </div>

              {errorMsg && (
                <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs p-2.5 rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="pt-2 border-t border-[#382014] flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('signup');
                  }}
                  className="font-typewriter text-xs text-[#e5c158] hover:text-[#fbf0b9] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Create New Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('signin');
                  }}
                  className="font-typewriter text-xs text-[#b89f89] hover:text-[#f5ebd4] transition-colors underline cursor-pointer"
                >
                  Manual Sign In
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: SIGN UP / CREATE ACCOUNT WITH NAME CHOICE */}
          {mode === 'signup' && (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                  Choose Your Name / Moniker *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Agent Dale Cooper, Audrey Horne"
                  className="w-full bg-[#110a08] border border-[#4a2e20] text-[#f5ebd4] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#b91c1c] focus:ring-1 focus:ring-[#b91c1c] placeholder:text-[#6a4f3e]"
                />
              </div>

              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1.5">
                  Pick Officer Badge Icon
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVATAR_SELECTIONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setAvatar(icon)}
                      className={`w-8 h-8 rounded text-base flex items-center justify-center transition-all cursor-pointer ${
                        avatar === icon
                          ? 'bg-[#3b1d13] border-2 border-[#e5c158] scale-110 shadow-[0_0_8px_rgba(229,193,88,0.4)]'
                          : 'bg-[#120a07] border border-[#3e2417] hover:border-[#6b4530]'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                    Badge Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@twinpeaks.private"
                    className="w-full bg-[#110a08] border border-[#4a2e20] text-[#f5ebd4] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#b91c1c] focus:ring-1 focus:ring-[#b91c1c] placeholder:text-[#6a4f3e]"
                  />
                </div>

                <div>
                  <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                    Rank / Role
                  </label>
                  <input
                    type="text"
                    value={badgeTitle}
                    onChange={(e) => setBadgeTitle(e.target.value)}
                    placeholder="Special Agent / Deputy"
                    className="w-full bg-[#110a08] border border-[#4a2e20] text-[#f5ebd4] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#b91c1c] focus:ring-1 focus:ring-[#b91c1c] placeholder:text-[#6a4f3e]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                  Password (Optional for local, required for Supabase)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create station passcode"
                  className="w-full bg-[#110a08] border border-[#4a2e20] text-[#f5ebd4] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#b91c1c] focus:ring-1 focus:ring-[#b91c1c] placeholder:text-[#6a4f3e]"
                />
              </div>

              {errorMsg && (
                <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs p-2.5 rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] font-typewriter uppercase tracking-widest text-xs py-3 rounded-lg border border-[#b91c1c] shadow-[0_4px_12px_rgba(153,27,27,0.4)] transition-all flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Recording Officer Dossier...</span>
                ) : (
                  <>
                    <UserCheck className="w-4 h-4" />
                    <span>Create Account & Enter Board</span>
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-[#382014] flex items-center justify-between text-xs font-typewriter">
                {savedAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setMode('select');
                    }}
                    className="text-[#e5c158] hover:underline cursor-pointer"
                  >
                    ← Back to Saved Accounts
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('signin');
                  }}
                  className="text-[#d1b194] hover:text-[#f5ebd4] underline cursor-pointer"
                >
                  Already have an account? Sign In
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: SIGN IN WITH EXISTING CREDENTIALS */}
          {mode === 'signin' && (
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                  Badge Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cooper@twinpeaks.gov"
                  className="w-full bg-[#110a08] border border-[#4a2e20] text-[#f5ebd4] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#b91c1c] focus:ring-1 focus:ring-[#b91c1c] placeholder:text-[#6a4f3e]"
                />
              </div>

              <div>
                <label className="block font-typewriter text-xs text-[#cfb69b] uppercase tracking-wider mb-1">
                  Passcode (if password set)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-[#110a08] border border-[#4a2e20] text-[#f5ebd4] text-sm px-3 py-2 rounded focus:outline-none focus:border-[#b91c1c] focus:ring-1 focus:ring-[#b91c1c] placeholder:text-[#6a4f3e]"
                />
              </div>

              {errorMsg && (
                <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs p-2.5 rounded flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#83161c] hover:bg-[#991b1b] text-[#fdf2f2] font-typewriter uppercase tracking-widest text-xs py-3 rounded-lg border border-[#b91c1c] shadow-[0_4px_12px_rgba(153,27,27,0.4)] transition-all flex items-center justify-center gap-2 font-bold cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Verifying Credentials...</span>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>Unlock Case Board</span>
                  </>
                )}
              </button>

              <div className="pt-2 border-t border-[#382014] flex items-center justify-between text-xs font-typewriter">
                {savedAccounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setMode('select');
                    }}
                    className="text-[#e5c158] hover:underline cursor-pointer"
                  >
                    ← View Saved Accounts
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setMode('signup');
                  }}
                  className="text-[#d1b194] hover:text-[#f5ebd4] underline cursor-pointer"
                >
                  Create New Account
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer quote */}
        <p className="font-editorial italic text-xs text-center text-[#9c8472] mt-4 select-none">
          "Every day, once a day, give yourself a present."
        </p>
      </div>
    </div>
  );
};

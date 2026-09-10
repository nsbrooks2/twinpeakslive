/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { getSupabase } from './lib/supabase';
import { UserAccountStore } from './lib/boardStore';
import { UserAccount } from './types';
import { TwinPeaksAuth } from './components/TwinPeaksAuth';
import { BoardCanvas } from './components/BoardCanvas';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      // 1. Check local user storage / UserAccountStore
      const localUser = UserAccountStore.getCurrentUserLocal();
      if (localUser && localUser.email) {
        // Refresh from server if possible
        try {
          const allAccs = await UserAccountStore.loadAllAccounts();
          const found = allAccs.find(a => a.email.toLowerCase() === localUser.email.toLowerCase());
          if (found) {
            setCurrentUser(found);
            UserAccountStore.setCurrentUserLocal(found);
            setLoading(false);
            return;
          }
        } catch {
          // ignore
        }
        setCurrentUser(localUser);
        setLoading(false);
        return;
      }

      // 2. Check Supabase Auth
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            const user = data.session.user;
            const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Agent Cooper';
            const userAcc: UserAccount = {
              id: user.id,
              email: user.email || '',
              name,
              avatar: '☕',
              badge_title: 'Special Agent, FBI',
              department: 'Sheriff Dispatch',
              created_at: new Date().toISOString(),
              last_login: new Date().toISOString(),
            };
            setCurrentUser(userAcc);
            UserAccountStore.setCurrentUserLocal(userAcc);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.warn('Supabase auth check error:', err);
        }
      }

      setLoading(false);
    }

    checkAuth();

    // Listen to Supabase auth state change
    const supabase = getSupabase();
    if (supabase) {
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          const user = session.user;
          const name = user.user_metadata?.display_name || user.email?.split('@')[0] || 'Detective';
          const userAcc: UserAccount = {
            id: user.id,
            email: user.email || '',
            name,
            avatar: '🌲',
            badge_title: 'Investigator',
            department: 'Twin Peaks Dispatch',
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString(),
          };
          setCurrentUser(userAcc);
          UserAccountStore.setCurrentUserLocal(userAcc);
        } else if (!UserAccountStore.getCurrentUserLocal()) {
          setCurrentUser(null);
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  const handleSignOut = async () => {
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out error:', err);
      }
    }
    UserAccountStore.setCurrentUserLocal(null);
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0c0705] flex flex-col items-center justify-center text-[#e8dfd8]">
        <div className="text-4xl animate-bounce mb-3">☕</div>
        <div className="font-typewriter text-xs uppercase tracking-widest text-[#cfb69b]">
          Brewing a damn fine cup of coffee...
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <TwinPeaksAuth
        onAuthenticated={(user) => {
          setCurrentUser(user);
        }}
      />
    );
  }

  return (
    <BoardCanvas
      currentUser={currentUser}
      onSignOut={handleSignOut}
      onUserUpdated={(updated) => setCurrentUser(updated)}
    />
  );
}


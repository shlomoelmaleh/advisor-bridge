import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'advisor' | 'bank' | 'admin';

export interface Profile {
  user_id: string;
  full_name: string | null;
  company: string | null;
  role: UserRole;
  is_approved?: boolean;
  created_at?: string;
}

/** Possible auth states — every consumer must handle each one explicitly */
export type AuthStatus =
  | 'loading'            // session not yet resolved
  | 'unauthenticated'    // no user
  | 'profile-loading'    // user exists, profile being fetched
  | 'no-profile'         // user exists, profile fetch completed with null
  | 'pending-approval'   // user + profile, but is_approved === false
  | 'ready';             // user + approved profile

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  status: AuthStatus;
  signUp: (email: string, password: string, fullName: string, role: UserRole, company?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fetchProfile = async (userId: string): Promise<Profile | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, company, role, is_approved, created_at')
      .eq('user_id', userId)
      .single();
    if (error) {
      console.warn('[Auth] fetchProfile error:', error.message);
      return null;
    }
    return data as unknown as Profile;
  } catch (e) {
    console.warn('[Auth] fetchProfile exception:', e);
    return null;
  }
};

// ─── Provider ─────────────────────────────────────────────────────────────────

let providerMountCount = 0; // DEBUG: track remounts

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const mountedRef = useRef(true);
  const initRanRef = useRef(false); // prevent double init in StrictMode

  useEffect(() => {
    mountedRef.current = true;
    providerMountCount++;
    console.log(`[Auth] AuthProvider mounted (count: ${providerMountCount})`);

    // In StrictMode, useEffect runs twice. Guard with initRanRef.
    if (initRanRef.current) {
      console.log('[Auth] Skipping duplicate init (StrictMode)');
      return;
    }
    initRanRef.current = true;

    let listenerCount = 0;

    // ── init: resolve session, then profile ─────────────────────────────────
    const init = async () => {
      console.log('[Auth] init() starting');
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (error) {
          console.error('[Auth] getSession error:', error.message);
          setSession(null);
          setUser(null);
          setProfile(null);
          setStatus('unauthenticated');
          return;
        }

        const sess = data.session ?? null;
        setSession(sess);
        setUser(sess?.user ?? null);

        if (!sess?.user) {
          console.log('[Auth] init: no session → unauthenticated');
          setProfile(null);
          setStatus('unauthenticated');
          return;
        }

        // User exists — fetch profile BEFORE setting final status
        console.log('[Auth] init: session found, fetching profile…');
        setStatus('profile-loading');
        const p = await fetchProfile(sess.user.id);
        if (!mountedRef.current) return;

        setProfile(p);
        if (!p) {
          console.log('[Auth] init: profile is null → no-profile');
          setStatus('no-profile');
        } else if (p.is_approved === false) {
          console.log('[Auth] init: profile not approved → pending-approval');
          setStatus('pending-approval');
        } else {
          console.log('[Auth] init: profile ready → ready');
          setStatus('ready');
        }
      } catch (e) {
        console.error('[Auth] init exception:', e);
        if (mountedRef.current) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setStatus('unauthenticated');
        }
      }
    };

    // Safety timeout: if still 'loading' after 10s, force unauthenticated
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current && status === 'loading') {
        console.warn('[Auth] Safety timeout: forcing unauthenticated');
        setStatus('unauthenticated');
      }
    }, 10000);

    init();

    // ── auth listener ─────────────────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Skip INITIAL_SESSION — init() already handles it
        if (event === 'INITIAL_SESSION') return;
        if (!mountedRef.current) return;

        listenerCount++;
        console.log(`[Auth] onAuthStateChange: event=${event} (call #${listenerCount})`);

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (!newSession?.user) {
          setProfile(null);
          setStatus('unauthenticated');
          return;
        }

        // User signed in/changed — fetch profile
        setStatus('profile-loading');
        const p = await fetchProfile(newSession.user.id);
        if (!mountedRef.current) return;

        setProfile(p);
        if (!p) {
          setStatus('no-profile');
        } else if (p.is_approved === false) {
          setStatus('pending-approval');
        } else {
          setStatus('ready');
        }
      }
    );

    return () => {
      console.log('[Auth] AuthProvider cleanup');
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
      // Reset initRanRef so re-mount in StrictMode works correctly
      initRanRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auth actions ───────────────────────────────────────────────────────────

  const signUp = useCallback(async (email: string, password: string, fullName: string, role: UserRole, company?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role, company: company ?? null } },
    });
    return { error: error as Error | null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // onAuthStateChange will handle status transitions
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    // onAuthStateChange will set status to 'unauthenticated'
    // but set explicitly for immediate UI response:
    if (mountedRef.current) {
      setUser(null);
      setProfile(null);
      setSession(null);
      setStatus('unauthenticated');
    }
  }, []);

  // Backwards compat: expose loading and profileLoading as derived
  const contextValue: AuthContextValue = {
    user,
    profile,
    session,
    status,
    signUp,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

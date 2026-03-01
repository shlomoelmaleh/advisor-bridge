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
  const [user, _setUser] = useState<User | null>(null);
  const [profile, _setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [status, _setStatus] = useState<AuthStatus>('loading');

  const mountedRef = useRef(true);
  const initRanRef = useRef(false); // prevent double init in StrictMode

  // Track latest state for the listener closure
  const userRef = useRef<User | null>(null);
  const profileRef = useRef<Profile | null>(null);
  const statusRef = useRef<AuthStatus>('loading');

  const setUser = useCallback((u: User | null) => {
    userRef.current = u;
    _setUser(u);
  }, []);

  const setProfile = useCallback((p: Profile | null) => {
    profileRef.current = p;
    _setProfile(p);
  }, []);

  const setStatus = useCallback((s: AuthStatus) => {
    statusRef.current = s;
    _setStatus(s);
  }, []);

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

        // Only block visually if we DO NOT have a profile yet
        if (!profileRef.current) {
          setStatus('profile-loading');
        }

        console.log('[Auth] init: session found, fetching profile…');
        const p = await fetchProfile(sess.user.id);
        if (!mountedRef.current) return;

        if (p) {
          setProfile(p);
          if (p.is_approved === false) setStatus('pending-approval');
          else setStatus('ready');
        } else {
          // If fetch fails, retain the last known good profile (if any)
          if (profileRef.current) {
            console.warn('[Auth] init: profile fetch failed, keeping stale profile');
            setStatus('ready');
          } else {
            setStatus('no-profile');
          }
        }
      } catch (e) {
        console.error('[Auth] init exception:', e);
        if (mountedRef.current) {
          if (!profileRef.current) {
            setSession(null);
            setUser(null);
            setProfile(null);
            setStatus('unauthenticated');
          } else {
            console.warn('[Auth] init: exception caught, restoring ready status to protect stable view');
            setStatus('ready');
          }
        }
      }
    };

    const safetyTimer = setTimeout(() => {
      if (mountedRef.current && statusRef.current === 'loading') {
        console.warn('[Auth] Safety timeout: forcing unauthenticated');
        setStatus('unauthenticated');
      }
    }, 10000);

    init();

    // ── auth listener ─────────────────────────────────────────────────────────
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (event === 'INITIAL_SESSION') return;
        if (!mountedRef.current) return;

        listenerCount++;
        console.log(`[Auth] onAuthStateChange: event=${event} (call #${listenerCount})`);

        const currentUser = userRef.current;
        const currentProfile = profileRef.current;
        const currentStatus = statusRef.current;

        // Idempotency: Ignore redundant SIGNED_IN/TOKEN_REFRESHED if nothing changed
        if (
          (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') &&
          newSession?.user &&
          currentUser?.id === newSession.user.id &&
          (currentStatus === 'ready' || currentStatus === 'pending-approval' || currentStatus === 'no-profile')
        ) {
          console.log('[Auth] Listener idempotent return: profile already stabilized');
          setSession(newSession); // update token
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (!newSession?.user) {
          setProfile(null);
          setStatus('unauthenticated');
          return;
        }

        // Only transition to 'profile-loading' if we actually lack a profile
        if (!currentProfile || currentUser?.id !== newSession.user.id) {
          setStatus('profile-loading');
        } else {
          console.log('[Auth] Listener: Background refetching profile (silent)');
        }

        const p = await fetchProfile(newSession.user.id);
        if (!mountedRef.current) return;

        if (p) {
          setProfile(p);
          if (p.is_approved === false) setStatus('pending-approval');
          else setStatus('ready');
        } else {
          // If fetch fails but we had a profile, keep it stable!
          if (currentProfile && currentUser?.id === newSession.user.id) {
            console.warn('[Auth] Listener: profile refetch failed, preserving existing profile state');
            setStatus('ready');
          } else {
            setStatus('no-profile');
          }
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

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'advisor' | 'bank' | 'admin';

export type SessionState = 'booting' | 'no-session' | 'has-session';
export type RoleState = UserRole | 'unknown';
export type ProfileState = 'idle' | 'loading' | 'ready' | 'missing' | 'pending' | 'error';

export interface Profile {
  user_id: string;
  full_name: string | null;
  company: string | null;
  role: UserRole;
  is_approved?: boolean;
  created_at?: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  sessionState: SessionState;
  roleState: RoleState;
  profileState: ProfileState;
  profile: Profile | null;
  isProfileFetching: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole, company?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  reFetchProfile: () => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_ROLES: UserRole[] = ['advisor', 'bank', 'admin'];
const isValidRole = (r: unknown): r is UserRole => VALID_ROLES.includes(r as UserRole);

const safeParseJSON = (str: string | null) => {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
};

const fetchProfileFromDB = async (userId: string, signal?: AbortSignal): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, company, role, is_approved, created_at')
    .eq('user_id', userId)
    .single();

  if (signal?.aborted) throw new Error('Aborted');
  if (error) {
    if (error.code === 'PGRST116') return null; // no rows
    throw error;
  }
  return data as unknown as Profile;
};

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || 'admin@mortgagebridge.co.il')
  .split(',').map((e: string) => e.trim().toLowerCase());

// ─── Cache helpers (user-scoped) ──────────────────────────────────────────────

const clearAuthCache = () => {
  localStorage.removeItem('advisor_bridge_profile');
  localStorage.removeItem('advisor_bridge_role');
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, _setUser] = useState<User | null>(null);
  const [session, _setSession] = useState<Session | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('booting');
  const [roleState, setRoleState] = useState<RoleState>('unknown');
  const [profileState, setProfileState] = useState<ProfileState>('idle');
  const [profile, _setProfile] = useState<Profile | null>(null);
  const [isProfileFetching, setIsProfileFetching] = useState(false);

  const mountedRef = useRef(true);
  const initRanRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Deduplication: userId currently being fetched + the promise for it
  const fetchingUidRef = useRef<string | null>(null);
  const fetchingPromiseRef = useRef<Promise<Profile | null> | null>(null);

  const sessionUidRef = useRef<string | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Refs to avoid closure staleness
  const userRef = useRef<User | null>(null);
  const roleRef = useRef<RoleState>('unknown');

  // ── Persist profile to cache ──────────────────────────────────────────────
  const setProfile = useCallback((p: Profile | null) => {
    _setProfile(p);
    if (p) {
      localStorage.setItem('advisor_bridge_profile', JSON.stringify(p));
      localStorage.setItem('advisor_bridge_role', p.role);
    } else {
      clearAuthCache();
    }
  }, []);

  // ── Role resolution (Allowlist > DB > JWT-optimistic > Cache) ─────────────
  const resolveRole = useCallback((u: User | null, dbProfile: Profile | null) => {
    const email = u?.email?.toLowerCase();
    const jwtRole = u?.user_metadata?.role;
    const dbRole = dbProfile?.role;
    const cachedRole = localStorage.getItem('advisor_bridge_role');

    let finalRole: RoleState = 'unknown';
    let source = 'none';

    // Priority 1 — Allowlist (ultimate authority for admin)
    if (email && ADMIN_EMAILS.includes(email)) {
      finalRole = 'admin';
      source = 'allowlist';
    }
    // Priority 2 — DB profile role (authority for all roles)
    else if (isValidRole(dbRole)) {
      finalRole = dbRole;
      source = 'db';
      if (isValidRole(jwtRole) && jwtRole !== dbRole) {
        console.warn(`[Auth] role mismatch JWT=${jwtRole} DB=${dbRole} → using DB`);
      }
    }
    // Priority 3 — JWT (optimistic, NEVER admin)
    else if (isValidRole(jwtRole)) {
      if (jwtRole === 'admin') {
        // Admin from JWT alone is denied — must come from DB or allowlist
        finalRole = 'unknown';
        source = 'jwt-denied-admin';
      } else {
        finalRole = jwtRole;
        source = 'jwt-optimistic';
      }
    }
    // Priority 4 — Cache (UX fallback)
    else if (isValidRole(cachedRole)) {
      finalRole = cachedRole;
      source = 'cache';
    }

    if (finalRole !== roleRef.current) {
      console.log(`[Auth] role resolved: ${finalRole} (source=${source})`);
      roleRef.current = finalRole;
      setRoleState(finalRole);
    }
  }, []);

  // ── Profile fetch with promise-based dedup ────────────────────────────────
  const handleProfileFetch = useCallback((uid: string): Promise<Profile | null> => {
    if (!mountedRef.current) return Promise.resolve(null);

    // Reuse in-flight promise for same user
    if (fetchingUidRef.current === uid && fetchingPromiseRef.current) {
      console.log(`[Auth] profile fetch in-flight for ${uid}, reusing`);
      return fetchingPromiseRef.current;
    }

    // Cancel any previous fetch
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    fetchingUidRef.current = uid;

    setProfileState('loading');
    setIsProfileFetching(true);
    console.log(`[Auth] profile fetch start (userId=${uid})`);

    const promise = (async (): Promise<Profile | null> => {
      try {
        const p = await fetchProfileFromDB(uid, ac.signal);
        if (!mountedRef.current || fetchingUidRef.current !== uid) return null;

        setProfile(p);
        resolveRole(userRef.current, p);

        if (!p) {
          console.log('[Auth] profileState=missing');
          setProfileState('missing');
        } else if (p.is_approved === false) {
          console.log('[Auth] profileState=pending');
          setProfileState('pending');
        } else {
          console.log('[Auth] profileState=ready');
          setProfileState('ready');
        }
        return p;
      } catch (e: any) {
        if (e.message === 'Aborted') return null;
        console.error('[Auth] profile fetch error:', e);
        if (mountedRef.current) setProfileState('error');
        return null;
      } finally {
        if (fetchingUidRef.current === uid) {
          fetchingUidRef.current = null;
          fetchingPromiseRef.current = null;
          setIsProfileFetching(false);
        }
      }
    })();

    fetchingPromiseRef.current = promise;
    return promise;
  }, [resolveRole, setProfile]);

  // ── Full reset (used by signOut + SIGNED_OUT listener) ────────────────────
  const fullReset = useCallback(() => {
    console.log('[Auth] full reset');
    _setUser(null);
    _setSession(null);
    _setProfile(null);
    userRef.current = null;
    sessionUidRef.current = null;
    roleRef.current = 'unknown';

    setSessionState('no-session');
    setRoleState('unknown');
    setProfileState('idle');
    setIsProfileFetching(false);

    // Cancel in-flight
    if (abortRef.current) abortRef.current.abort();
    fetchingUidRef.current = null;
    fetchingPromiseRef.current = null;

    // Clear all cache
    clearAuthCache();
  }, []);

  // ── Bootstrap a session (shared between init + listener) ──────────────────
  const bootstrapSession = useCallback((u: User, sess: Session) => {
    _setSession(sess);
    _setUser(u);
    userRef.current = u;
    sessionUidRef.current = u.id;

    setSessionState('has-session');

    // Optimistic role from cache/JWT (never admin from JWT alone)
    resolveRole(u, null);

    // Authoritative fetch from DB
    handleProfileFetch(u.id);
  }, [resolveRole, handleProfileFetch]);

  // ── Init (runs once) ──────────────────────────────────────────────────────
  const init = useCallback(async () => {
    console.log('[Auth] init start');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!mountedRef.current) return;

      if (error) {
        console.error('[Auth] getSession error:', error.message);
        fullReset();
        return;
      }

      const sess = data.session ?? null;
      const u = sess?.user ?? null;

      if (!u || !sess) {
        console.log('[Auth] init → no-session');
        fullReset();
      } else {
        console.log('[Auth] init → has-session');
        bootstrapSession(u, sess);
      }
    } catch (e) {
      console.error('[Auth] init exception:', e);
      if (mountedRef.current) fullReset();
    } finally {
      console.log('[Auth] init complete');
    }
  }, [fullReset, bootstrapSession]);

  const listenerAttachedRef = useRef(false);

  // ── Auth state change listener ────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (initRanRef.current) return;
    initRanRef.current = true;

    // 1. Run init
    init();

    // 2. Attach listener (once)
    if (listenerAttachedRef.current) return;
    listenerAttachedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mountedRef.current) return;
        if (event === 'INITIAL_SESSION') return;

        const newUser = newSession?.user ?? null;

        // Idempotency: skip if session user is the same and it's just a token refresh
        if (
          (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
          newUser?.id === sessionUidRef.current
        ) {
          _setSession(newSession);
          return;
        }

        console.log(`[Auth] onAuthStateChange: event=${event}`);

        // ── SIGNED_OUT ──────────────────────────────────────────────────
        if (!newUser || event === 'SIGNED_OUT') {
          fullReset();
          return;
        }

        // ── SIGNED_IN or new user ───────────────────────────────────────
        const isNewUser = newUser.id !== sessionUidRef.current;

        // Prevent redundant boot if already in correct state
        if (event === 'SIGNED_IN' || isNewUser) {
          if (isNewUser && sessionUidRef.current) {
            console.log('[Auth] user switch detected, resetting state');
            if (abortRef.current) abortRef.current.abort();
            fetchingUidRef.current = null;
            fetchingPromiseRef.current = null;
          }
          bootstrapSession(newUser, newSession!);
        }
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      mountedRef.current = false;
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      if (abortRef.current) abortRef.current.abort();
    };
  }, [init, fullReset, bootstrapSession]);

  // ── signOut (with verification) ───────────────────────────────────────────
  const signOut = useCallback(async () => {
    console.log('[Auth] signOut requested');

    // 1. Call Supabase signOut
    await supabase.auth.signOut();

    // 2. Immediate local reset
    if (mountedRef.current) fullReset();

    // 3. Sanity check: verify session is actually gone
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.error('[Auth] session still exists after signOut, retrying');
        await supabase.auth.signOut();
        if (mountedRef.current) fullReset();
      }
    } catch {
      // Ignore errors during sanity check
    }
  }, [fullReset]);

  // ── signIn ────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  // ── signUp ────────────────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string, fullName: string, role: UserRole, company?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role, company: company ?? null } },
    });
    return { error: error as Error | null };
  }, []);

  // ── reFetchProfile ────────────────────────────────────────────────────────
  const reFetchProfile = useCallback(async () => {
    if (userRef.current) {
      // Force a fresh fetch by clearing the dedup ref
      fetchingUidRef.current = null;
      fetchingPromiseRef.current = null;
      await handleProfileFetch(userRef.current.id);
    }
  }, [handleProfileFetch]);

  // ── Context value ─────────────────────────────────────────────────────────
  const value: AuthContextValue = {
    user, session, sessionState, roleState, profileState, profile, isProfileFetching,
    signUp, signIn, signOut, reFetchProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {sessionState === 'booting' ? (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'advisor' | 'bank' | 'admin';

export type SessionState = 'booting' | 'no-session' | 'has-session';
export type RoleState = UserRole | 'unknown';
export type RoleSource = 'none' | 'allowlist' | 'db' | 'jwt-optimistic' | 'cache';
export type ProfileState = 'idle' | 'loading' | 'ready' | 'missing' | 'pending' | 'error';

export interface Profile {
  user_id: string;
  full_name: string | null;
  company: string | null;
  role: UserRole;
  is_approved?: boolean;
  created_at?: string;
}

// ─── Role finality helpers ─────────────────────────────────────────────────────

/**
 * Returns true when the role is "final" for navigation purposes:
 * - admin: ONLY db or allowlist (never optimistic/cache)
 * - advisor / bank: any non-'none' source qualifies (jwt-optimistic included)
 */
export const isFinalForNavigation = (role: RoleState, src: RoleSource): boolean => {
  if (role === 'unknown') return false;
  if (role === 'admin') return src === 'db' || src === 'allowlist';
  return src !== 'none';
};

/**
 * Returns true when the role is authoritative from a security standpoint.
 * Use for admin authorization and requireFinalRole guards.
 */
export const isFinalForSecurity = (src: RoleSource): boolean =>
  src === 'db' || src === 'allowlist';

// Keep backward-compat alias
export const isRoleFinalSource = isFinalForSecurity;

// ─── Routing Helpers ──────────────────────────────────────────────────────────

export const getHomePathByRole = (role: RoleState): string => {
  switch (role) {
    case 'admin': return '/admin/dashboard';
    case 'bank': return '/bank/dashboard';
    case 'advisor': return '/advisor/dashboard';
    default: return '/';
  }
};

// ─── Context ──────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  sessionState: SessionState;
  roleState: RoleState;
  roleSource: RoleSource;
  /** True when the role is final enough to navigate (role-aware). */
  roleFinal: boolean;
  profileState: ProfileState;
  profile: Profile | null;
  isProfileFetching: boolean;
  signUp: (email: string, password: string, fullName: string, role: UserRole, company?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  reFetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Constants & pure helpers ─────────────────────────────────────────────────

const VALID_ROLES: UserRole[] = ['advisor', 'bank', 'admin'];
const isValidRole = (r: unknown): r is UserRole => VALID_ROLES.includes(r as UserRole);

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || 'admin@mortgagebridge.co.il')
  .split(',').map((e: string) => e.trim().toLowerCase());

const clearAuthCache = () => {
  localStorage.removeItem('advisor_bridge_profile');
  localStorage.removeItem('advisor_bridge_role');
};

const fetchProfileFromDB = async (userId: string, signal?: AbortSignal): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, full_name, company, role, is_approved, created_at')
    .eq('user_id', userId)
    .single();

  if (signal?.aborted) throw new Error('Aborted');
  if (error) {
    if (error.code === 'PGRST116') return null; // no rows — not an error
    throw error;
  }
  return data as unknown as Profile;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, _setUser] = useState<User | null>(null);
  const [session, _setSession] = useState<Session | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('booting');
  const [roleState, setRoleState] = useState<RoleState>('unknown');
  const [roleSource, setRoleSource] = useState<RoleSource>('none');
  const [profileState, setProfileState] = useState<ProfileState>('idle');
  const [profile, _setProfile] = useState<Profile | null>(null);
  const [isProfileFetching, setIsProfileFetching] = useState(false);

  const mountedRef = useRef(true);
  const initRanRef = useRef(false);
  const listenerAttachedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Strict single-fetch deduplication per userId
  const fetchingUidRef = useRef<string | null>(null);
  const fetchingPromiseRef = useRef<Promise<Profile | null> | null>(null);

  const sessionUidRef = useRef<string | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  const userRef = useRef<User | null>(null);
  const roleRef = useRef<RoleState>('unknown');
  const roleSourceRef = useRef<RoleSource>('none');

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

  // ── Update role state atomically ──────────────────────────────────────────
  const applyRole = useCallback((role: RoleState, src: RoleSource) => {
    if (role !== roleRef.current || src !== roleSourceRef.current) {
      console.log(`[Auth] role resolved: ${role} (source=${src})`);
      roleRef.current = role;
      roleSourceRef.current = src;
      setRoleState(role);
      setRoleSource(src);
    }
  }, []);

  // ── Optimistic role from JWT / cache (called before DB responds) ──────────
  const resolveOptimisticRole = useCallback((u: User) => {
    const email = u.email?.toLowerCase();
    const jwtRole = u.user_metadata?.role;
    const cachedRole = localStorage.getItem('advisor_bridge_role');

    // Admin allowlist → immediate authoritative role (no optimistic advisor risk)
    if (email && ADMIN_EMAILS.includes(email)) {
      applyRole('admin', 'allowlist');
      return;
    }

    // JWT optimistic (non-admin only)
    if (isValidRole(jwtRole) && jwtRole !== 'admin') {
      applyRole(jwtRole, 'jwt-optimistic');
      return;
    }

    // Cache fallback (non-admin only)
    if (isValidRole(cachedRole) && cachedRole !== 'admin') {
      applyRole(cachedRole as UserRole, 'cache');
      return;
    }

    // No optimistic role available — stay unknown
    applyRole('unknown', 'none');
  }, [applyRole]);

  // ── Authoritative role from DB profile ────────────────────────────────────
  const resolveRoleFromDB = useCallback((u: User, dbProfile: Profile | null) => {
    const email = u.email?.toLowerCase();

    if (dbProfile && isValidRole(dbProfile.role)) {
      const dbRole = dbProfile.role;
      const prevOptimistic = roleRef.current;
      // Log quietly only if there was an actual correction
      if (isValidRole(prevOptimistic) && prevOptimistic !== dbRole) {
        console.log(`[Auth] role correction: JWT=${prevOptimistic} DB=${dbRole} → following DB`);
      }
      // Allowlist still wins for admin email (belt and suspenders)
      if (email && ADMIN_EMAILS.includes(email) && dbRole !== 'admin') {
        console.warn(`[Auth] allowlisted admin has non-admin DB role (${dbRole}); using allowlist`);
        applyRole('admin', 'allowlist');
      } else {
        applyRole(dbRole, 'db');
      }
      return;
    }

    // Profile missing: for admin allowlist, that's suspicious
    if (email && ADMIN_EMAILS.includes(email)) {
      console.warn('[Auth] admin allowlist user has no DB profile — keeping unknown until profile is created');
      applyRole('unknown', 'none');
      return;
    }

    // Profile missing for non-admin: use JWT/cache if available (user can still operate with banner)
    const currentRole = roleRef.current;
    if (currentRole !== 'unknown') {
      // Already have an optimistic role → keep it, mark as final (profile just missing)
      applyRole(currentRole, roleSourceRef.current);
    }
    // else: remains unknown (new user with no profile yet?)
  }, [applyRole]);

  // ── Profile fetch with strict single-fetch dedup ──────────────────────────
  const handleProfileFetch = useCallback((uid: string): Promise<Profile | null> => {
    if (!mountedRef.current) return Promise.resolve(null);

    // Same user already in-flight → reuse promise
    if (fetchingUidRef.current === uid && fetchingPromiseRef.current) {
      console.log(`[Auth] profile fetch already in-flight for ${uid}, skipping`);
      return fetchingPromiseRef.current;
    }

    // Cancel any previous (different user) fetch
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

        // Always upgrade roleSource to 'db' now (critical for finality)
        resolveRoleFromDB(userRef.current!, p);

        if (!p) {
          setProfileState('missing');
          console.log('[Auth] profileState=missing');
        } else if (p.is_approved === false) {
          setProfileState('pending');
          console.log('[Auth] profileState=pending');
        } else {
          setProfileState('ready');
          console.log('[Auth] profileState=ready');
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
  }, [setProfile, resolveRoleFromDB]);

  // ── Full reset ─────────────────────────────────────────────────────────────
  const fullReset = useCallback(() => {
    console.log('[Auth] full reset');
    _setUser(null);
    _setSession(null);
    _setProfile(null);
    userRef.current = null;
    sessionUidRef.current = null;
    roleRef.current = 'unknown';
    roleSourceRef.current = 'none';

    setSessionState('no-session');
    setRoleState('unknown');
    setRoleSource('none');
    setProfileState('idle');
    setIsProfileFetching(false);

    if (abortRef.current) abortRef.current.abort();
    fetchingUidRef.current = null;
    fetchingPromiseRef.current = null;

    clearAuthCache();
  }, []);

  // ── Bootstrap a session ───────────────────────────────────────────────────
  const bootstrapSession = useCallback((u: User, sess: Session) => {
    // Prevent double-bootstrap for same user
    if (sessionUidRef.current === u.id) {
      console.log('[Auth] bootstrap skipped: same user already active');
      return;
    }

    _setSession(sess);
    _setUser(u);
    userRef.current = u;
    sessionUidRef.current = u.id;

    setSessionState('has-session');

    // Set optimistic role immediately (unblocks advisor/bank instantly)
    resolveOptimisticRole(u);

    // Authoritative fetch (always runs and always upgrades roleSource to 'db')
    handleProfileFetch(u.id);
  }, [resolveOptimisticRole, handleProfileFetch]);

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
        console.log('[Auth] session=no-session');
        // transition out of booting
        setSessionState('no-session');
      } else {
        console.log(`[Auth] session=has-session userId=${u.id}`);
        bootstrapSession(u, sess);
      }
    } catch (e) {
      console.error('[Auth] init exception:', e);
      if (mountedRef.current) fullReset();
    }
  }, [fullReset, bootstrapSession]);

  // ── Auth state change listener ────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;
    if (initRanRef.current) return;
    initRanRef.current = true;

    init();

    if (listenerAttachedRef.current) return;
    listenerAttachedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mountedRef.current) return;
        if (event === 'INITIAL_SESSION') return; // handled by init()

        const newUser = newSession?.user ?? null;

        // Token refresh / metadata update for same user → just update session obj
        if (
          (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
          newUser?.id === sessionUidRef.current
        ) {
          _setSession(newSession);
          return;
        }

        console.log(`[Auth] onAuthStateChange event=${event}`);

        if (!newUser || event === 'SIGNED_OUT') {
          fullReset();
          return;
        }

        // SIGNED_IN for a new user → bootstrap (guard in bootstrapSession prevents dupe)
        if (event === 'SIGNED_IN' || newUser.id !== sessionUidRef.current) {
          bootstrapSession(newUser, newSession!);
        }
      }
    );

    subscriptionRef.current = subscription;

    return () => {
      mountedRef.current = false;
      subscriptionRef.current?.unsubscribe();
      subscriptionRef.current = null;
      abortRef.current?.abort();
    };
  }, [init, fullReset, bootstrapSession]);

  // ── signOut ───────────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    console.log('[Auth] signOut requested');
    await supabase.auth.signOut();
    if (mountedRef.current) fullReset();

    // Sanity check
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        console.error('[Auth] session persisted after signOut, retrying');
        await supabase.auth.signOut();
        if (mountedRef.current) fullReset();
      }
    } catch { /* ignore */ }
  }, [fullReset]);

  // ── signIn ────────────────────────────────────────────────────────────────
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  }, []);

  // ── signUp ────────────────────────────────────────────────────────────────
  const signUp = useCallback(async (
    email: string, password: string, fullName: string, role: UserRole, company?: string
  ) => {
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role, company: company ?? null } },
    });
    return { error: error as Error | null };
  }, []);

  // ── reFetchProfile ────────────────────────────────────────────────────────
  const reFetchProfile = useCallback(async () => {
    if (userRef.current) {
      fetchingUidRef.current = null;
      fetchingPromiseRef.current = null;
      await handleProfileFetch(userRef.current.id);
    }
  }, [handleProfileFetch]);

  // ── Derived: roleFinal ────────────────────────────────────────────────────
  const roleFinal = isFinalForNavigation(roleState, roleSource);

  // ── Context value ─────────────────────────────────────────────────────────
  const value: AuthContextValue = {
    user, session, sessionState, roleState, roleSource, roleFinal,
    profileState, profile, isProfileFetching,
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

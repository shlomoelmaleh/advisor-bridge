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

const safeParseJSON = (str: string | null) => {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
};

const fetchProfile = async (userId: string, signal?: AbortSignal): Promise<Profile | null> => {
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, _setUser] = useState<User | null>(null);
  const [session, _setSession] = useState<Session | null>(null);

  const [sessionState, setSessionState] = useState<SessionState>('booting');
  const [roleState, setRoleState] = useState<RoleState>('unknown');
  const [profileState, setProfileState] = useState<ProfileState>('idle');
  const [profile, _setProfile] = useState<Profile | null>(() => safeParseJSON(localStorage.getItem('advisor_bridge_profile')));
  const [isProfileFetching, setIsProfileFetching] = useState(false);

  const mountedRef = useRef(true);
  const initRanRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const fetchingUserIdRef = useRef<string | null>(null);
  const sessionUserRef = useRef<string | null>(null);

  // Refs for state to avoid closure staleness in listeners
  const userRef = useRef<User | null>(null);
  const roleRef = useRef<RoleState>('unknown');

  const setProfile = useCallback((p: Profile | null) => {
    _setProfile(p);
    if (p) {
      localStorage.setItem('advisor_bridge_profile', JSON.stringify(p));
      localStorage.setItem('advisor_bridge_role', p.role);
    } else {
      localStorage.removeItem('advisor_bridge_profile');
      localStorage.removeItem('advisor_bridge_role');
    }
  }, []);

  const resolveRole = useCallback((u: User | null, p: Profile | null, source: 'jwt' | 'db' | 'cache' = 'jwt') => {
    const jwtRole = u?.user_metadata?.role as UserRole | undefined;
    const dbRole = p?.role;
    const cachedRole = localStorage.getItem('advisor_bridge_role') as UserRole | null;

    let finalRole: RoleState = 'unknown';
    let actualSource = source;

    // Priority: JWT > DB > Cache
    if (jwtRole) {
      finalRole = jwtRole;
      actualSource = 'jwt';
      if (dbRole && dbRole !== jwtRole) {
        console.warn(`[Auth][WARN] role mismatch JWT=${jwtRole} DB=${dbRole} -> using JWT`);
      }
    } else if (dbRole) {
      finalRole = dbRole;
      actualSource = 'db';
    } else if (cachedRole) {
      finalRole = cachedRole;
      actualSource = 'cache';
    }

    if (finalRole !== roleRef.current) {
      console.log(`[Auth] role resolved: ${finalRole} (source=${actualSource})`);
      roleRef.current = finalRole;
      setRoleState(finalRole);
    }
  }, []);

  const handleProfileFetch = async (uid: string) => {
    if (!mountedRef.current) return;

    // In-flight protection
    if (fetchingUserIdRef.current === uid) {
      console.log(`[Auth] profile fetch already in-flight for ${uid}, skipping`);
      return;
    }

    // Cancellation of previous in-flight request
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    fetchingUserIdRef.current = uid;

    setProfileState('loading');
    console.log(`[Auth] profile fetch start (userId=${uid})`);

    try {
      const p = await fetchProfile(uid, abortControllerRef.current.signal);
      if (!mountedRef.current) return;

      setProfile(p);
      resolveRole(userRef.current, p, 'db');

      if (!p) {
        console.log('[Auth] profile state=missing');
        setProfileState('missing');
      } else if (p.is_approved === false) {
        console.log('[Auth] profile state=pending');
        setProfileState('pending');
      } else {
        console.log('[Auth] profile state=ready');
        setProfileState('ready');
      }
    } catch (e: any) {
      if (e.message === 'Aborted') return;
      console.error('[Auth] profile fetch error:', e);
      if (mountedRef.current) {
        setProfileState('error');
      }
    } finally {
      if (mountedRef.current && fetchingUserIdRef.current === uid) {
        fetchingUserIdRef.current = null;
        setIsProfileFetching(false);
      }
    }
  };

  const init = async () => {
    console.log('[Auth] init start');
    try {
      const { data, error } = await supabase.auth.getSession();
      if (!mountedRef.current) return;

      if (error) {
        console.error('[Auth] getSession error:', error.message);
        setSessionState('no-session');
        return;
      }

      const sess = data.session ?? null;
      const u = sess?.user ?? null;

      _setSession(sess);
      _setUser(u);
      userRef.current = u;
      sessionUserRef.current = u?.id ?? null;

      if (!u) {
        console.log('[Auth] session=no-session');
        setSessionState('no-session');
        setRoleState('unknown');
        roleRef.current = 'unknown';
        return;
      }

      console.log('[Auth] session=has-session');
      setSessionState('has-session');

      // Immediate role resolution (JWT > Cache)
      resolveRole(u, profile, 'cache');

      // Background profile fetch
      handleProfileFetch(u.id);

    } catch (e) {
      console.error('[Auth] init exception:', e);
      if (mountedRef.current) setSessionState('no-session');
    } finally {
      console.log('[App] ready');
    }
  };

  const reFetchProfile = useCallback(async () => {
    if (userRef.current) {
      await handleProfileFetch(userRef.current.id);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (initRanRef.current) return;
    initRanRef.current = true;

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mountedRef.current) return;
        if (event === 'INITIAL_SESSION') return;

        const newUser = newSession?.user ?? null;

        // Idempotency: skip if session user is the same and it's just a token refresh
        if (
          event === 'TOKEN_REFRESHED' &&
          newUser?.id === sessionUserRef.current
        ) {
          _setSession(newSession);
          return;
        }

        console.log(`[Auth] onAuthStateChange: event=${event}`);

        _setSession(newSession);
        _setUser(newUser);
        userRef.current = newUser;
        const oldUid = sessionUserRef.current;
        sessionUserRef.current = newUser?.id ?? null;

        if (!newUser || event === 'SIGNED_OUT') {
          console.log('[Auth] session=no-session');
          setSessionState('no-session');
          setRoleState('unknown');
          roleRef.current = 'unknown';
          setProfile(null);
          setProfileState('idle');
          if (abortControllerRef.current) abortControllerRef.current.abort();
          fetchingUserIdRef.current = null;
          return;
        }

        console.log('[Auth] session=has-session');
        setSessionState('has-session');

        // Immediate role resolution from JWT
        resolveRole(newUser, null, 'jwt');

        // Only fetch if it's a new user or a SIGNED_IN event (which might be after session cleared)
        if (newUser.id !== oldUid || event === 'SIGNED_IN') {
          handleProfileFetch(newUser.id);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []); // Empty deps to ensure single listener

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
    return { error: error as Error | null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    if (mountedRef.current) {
      _setUser(null);
      setProfile(null);
      _setSession(null);
      setSessionState('no-session');
      setRoleState('unknown');
      roleRef.current = 'unknown';
      setProfileState('idle');
    }
  }, [setProfile]);

  const value: AuthContextValue = {
    user,
    session,
    sessionState,
    roleState,
    profileState,
    profile,
    isProfileFetching,
    signUp,
    signIn,
    signOut,
    reFetchProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {sessionState === 'booting' ? (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

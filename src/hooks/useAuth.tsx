import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
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

interface AuthContextValue {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;            // true only during initial session resolution
  profileLoading: boolean;     // true while profile is being fetched
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
    if (error) return null;
    return data as unknown as Profile;
  } catch {
    return null;
  }
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  // Guard against updates after unmount
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // ── STEP 1: Resolve session (with safety timeout) ─────────────────────────
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mountedRef.current) return;

        if (error) {
          console.error('getSession error:', error.message);
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }

        const sess = data.session ?? null;
        setSession(sess);
        setUser(sess?.user ?? null);

        // CRITICAL: Drop loading immediately after session resolves.
        // UI can now render based on user presence.
        setLoading(false);

        // ── STEP 2: Fetch profile in the background ─────────────────────────
        if (sess?.user) {
          setProfileLoading(true);
          const p = await fetchProfile(sess.user.id);
          if (mountedRef.current) {
            setProfile(p);
            setProfileLoading(false);
          }
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
      } catch (e) {
        // Catch-all: NEVER stay stuck on loading
        console.error('Auth init failed:', e);
        if (mountedRef.current) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          setProfileLoading(false);
        }
      }
    };

    // Safety timeout: if init() takes more than 8 seconds, force loading=false
    const safetyTimer = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.warn('Auth safety timeout: forcing loading=false');
        setLoading(false);
        setProfileLoading(false);
      }
    }, 8000);

    init();

    // ── STEP 3: Listen for future auth changes ────────────────────────────────
    // Registered ONCE in this useEffect. Cleaned up on unmount.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        // Skip INITIAL_SESSION — init() handles it
        if (event === 'INITIAL_SESSION') return;
        if (!mountedRef.current) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setProfileLoading(true);
          const p = await fetchProfile(newSession.user.id);
          if (mountedRef.current) {
            setProfile(p);
            setProfileLoading(false);
          }
        } else {
          setProfile(null);
          setProfileLoading(false);
        }
      }
    );

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Auth actions ───────────────────────────────────────────────────────────

  const signUp = async (email: string, password: string, fullName: string, role: UserRole, company?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, role, company: company ?? null } },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    if (mountedRef.current) {
      setUser(null);
      setProfile(null);
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, session, loading, profileLoading, signUp, signIn, signOut }}>
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

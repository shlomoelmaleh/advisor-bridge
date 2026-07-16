import type { UserRole } from '@/hooks/useAuth';

/**
 * Central React Query key factory. Every key is namespaced by userId (and role
 * where the fetched rows differ by role) so that switching accounts in the same
 * tab can never surface a previous user's cached data before their own fetch
 * lands — the auth listener in App.tsx clears the whole cache on user-id change
 * as a second layer.
 */

const uid = (userId?: string | null) => userId ?? 'anon';
const r = (role?: UserRole | null) => role ?? 'none';

export const queryKeys = {
  cases: (userId?: string | null, role?: UserRole | null) => ['cases', uid(userId), r(role)] as const,

  appetiteMine: (userId?: string | null) => ['appetites', 'mine', uid(userId)] as const,
  appetiteOpenCases: (userId?: string | null) => ['appetites', 'openCases', uid(userId)] as const,

  matches: (userId?: string | null, role?: UserRole | null) => ['matches', uid(userId), r(role)] as const,
  unreadCounts: (userId?: string | null) => ['unreadCounts', uid(userId)] as const,

  navbarBadges: (userId?: string | null, role?: UserRole | null) => ['navbarBadges', uid(userId), r(role)] as const,
  activityLog: (userId?: string | null, role?: UserRole | null) => ['activityLog', uid(userId), r(role)] as const,

  admin: {
    pendingUsers: (userId?: string | null) => ['admin', uid(userId), 'pendingUsers'] as const,
    allUsers: (userId?: string | null, page?: number) => ['admin', uid(userId), 'allUsers', page ?? 0] as const,
    pendingCases: (userId?: string | null) => ['admin', uid(userId), 'pendingCases'] as const,
    pendingAppetites: (userId?: string | null) => ['admin', uid(userId), 'pendingAppetites'] as const,
    stats: (userId?: string | null) => ['admin', uid(userId), 'stats'] as const,
  },
};

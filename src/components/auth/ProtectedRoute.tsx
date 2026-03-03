import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole, getHomePathByRole, isFinalForSecurity } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

const SESSION_REDIRECT_KEY = 'postLoginRedirect';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[] | 'any-authenticated' | 'any';
    /**
     * When true, role must be security-final (DB or allowlist) before granting access.
     * Set on /admin/* routes. Default: false — advisor/bank navigate from jwt-optimistic.
     */
    requireFinalRole?: boolean;
}

/**
 * Route guard for authenticated pages.
 *
 * Decision tree:
 * 1. booting       → null (global spinner from AuthProvider)
 * 2. no-session    → store current path → redirect to / (login)
 * 3. any-authenticated → render immediately
 * 4. roleState === unknown
 *    a. profileState === loading → show spinner (DB fetch in-flight)
 *    b. otherwise               → show "Unable to resolve role" + Sign Out (no auto-redirect loop)
 * 5. requireFinalRole && !securityFinal → spinner (admin waiting for DB)
 * 6. role in allowedRoles → render
 * 7. role NOT in allowedRoles → redirect to that role's dashboard (never to /)
 *
 * NEVER inspects profileState for access. NEVER has a timeout redirect.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    requireFinalRole = false,
}) => {
    const { sessionState, roleState, roleSource, profileState, signOut } = useAuth();
    const location = useLocation();

    // ── 1. Booting ────────────────────────────────────────────────────────────
    if (sessionState === 'booting') return null;

    // ── 2. No session → remember path + go to login ──────────────────────────
    if (sessionState === 'no-session') {
        const path = location.pathname + location.search;
        if (path !== '/') {
            sessionStorage.setItem(SESSION_REDIRECT_KEY, path);
        }
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // ── 3. Any-authenticated routes ───────────────────────────────────────────
    if (allowedRoles === 'any-authenticated' || allowedRoles === 'any') {
        return <>{children}</>;
    }

    // ── 4. Role unknown ───────────────────────────────────────────────────────
    if (roleState === 'unknown') {
        // Still fetching from DB → show spinner
        if (profileState === 'loading') {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">מזהה הרשאות...</p>
                </div>
            );
        }

        // DB fetch done but role still unknown → show error (no redirect loop)
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background" dir="rtl">
                <p className="text-lg font-semibold">לא ניתן לזהות את ההרשאות שלך</p>
                <p className="text-sm text-muted-foreground">אנא צור קשר עם התמיכה או נסה להתנתק ולהתחבר מחדש.</p>
                <Button variant="outline" onClick={() => signOut()}>התנתק</Button>
            </div>
        );
    }

    // ── 5. requireFinalRole: wait for DB authority (admin routes) ─────────────
    if (requireFinalRole && !isFinalForSecurity(roleSource)) {
        // Still fetching → spinner
        if (profileState === 'loading') {
            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">מזהה הרשאות...</p>
                </div>
            );
        }
        // profileState not loading but role not security-final → role mismatch
        // Fall through to step 7 (role-based redirect)
    }

    // ── 6. Role in allowedRoles → grant access ────────────────────────────────
    if (allowedRoles.includes(roleState as UserRole)) {
        return <>{children}</>;
    }

    // ── 7. Wrong role → redirect to the correct dashboard ────────────────────
    console.log(`[RouteGuard] path=${location.pathname} role=${roleState}(${roleSource}) denied → redirecting to home`);
    const dest = getHomePathByRole(roleState);
    return <Navigate to={dest} replace />;
};

export { SESSION_REDIRECT_KEY };
export default ProtectedRoute;

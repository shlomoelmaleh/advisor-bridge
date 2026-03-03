import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole, getHomePathByRole, isFinalForNavigation, isFinalForSecurity } from '@/hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[] | 'any-authenticated' | 'any';
    /**
     * When true, requires a security-final role (DB or allowlist) before granting access.
     * Use for /admin/* routes to prevent jwt-optimistic advisor from transiently entering admin.
     * Default: false — advisor/bank routes navigate as soon as jwt-optimistic role is set.
     */
    requireFinalRole?: boolean;
}

/**
 * Route guard for authenticated pages.
 * - Never inspects profileState or approval status — those are UI-only concerns.
 * - Shows a lightweight spinner while role is resolving.
 * - 5s safety timeout to avoid infinite hangs.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    requireFinalRole = false,
}) => {
    const { sessionState, roleState, roleSource } = useAuth();
    const location = useLocation();
    const [timedOut, setTimedOut] = useState(false);

    // Whether to show the "resolving" spinner:
    // - always wait when roleState is unknown
    // - for requireFinalRole routes: also wait while role isn't security-final
    const isWaitingForRole =
        sessionState === 'has-session' &&
        (roleState === 'unknown' ||
            (requireFinalRole && !isFinalForSecurity(roleSource)));

    // Reset timeout whenever role state improves
    useEffect(() => {
        setTimedOut(false);
    }, [roleState, roleSource, sessionState]);

    // Safety timeout: 5s to resolve, then fail-closed
    useEffect(() => {
        if (!isWaitingForRole) return;
        const timer = setTimeout(() => {
            console.warn(`[RouteGuard] role resolution timed out on ${location.pathname}`);
            setTimedOut(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, [isWaitingForRole, location.pathname]);

    // ── 1. Booting → nothing (AuthProvider shows global spinner) ─────────────
    if (sessionState === 'booting') return null;

    // ── 2. No session → login page ────────────────────────────────────────────
    if (sessionState === 'no-session') {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // ── 3. Any-authenticated routes (e.g. /matches, /chat) ───────────────────
    if (allowedRoles === 'any-authenticated' || allowedRoles === 'any') {
        return <>{children}</>;
    }

    // ── 4. Waiting for role to resolve ────────────────────────────────────────
    if (isWaitingForRole) {
        if (timedOut) {
            console.error('[RouteGuard] timed out → redirecting to /');
            return <Navigate to="/" replace />;
        }
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-muted-foreground">מזהה הרשאות...</p>
            </div>
        );
    }

    // ── 5. Role is ready — check if it's in the allowed list ─────────────────
    // For routes with requireFinalRole: role is guaranteed security-final here.
    // For routes without it: jwt-optimistic is accepted.
    if (roleState !== 'unknown' && allowedRoles.includes(roleState as UserRole)) {
        return <>{children}</>;
    }

    // ── 6. Role doesn't match → redirect to that user's dashboard ────────────
    console.log(`[RouteGuard] path=${location.pathname} role=${roleState}(${roleSource}) denied → redirecting`);
    const dest = getHomePathByRole(roleState);
    return <Navigate to={dest} replace />;
};

export default ProtectedRoute;

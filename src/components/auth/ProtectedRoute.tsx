import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole, getHomePathByRole, isRoleFinalSource } from '@/hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[] | 'any-authenticated' | 'any';
    /**
     * When true, role must be authoritative (from DB or allowlist) before granting access.
     * Use for role-specific dashboards to prevent transient optimistic-role access.
     * Default: false (only checks sessionState + roleState match).
     */
    requireFinalRole?: boolean;
}

/**
 * Route guard for authenticated pages.
 * - Gates on SessionState + RoleState (+ roleSource when requireFinalRole=true).
 * - NEVER gates on ProfileState or approval status.
 * - Shows a lightweight "Resolving role..." placeholder while waiting for final role.
 * - Has a 5s safety timeout that redirects to / to prevent infinite hangs.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    children,
    allowedRoles,
    requireFinalRole = false,
}) => {
    const { sessionState, roleState, roleSource } = useAuth();
    const location = useLocation();
    const [timedOut, setTimedOut] = useState(false);

    const roleFinal = isRoleFinalSource(roleSource);

    // Determine whether we're actively waiting for role resolution
    const isWaitingForRole =
        sessionState === 'has-session' &&
        (roleState === 'unknown' || (requireFinalRole && !roleFinal));

    // Reset timeout whenever role state changes
    useEffect(() => {
        setTimedOut(false);
    }, [roleState, roleSource, sessionState]);

    // Safety timeout: 5s to resolve role, then fail-closed
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

    // ── 4. Still waiting for role to resolve or finalize ─────────────────────
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

    // ── 5. Role known + allowed → grant access ────────────────────────────────
    if (roleState !== 'unknown' && allowedRoles.includes(roleState as UserRole)) {
        return <>{children}</>;
    }

    // ── 6. Role known but NOT in allowedRoles → redirect to their dashboard ──
    console.log(`[RouteGuard] path=${location.pathname} role=${roleState} not in [${allowedRoles}] → redirecting`);
    const dest = getHomePathByRole(roleState);
    return <Navigate to={dest} replace />;
};

export default ProtectedRoute;

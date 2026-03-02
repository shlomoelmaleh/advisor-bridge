import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[] | 'any-authenticated' | 'any';
}

/**
 * Route guard for authenticated pages.
 * Gates ONLY on SessionState + RoleState.
 * NEVER inspects ProfileState, approval, or profile completeness.
 * 
 * When role is still resolving (unknown + profile loading), shows an
 * "Authorizing" placeholder with a 5s safety timeout.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { sessionState, roleState, profileState } = useAuth();
    const location = useLocation();
    const [timedOut, setTimedOut] = useState(false);

    // Reset timeout when deps change (e.g., role resolves)
    useEffect(() => {
        setTimedOut(false);
    }, [roleState, sessionState]);

    // Safety timeout: 5s to resolve role, then fail-closed
    useEffect(() => {
        if (sessionState !== 'has-session') return;
        // Still waiting for authority?
        const isWaiting = roleState === 'unknown' || profileState === 'loading';
        if (!isWaiting) return;

        const timer = setTimeout(() => {
            console.warn(`[RouteGuard] role resolution timed out on ${location.pathname}`);
            setTimedOut(true);
        }, 5000);
        return () => clearTimeout(timer);
    }, [sessionState, roleState, profileState, location.pathname]);

    // ── 1. Booting → nothing (AuthProvider shows global spinner) ──────────
    if (sessionState === 'booting') return null;

    // ── 2. No session → login page ────────────────────────────────────────
    if (sessionState === 'no-session') {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // ── 3. Has session → role checks ─────────────────────────────────────
    // Any authenticated user
    if (allowedRoles === 'any-authenticated' || allowedRoles === 'any') {
        return <>{children}</>;
    }

    // Role known + allowed
    if (roleState !== 'unknown' && allowedRoles.includes(roleState as UserRole)) {
        return <>{children}</>;
    }

    // Still waiting for DB authority (role unknown or profile loading)
    // Do NOT redirect yet — DB might correct JWT role (e.g., admin override)
    if (roleState === 'unknown' || profileState === 'loading') {
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

    // Role known but NOT in allowedRoles → redirect to their dashboard
    console.warn(`[RouteGuard] denied ${location.pathname} for role=${roleState}`);
    const dest =
        roleState === 'advisor' ? '/advisor/dashboard' :
            roleState === 'bank' ? '/bank/dashboard' :
                roleState === 'admin' ? '/admin/dashboard' :
                    '/';
    return <Navigate to={dest} replace />;
};

export default ProtectedRoute;

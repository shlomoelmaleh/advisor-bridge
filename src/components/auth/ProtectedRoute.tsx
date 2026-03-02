import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[] | 'any-authenticated' | 'any';
}

/**
 * Route guard for authenticated pages.
 * Routing depends ONLY on SessionState and RoleState.
 * NEVER inspects ProfileState or approval status.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { sessionState, roleState, profileState } = useAuth();
    const location = useLocation();
    const [isTimedOut, setIsTimedOut] = useState(false);

    // Safety timeout: if we have a session but role stays unknown for 5s, 
    // we fail closed to prevent infinite hangs.
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (sessionState === 'has-session' && (roleState === 'unknown' || profileState === 'loading')) {
            timer = setTimeout(() => {
                console.warn(`[RouteGuard] Authorization timed out for ${location.pathname}`);
                setIsTimedOut(true);
            }, 5000);
        }
        return () => clearTimeout(timer);
    }, [sessionState, roleState, profileState, location.pathname]);

    // Log the current evaluation for debugging
    const allowedRolesStr = allowedRoles === 'any' || allowedRoles === 'any-authenticated'
        ? allowedRoles
        : (Array.isArray(allowedRoles) ? allowedRoles.join(',') : 'invalid');

    console.log(`[RouteGuard] Path="${location.pathname}" Session="${sessionState}" Role="${roleState}" ProfileState="${profileState}" AllowedRoles=[${allowedRolesStr}]`);

    // 1. Still booting -> show global loader (mostly handled by AuthProvider)
    if (sessionState === 'booting') {
        return null;
    }

    // 2. Unauthenticated -> redirect to login (RootRoute)
    if (sessionState === 'no-session') {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // 3. Session resolved -> check roles
    if (sessionState === 'has-session') {
        // Any authenticated user allowed
        if (allowedRoles === 'any-authenticated' || allowedRoles === 'any') {
            return <>{children}</>;
        }

        // Specific roles allowed - check immediately if role is known
        if (roleState !== 'unknown' && allowedRoles.includes(roleState as UserRole)) {
            return <>{children}</>;
        }

        // Role Resolution / Waiting for DB Source of Truth
        // We only redirect if we are NOT loading from the DB anymore.
        // This prevents redirecting an Admin who has 'advisor' in their initial JWT.
        if (roleState === 'unknown' || profileState === 'loading') {
            if (isTimedOut) {
                console.error(`[RouteGuard] Authorization failed (timeout). Redirecting to root.`);
                return <Navigate to="/" replace />;
            }

            return (
                <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <div className="text-center">
                        <h2 className="text-xl font-bold">מזהה הרשאות...</h2>
                        <p className="text-sm text-muted-foreground">אנא המתן בזמן שאנו מאמתים את פרטי החשבון שלך.</p>
                    </div>
                </div>
            );
        }

        // Final Role MISMATCH (Authority has spoken) -> Redirect
        console.warn(`[RouteGuard] Access denied to ${location.pathname}. User role: ${roleState}`);

        let correctPath = '/';
        if (roleState === 'advisor') correctPath = '/advisor/dashboard';
        else if (roleState === 'bank') correctPath = '/bank/dashboard';
        else if (roleState === 'admin') correctPath = '/admin/dashboard';

        return <Navigate to={correctPath} replace />;
    }

    return null;
};

export default ProtectedRoute;

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[] | 'any-authenticated';
}

/**
 * Route guard for authenticated pages.
 * Routing depends ONLY on SessionState and RoleState.
 * NEVER inspects ProfileState or approval status.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { sessionState, roleState } = useAuth();
    const location = useLocation();

    // Log the current evaluation for debugging
    const allowedRolesStr = allowedRoles === 'any-authenticated' ? 'any-authenticated' : allowedRoles.join(',');
    console.log(`[RouteGuard] Path="${location.pathname}" Session="${sessionState}" Role="${roleState}" AllowedRoles=[${allowedRolesStr}]`);

    // 1. Unauthenticated -> redirect to login (RootRoute)
    if (sessionState === 'no-session') {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // 2. Session resolved -> check roles
    if (sessionState === 'has-session') {
        // Any authenticated user allowed
        if (allowedRoles === 'any-authenticated') {
            return <>{children}</>;
        }

        // Specific roles allowed
        if (roleState !== 'unknown' && allowedRoles.includes(roleState as UserRole)) {
            return <>{children}</>;
        }

        // Role mismatch or still unknown
        if (roleState !== 'unknown') {
            console.warn(`[RouteGuard] Access denied to ${location.pathname}. User role: ${roleState}`);
            // Redirect to their default dashboard instead of root to avoid redirect loops
            let correctPath = '/';
            if (roleState === 'advisor') correctPath = '/advisor/dashboard';
            else if (roleState === 'bank') correctPath = '/bank/dashboard';
            else if (roleState === 'admin') correctPath = '/admin/dashboard';

            // If they are already on the correct path but it's not allowed (shouldn't happen), go to root
            if (location.pathname === correctPath) return <Navigate to="/" replace />;

            return <Navigate to={correctPath} replace />;
        }

        // Role still resolving: show small spinner in-place
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
        );
    }

    // Still booting
    return null;
};

export default ProtectedRoute;

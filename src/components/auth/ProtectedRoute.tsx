import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    allowedRoles: UserRole[] | 'any';
}

/**
 * Route guard for authenticated pages.
 * NO generic redirects during loading states (prevents infinite loops).
 * Only enforces role checks based on the explicit `allowedRoles` prop.
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
    const { status, profile } = useAuth();
    const location = useLocation();

    // Log the current evaluation for debugging
    const allowedRolesStr = allowedRoles === 'any' ? 'any' : allowedRoles.join(',');
    console.log(`[ProtectedRoute] Path="${location.pathname}" Status="${status}" AllowedRoles=[${allowedRolesStr}] UserRole="${profile?.role ?? 'NONE'}"`);

    switch (status) {
        // ── 1. Initial Auth Loading (Session Unresolved) ───────────────────────
        case 'loading':
            return (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                        <p className="text-sm text-muted-foreground">טוען…</p>
                    </div>
                </div>
            );

        // ── 2. Unauthenticated ──────────────────────────────────────────────────
        case 'unauthenticated':
            return <Navigate to="/" state={{ from: location }} replace />;

        // ── 3. Authenticated but Profile Not Fully Evaluated ────────────────────
        case 'profile-loading':
        case 'profile-error':
        case 'no-profile':
        case 'pending-approval':
            // "any" means AUTH-ONLY: Do NOT wait for profile! Render immediately.
            if (allowedRoles === 'any') {
                return <>{children}</>;
            }

            // For role-specific routes, if we don't have a ready profile,
            // redirect to root where RootRoute handles stable Error/Pending screens.
            return <Navigate to="/" replace />;

        // ── 4. Fully Ready ──────────────────────────────────────────────────────
        case 'ready': {
            if (allowedRoles === 'any') {
                return <>{children}</>;
            }

            if (!profile || !allowedRoles.includes(profile.role)) {
                console.warn(`[ProtectedRoute] Access denied to ${location.pathname}. User role: ${profile?.role}`);
                // Wrong role → redirect to correct dashboard
                let correctPath = '/';
                if (profile?.role === 'advisor') correctPath = '/advisor/dashboard';
                else if (profile?.role === 'bank') correctPath = '/bank/dashboard';
                else if (profile?.role === 'admin') correctPath = '/admin/dashboard';

                return <Navigate to={correctPath} replace />;
            }

            // Authorized ✓
            return <>{children}</>;
        }

        default:
            return <Navigate to="/" replace />;
    }
};

export default ProtectedRoute;

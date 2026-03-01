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
        // ── Loading: show spinner, NO redirect ─────────────────────────────────
        case 'loading':
        case 'profile-loading':
            return (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                        <p className="text-sm text-muted-foreground">
                            {status === 'loading' ? 'טוען…' : 'טוען פרופיל…'}
                        </p>
                    </div>
                </div>
            );

        // ── Not authenticated / No Profile / Unapproved: send to root ──────────
        case 'unauthenticated':
        case 'no-profile':
        case 'pending-approval':
            // RootRoute handles displaying the correct UI for these edge cases.
            // We just redirect them back to root.
            return <Navigate to="/" state={{ from: location }} replace />;

        // ── Ready: check explicit roles ────────────────────────────────────────
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

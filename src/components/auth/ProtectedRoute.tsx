import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    role?: UserRole;
}

/**
 * Route guard for authenticated pages.
 * Uses `status` enum — NO ambiguous loading/profile states.
 * NO redirects to dashboards here — that's RootRoute's job.
 * This only guards: is the user allowed to see THIS page?
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, role }) => {
    const { status, profile } = useAuth();
    const location = useLocation();

    console.log(`[ProtectedRoute] status=${status} requiredRole=${role} profileRole=${profile?.role}`);

    switch (status) {
        // ── Loading: show spinner, NO redirect ─────────────────────────────────
        case 'loading':
        case 'profile-loading':
            return (
                <div className="min-h-screen flex items-center justify-center bg-background">
                    <div className="flex flex-col items-center gap-3">
                        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                        <p className="text-sm text-muted-foreground">טוען…</p>
                    </div>
                </div>
            );

        // ── Not authenticated: send to root ────────────────────────────────────
        case 'unauthenticated':
            return <Navigate to="/" state={{ from: location }} replace />;

        // ── Account exists but not fully set up: send to root (shows status) ───
        case 'no-profile':
        case 'pending-approval':
            return <Navigate to="/" replace />;

        // ── Ready: check role ──────────────────────────────────────────────────
        case 'ready': {
            if (role && profile && profile.role !== role) {
                // Wrong role → redirect to correct dashboard
                let correctPath = '/';
                if (profile.role === 'advisor') correctPath = '/advisor/dashboard';
                else if (profile.role === 'bank') correctPath = '/bank/dashboard';
                else if (profile.role === 'admin') correctPath = '/admin/dashboard';
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

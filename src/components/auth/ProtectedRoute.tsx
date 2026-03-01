import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    role?: UserRole;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, role }) => {
    const { user, profile, loading, profileLoading } = useAuth();
    const location = useLocation();

    // ── 1. Session still resolving ─────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">טוען…</p>
                </div>
            </div>
        );
    }

    // ── 2. Not authenticated → back to root ────────────────────────────────────
    if (!user) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // ── 3. Profile still loading → show spinner (not redirect) ─────────────────
    if (profileLoading && !profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">טוען פרופיל…</p>
                </div>
            </div>
        );
    }

    // ── 4. No profile (fetch finished but null) → back to root ─────────────────
    if (!profile) {
        return <Navigate to="/" replace />;
    }

    // ── 5. Role mismatch → redirect to correct dashboard ───────────────────────
    if (role && profile.role !== role) {
        let correctPath = '/';
        if (profile.role === 'advisor') correctPath = '/advisor/dashboard';
        else if (profile.role === 'bank') correctPath = '/bank/dashboard';
        else if (profile.role === 'admin') correctPath = '/admin/dashboard';

        return <Navigate to={correctPath} replace />;
    }

    // ── 6. Authorised ──────────────────────────────────────────────────────────
    return <>{children}</>;
};

export default ProtectedRoute;

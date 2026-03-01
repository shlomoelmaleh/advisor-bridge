import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, UserRole } from '@/hooks/useAuth';

interface ProtectedRouteProps {
    children: React.ReactNode;
    role?: UserRole;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, role }) => {
    const { user, profile, loading } = useAuth();
    const location = useLocation();

    // ── 1. Still resolving session ─────────────────────────────────────────────
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-3">
                    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground">Loading…</p>
                </div>
            </div>
        );
    }

    // ── 2. Not authenticated ───────────────────────────────────────────────────
    if (!user) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // ── 3. Role mismatch (profile may still be loading briefly) ───────────────
    if (role && profile && profile.role !== role) {
        let correctPath = '/';
        if (profile.role === 'advisor') correctPath = '/advisor/dashboard';
        else if (profile.role === 'bank') correctPath = '/bank/dashboard';
        else if (profile.role === 'admin') correctPath = '/admin/dashboard';

        return <Navigate to={correctPath} replace />;
    }

    // ── 4. Authorised ─────────────────────────────────────────────────────────
    return <>{children}</>;
};

export default ProtectedRoute;

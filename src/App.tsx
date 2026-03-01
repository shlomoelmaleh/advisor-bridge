
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import AuthPage from "./pages/AuthPage";
import AdvisorDashboard from './pages/AdvisorDashboard';
import BankDashboard from './pages/BankDashboard';
import CaseSubmit from './pages/CaseSubmit';
import MatchesPage from './pages/Matches';
import Chat from './pages/Chat';
import AdminDashboard from './pages/AdminDashboard';
import NotFound from "./pages/NotFound";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";

const queryClient = new QueryClient();

// Set Hebrew language and RTL direction
document.documentElement.dir = 'rtl';
document.documentElement.lang = 'he';

// Layout wrapper for authenticated pages that need Navbar + Footer
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="min-h-screen flex flex-col">
    <Navbar />
    <main className="flex-grow container py-8">{children}</main>
    <Footer />
  </div>
);

// ─── ROOT ROUTE ───────────────────────────────────────────────────────────────
// This is the SINGLE source of truth for all auth-based routing decisions.
// No other component should navigate based on auth state.
const RootRoute = () => {
  const { user, profile, loading, profileLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  // Safety timeout: if stuck on profile loading for >5 seconds, show error
  const [timedOut, setTimedOut] = React.useState(false);
  React.useEffect(() => {
    if (!user || profile || !profileLoading) {
      setTimedOut(false);
      return;
    }
    const t = setTimeout(() => setTimedOut(true), 5000);
    return () => clearTimeout(t);
  }, [user, profile, profileLoading]);

  // ── STATE 1: Initial auth loading (session not yet resolved) ──────────────
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

  // ── STATE 2: No user → show login/register form ───────────────────────────
  if (!user) {
    return <AuthPage defaultTab={tab} />;
  }

  // ── STATE 3: User exists, profile loaded → route by role ──────────────────
  if (profile) {
    // 3a: User not approved → show approval waiting screen
    if (profile.is_approved === false) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
          <div className="text-6xl">⏳</div>
          <h2 className="text-2xl font-bold">ממתין לאישור מנהל</h2>
          <p className="text-muted-foreground text-center max-w-md">
            החשבון שלך נוצר בהצלחה. מנהל המערכת יאשר אותך בהקדם.
          </p>
        </div>
      );
    }

    // 3b: Approved → redirect to dashboard
    if (profile.role === 'advisor') return <Navigate to="/advisor/dashboard" replace />;
    if (profile.role === 'bank') return <Navigate to="/bank/dashboard" replace />;
    if (profile.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  }

  // ── STATE 4: User exists but profile not yet loaded ───────────────────────
  if (profileLoading && !timedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        <p className="text-muted-foreground text-sm">טוען פרופיל…</p>
      </div>
    );
  }

  // ── STATE 5: Safety fallback — profile never loaded ───────────────────────
  // Profile fetch finished or timed out, but profile is still null.
  // This means either: the profile doesn't exist yet, or something failed.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="text-6xl">⏳</div>
      <h2 className="text-2xl font-bold">ממתין להקמת חשבון</h2>
      <p className="text-muted-foreground text-center max-w-md">
        החשבון שלך נוצר. הפרופיל בתהליך הקמה — נסה לרענן בעוד מספר שניות.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-4 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
      >
        נסה שוב
      </button>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/?tab=register" replace />} />

            {/* Advisor-only routes */}
            <Route
              path="/advisor/dashboard"
              element={
                <ProtectedRoute role="advisor">
                  <AdvisorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/advisor/submit-case"
              element={
                <ProtectedRoute role="advisor">
                  <CaseSubmit />
                </ProtectedRoute>
              }
            />

            {/* Bank-only routes */}
            <Route
              path="/bank/dashboard"
              element={
                <ProtectedRoute role="bank">
                  <BankDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin-only routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute role="admin">
                  <AppLayout>
                    <AdminDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            {/* Shared authenticated routes */}
            <Route
              path="/matches"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <MatchesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:matchId"
              element={
                <ProtectedRoute>
                  <AppLayout>
                    <Chat />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

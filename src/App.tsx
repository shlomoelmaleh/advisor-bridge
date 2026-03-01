
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
// SINGLE source of truth for auth-based routing. No other component redirects
// based on auth state. Uses the `status` enum from useAuth — no ambiguous states.
const RootRoute = () => {
  const { status, profile } = useAuth();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  console.log(`[RootRoute] status=${status}`);

  switch (status) {
    // ── Loading states: show spinner, NO redirects ──────────────────────────
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

    // ── Anonymous: show login form ──────────────────────────────────────────
    case 'unauthenticated':
      return <AuthPage defaultTab={tab} />;

    // ── User exists but no profile record ───────────────────────────────────
    case 'no-profile':
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

    // ── User exists + profile, but not yet approved ─────────────────────────
    case 'pending-approval':
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
          <div className="text-6xl">⏳</div>
          <h2 className="text-2xl font-bold">ממתין לאישור מנהל</h2>
          <p className="text-muted-foreground text-center max-w-md">
            החשבון שלך נוצר בהצלחה. מנהל המערכת יאשר אותך בהקדם.
          </p>
        </div>
      );

    // ── Fully ready: redirect to dashboard ──────────────────────────────────
    case 'ready':
      if (profile?.role === 'advisor') return <Navigate to="/advisor/dashboard" replace />;
      if (profile?.role === 'bank') return <Navigate to="/bank/dashboard" replace />;
      if (profile?.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
      // Fallback (should never happen)
      return <AuthPage defaultTab={tab} />;

    default:
      return <AuthPage defaultTab={tab} />;
  }
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/?tab=register" replace />} />

            {/* Advisor-only routes */}
            <Route
              path="/advisor/dashboard"
              element={
                <ProtectedRoute allowedRoles={['advisor']}>
                  <AdvisorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/advisor/submit-case"
              element={
                <ProtectedRoute allowedRoles={['advisor']}>
                  <CaseSubmit />
                </ProtectedRoute>
              }
            />

            {/* Bank-only routes */}
            <Route
              path="/bank/dashboard"
              element={
                <ProtectedRoute allowedRoles={['bank']}>
                  <BankDashboard />
                </ProtectedRoute>
              }
            />

            {/* Admin-only routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']}>
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
                <ProtectedRoute allowedRoles="any">
                  <AppLayout>
                    <MatchesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:matchId"
              element={
                <ProtectedRoute allowedRoles="any">
                  <AppLayout>
                    <Chat />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

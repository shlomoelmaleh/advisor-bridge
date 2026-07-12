
import React, { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import AuthPage from "./pages/AuthPage";
import AppLayout from "@/components/layout/AppLayout";

// Role-segmented pages are lazy-loaded so each user only downloads their slice
// of the app (advisor/bank/admin) instead of one 800KB bundle.
const AdvisorDashboard = lazy(() => import('./pages/AdvisorDashboard'));
const BankDashboard = lazy(() => import('./pages/BankDashboard'));
const CaseSubmit = lazy(() => import('./pages/CaseSubmit'));
const MatchesPage = lazy(() => import('./pages/Matches'));
const Chat = lazy(() => import('./pages/Chat'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const BankAppetite = lazy(() => import('./pages/BankAppetite'));
const BankMarket = lazy(() => import('./pages/BankMarket'));
const Conversations = lazy(() => import('./pages/Conversations'));
const AdvisorMarket = lazy(() => import('./pages/AdvisorMarket'));
const NotFound = lazy(() => import('./pages/NotFound'));

const PageLoader = () => (
  <div dir="rtl" className="min-h-screen flex items-center justify-center">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
  </div>
);

const queryClient = new QueryClient();

// Set Hebrew language and RTL direction
document.documentElement.dir = 'rtl';
document.documentElement.lang = 'he';

// ─── ROOT ROUTE ───────────────────────────────────────────────────────────────
// Renders the auth/landing page. Handles both no-session (form) and 
// has-session (shows "already signed in" with Switch Account).
// Booting state is handled by AuthProvider, so we never see it here.
const RootRoute = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'register' ? 'register' : 'login';
  return <AuthPage defaultTab={tab} />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="/register" element={<Navigate to="/?tab=register" replace />} />

            {/* Advisor-only routes */}
            <Route
              path="/advisor/dashboard"
              element={
                <ProtectedRoute allowedRoles={['advisor']} requireFinalRole>
                  <AdvisorDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/advisor/submit-case"
              element={
                <ProtectedRoute allowedRoles={['advisor']} requireFinalRole>
                  <CaseSubmit />
                </ProtectedRoute>
              }
            />
            <Route
              path="/advisor/market"
              element={
                <ProtectedRoute allowedRoles={['advisor']} requireFinalRole>
                  <AdvisorMarket />
                </ProtectedRoute>
              }
            />

            {/* Bank-only routes */}
            <Route
              path="/bank/dashboard"
              element={
                <ProtectedRoute allowedRoles={['bank']} requireFinalRole>
                  <BankDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bank/market"
              element={
                <ProtectedRoute allowedRoles={['bank']} requireFinalRole>
                  <AppLayout>
                    <BankMarket />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bank/appetite"
              element={
                <ProtectedRoute allowedRoles={['bank']} requireFinalRole>
                  <BankAppetite />
                </ProtectedRoute>
              }
            />
            {/* Removed /bank/chat */}

            {/* Admin-only routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute allowedRoles={['admin']} requireFinalRole>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Shared authenticated routes */}
            <Route
              path="/conversations"
              element={
                <ProtectedRoute allowedRoles="any-authenticated">
                  <AppLayout>
                    <Conversations />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/matches"
              element={
                <ProtectedRoute allowedRoles="any-authenticated">
                  <AppLayout>
                    <MatchesPage />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/chat/:matchId"
              element={
                <ProtectedRoute allowedRoles="any-authenticated">
                  <AppLayout>
                    <Chat />
                  </AppLayout>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

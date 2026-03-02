
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
import BankAppetite from './pages/BankAppetite';
import BankChat from './pages/BankChat';
import NotFound from "./pages/NotFound";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import AppLayout from "@/components/layout/AppLayout";

const queryClient = new QueryClient();

// Set Hebrew language and RTL direction
document.documentElement.dir = 'rtl';
document.documentElement.lang = 'he';

// ─── ROOT ROUTE ───────────────────────────────────────────────────────────────
// SINGLE source of truth for auth-based entry. 
// It blocks only during initial session resolution (booting).
const RootRoute = () => {
  const { sessionState, roleState } = useAuth();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  console.log(`[RootRoute] sessionState=${sessionState} roleState=${roleState}`);

  if (sessionState === 'booting') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (sessionState === 'no-session') {
    return <AuthPage defaultTab={tab} />;
  }

  // has-session: redirect to default dashboard based on role
  if (roleState === 'advisor') return <Navigate to="/advisor/dashboard" replace />;
  if (roleState === 'bank') return <Navigate to="/bank/dashboard" replace />;
  if (roleState === 'admin') return <Navigate to="/admin/dashboard" replace />;

  // role unknown or resolving
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      <p className="text-muted-foreground">מזהה הרשאות…</p>
    </div>
  );
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
            <Route
              path="/bank/appetite"
              element={
                <ProtectedRoute allowedRoles={['bank']}>
                  <AppLayout>
                    <div className="p-4">טוען הגדרות תיאבון…</div>
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/bank/chat"
              element={
                <ProtectedRoute allowedRoles={['bank']}>
                  <AppLayout>
                    <div className="p-4">טוען שיחות…</div>
                  </AppLayout>
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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

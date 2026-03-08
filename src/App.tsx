
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import AuthPage from "./pages/AuthPage";
import AdvisorDashboard from './pages/AdvisorDashboard';
import BankDashboard from './pages/BankDashboard';
import CaseSubmit from './pages/CaseSubmit';
import MatchesPage from './pages/Matches';
import Chat from './pages/Chat';
import AdminDashboard from './pages/AdminDashboard';
import BankAppetite from './pages/BankAppetite';
import BankMarket from './pages/BankMarket';
import Conversations from './pages/Conversations';
import AdvisorMarket from './pages/AdvisorMarket';
import NotFound from "./pages/NotFound";
import Navbar from "@/components/common/Navbar";
import Footer from "@/components/common/Footer";
import AppLayout from "@/components/layout/AppLayout";

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
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;

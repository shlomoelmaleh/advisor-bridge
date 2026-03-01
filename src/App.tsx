
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

// Root route: if logged in redirect to dashboard, otherwise show auth form
const RootRoute = () => {
  const { user, profile, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'register' ? 'register' : 'login';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (user && profile) {
    if (profile.role === 'advisor') return <Navigate to="/advisor/dashboard" replace />;
    if (profile.role === 'bank') return <Navigate to="/bank/dashboard" replace />;
    if (profile.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
  }

  return <AuthPage defaultTab={tab} />;
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

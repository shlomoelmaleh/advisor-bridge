
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "@/hooks/useAuth";
import { useAuth } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AdvisorDashboard from "./pages/AdvisorDashboard";
import BankDashboard from "./pages/BankDashboard";
import CaseSubmit from "./pages/CaseSubmit";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Set English language and LTR direction
document.documentElement.dir = 'ltr';
document.documentElement.lang = 'en';

// Smart root redirect: send authenticated users to their dashboard
const RootRedirect = () => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role === 'advisor') return <Navigate to="/advisor/dashboard" replace />;
  if (profile?.role === 'bank') return <Navigate to="/bank/dashboard" replace />;

  // Authenticated but profile not yet loaded — show the landing page
  return <Index />;
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
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

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

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

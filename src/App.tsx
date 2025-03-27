
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/advisor/dashboard" element={<AdvisorDashboard />} />
          <Route path="/advisor/submit-case" element={<CaseSubmit />} />
          <Route path="/bank/dashboard" element={<BankDashboard />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

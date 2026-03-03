import React, { useState, useEffect } from 'react';
import AuthForm from '@/components/auth/AuthForm';
import { useAuth, getHomePathByRole } from '@/hooks/useAuth';
import { SESSION_REDIRECT_KEY } from '@/components/auth/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';

interface AuthPageProps {
  defaultTab?: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ defaultTab = 'login' }) => {
  const { sessionState, roleState, roleFinal, user, signOut } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);
  const navigate = useNavigate();

  // ── Auto-Redirect once role is final for navigation ───────────────────────
  // advisor/bank: roleFinal as soon as jwt-optimistic is set
  // admin: roleFinal only after DB/allowlist confirms
  useEffect(() => {
    if (sessionState === 'has-session' && roleFinal && !isSwitching) {
      // Consume the stored post-login redirect if valid
      const stored = sessionStorage.getItem(SESSION_REDIRECT_KEY);
      sessionStorage.removeItem(SESSION_REDIRECT_KEY);

      // Only use stored path if it's a proper path (not root)
      const dest = (stored && stored !== '/') ? stored : getHomePathByRole(roleState);
      console.log(`[Nav] post-login redirect → ${dest} (role=${roleState} roleFinal=${roleFinal})`);
      navigate(dest, { replace: true });
    }
  }, [sessionState, roleState, roleFinal, navigate, isSwitching]);

  // ── Switch Account ────────────────────────────────────────────────────────
  const handleSwitchAccount = async () => {
    setIsSwitching(true);
    await signOut();
    setIsSwitching(false);
  };

  // ── Session exists ────────────────────────────────────────────────────────
  if (sessionState === 'has-session' && !isSwitching) {
    // Ready to navigate → brief spinner (useEffect fires immediately)
    if (roleFinal) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
          <p className="text-muted-foreground animate-pulse">מעביר אותך לדאשבורד...</p>
        </div>
      );
    }

    // Role not yet final (admin waiting for DB, or very briefly for advisor/bank)
    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 bg-background" dir="rtl">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="w-16 h-16 mx-auto bg-primary rounded-2xl flex items-center justify-center shadow-lg mb-6">
            <span className="text-primary-foreground font-bold text-2xl">MB</span>
          </div>

          <p className="text-muted-foreground mb-2">
            מחובר כ-<strong>{user?.email}</strong>
          </p>

          <div className="bg-muted/50 p-6 rounded-xl mb-6 flex flex-col items-center gap-3">
            <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-medium">מזהה הרשאות ותפקיד...</p>
          </div>

          <Button size="lg" variant="outline" className="w-full gap-2" onClick={handleSwitchAccount}>
            <LogOut className="h-4 w-4" />
            התנתק / החלף חשבון
          </Button>
        </div>
      </div>
    );
  }

  // ── No session (or switching) → login / register form ────────────────────
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">MB</span>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-foreground text-right" dir="rtl">
            MortgageBridge
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-right" dir="rtl">
            פלטפורמת התיווך למשכנתאות
          </p>
        </div>
        <AuthForm defaultTab={defaultTab} />
      </div>
    </div>
  );
};

export default AuthPage;

import React, { useState, useEffect } from 'react';
import AuthForm from '@/components/auth/AuthForm';
import { useAuth, UserRole } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LogOut } from 'lucide-react';

interface AuthPageProps {
  defaultTab?: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ defaultTab = 'login' }) => {
  const { sessionState, roleState, user, signOut, profileState } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // ── Auto-Redirect Logic ──────────────────────────────────────────────────
  useEffect(() => {
    if (sessionState === 'has-session' && roleState !== 'unknown' && !isSwitching) {
      const dashboardPath =
        roleState === 'admin' ? '/admin/dashboard' :
          roleState === 'bank' ? '/bank/dashboard' :
            '/advisor/dashboard';

      console.log(`[AuthPage] Auto-redirecting to ${dashboardPath}`);
      navigate(dashboardPath, { replace: true });
    }
  }, [sessionState, roleState, navigate, isSwitching]);

  // ── Manual Switch Account ────────────────────────────────────────────────
  const handleSwitchAccount = async () => {
    setIsSwitching(true);
    await signOut();
    // After signOut, sessionState will become no-session and the login form will show
  };

  // ── Case 1: Session exists + Role known → Auto-redirecting (should be fast) ──────
  if (sessionState === 'has-session' && roleState !== 'unknown' && !isSwitching) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background">
        <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
        <p className="text-muted-foreground animate-pulse">מעביר אותך לדאשבורד...</p>
      </div>
    );
  }

  // ── Case 2: Session exists but Role unknown → Resolving state ──────────────────
  if (sessionState === 'has-session' && !isSwitching) {
    const roleName =
      roleState === 'admin' ? 'מנהל' :
        roleState === 'bank' ? 'בנקאי' :
          roleState === 'advisor' ? 'יועץ' :
            'משתמש';

    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background text-right" dir="rtl">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-2xl">MB</span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">אתה כבר מחובר!</h1>
          <p className="text-muted-foreground mb-4">
            מחובר כ-<strong>{user?.email}</strong>
          </p>

          <div className="bg-muted/50 p-6 rounded-xl mb-6 flex flex-col items-center gap-4">
            {roleState === 'unknown' || profileState === 'loading' ? (
              <>
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <p className="text-sm font-medium">מזהה הרשאות ותפקיד...</p>
              </>
            ) : (
              <p className="text-sm font-medium">תפקיד מזוהה: {roleName}</p>
            )}
          </div>

          <Button
            size="lg"
            variant="outline"
            className="w-full px-8 gap-2"
            onClick={handleSwitchAccount}
          >
            <LogOut className="h-4 w-4" />
            התנתק / החלף חשבון
          </Button>
        </div>
      </div>
    );
  }

  // ── Case 3: No session → Show Login/Register form ────────────────────────
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

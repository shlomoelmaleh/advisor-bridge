import React, { useState } from 'react';
import AuthForm from '@/components/auth/AuthForm';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';

interface AuthPageProps {
  defaultTab?: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ defaultTab = 'login' }) => {
  const { sessionState, roleState, user, signOut } = useAuth();
  const [isSwitching, setIsSwitching] = useState(false);

  // ── Already signed in ──────────────────────────────────────────────────────
  if (sessionState === 'has-session' && !isSwitching) {
    const dashboardPath =
      roleState === 'admin' ? '/admin/dashboard' :
        roleState === 'bank' ? '/bank/dashboard' :
          '/advisor/dashboard';
    const roleName =
      roleState === 'admin' ? 'מנהל' :
        roleState === 'bank' ? 'בנקאי' :
          'יועץ';

    const handleSwitchAccount = async () => {
      setIsSwitching(true);
      await signOut();
      // After signOut, sessionState will become no-session and the form below will render
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background text-right" dir="rtl">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-2xl">MB</span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-2">אתה כבר מחובר!</h1>
          <p className="text-muted-foreground mb-2">
            מחובר כ-<strong>{user?.email}</strong> (תפקיד: {roleName})
          </p>
          <div className="flex flex-col gap-3 mt-6">
            <Link to={dashboardPath}>
              <Button size="lg" className="w-full px-8 font-bold">
                המשך ללוח הבקרה
              </Button>
            </Link>
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
      </div>
    );
  }

  // ── Login / Register form ──────────────────────────────────────────────────
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

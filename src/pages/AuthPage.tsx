import React from 'react';
import AuthForm from '@/components/auth/AuthForm';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface AuthPageProps {
  defaultTab?: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ defaultTab = 'login' }) => {
  const { sessionState, roleState } = useAuth();

  // Single source of truth for "logged in" state on the lander
  if (sessionState === 'has-session') {
    const dashboardPath = roleState === 'admin' ? '/admin/dashboard' : roleState === 'bank' ? '/bank/dashboard' : '/advisor/dashboard';
    const dashboardTitle = roleState === 'admin' ? 'לוח הבקרה למנהל' : 'לוח הבקרה האישי שלי';

    return (
      <div className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background text-right" dir="rtl">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <div className="inline-flex items-center justify-center mb-8">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-primary-foreground font-bold text-2xl">MB</span>
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-foreground mb-4">אתה כבר מחובר!</h1>
          <p className="text-muted-foreground mb-8">
            נראה שיש לך סשן פעיל במערכת בתפקיד {roleState === 'admin' ? 'מנהל' : roleState === 'bank' ? 'בנקאי' : 'יועץ'}.
          </p>
          <Link to={dashboardPath}>
            <Button size="lg" className="px-8 font-bold">
              עבור ל{dashboardTitle}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

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

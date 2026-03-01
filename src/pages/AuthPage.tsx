import React from 'react';
import AuthForm from '@/components/auth/AuthForm';

interface AuthPageProps {
  defaultTab?: 'login' | 'register';
}

const AuthPage: React.FC<AuthPageProps> = ({ defaultTab = 'login' }) => {
  // No redirect logic here — RootRoute is the single source of truth for redirects
  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-xl">MB</span>
            </div>
          </div>
          <h1 className="mt-6 text-3xl font-extrabold text-foreground">
            MortgageBridge
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            פלטפורמת התיווך למשכנתאות
          </p>
        </div>

        <AuthForm defaultTab={defaultTab} />
      </div>
    </div>
  );
};

export default AuthPage;


import React, { useEffect } from 'react';
import AuthForm from '@/components/auth/AuthForm';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

const Login = () => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) return;

    // If user is logged in but profile not yet fetched, wait a moment
    if (!profile) {
      const timer = setTimeout(() => {
        // Force navigate to root, RootRedirect will handle the rest
        navigate('/', { replace: true });
      }, 1500);
      return () => clearTimeout(timer);
    }

    if (profile.role === 'advisor') navigate('/advisor/dashboard', { replace: true });
    else if (profile.role === 'bank') navigate('/bank/dashboard', { replace: true });
    else if (profile.role === 'admin') navigate('/admin/dashboard', { replace: true });
    else navigate('/', { replace: true });
  }, [user, profile, loading, navigate]);

  return (
    <div className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center justify-center">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-xl">MB</span>
            </div>
          </Link>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Log in to your account
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Or{' '}
            <Link to="/register" className="font-medium text-primary hover:underline">
              create a new account
            </Link>
          </p>
        </div>

        <div className="mt-8">
          <AuthForm defaultTab="login" />
        </div>
      </div>
    </div>
  );
};

export default Login;

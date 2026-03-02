import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Menu,
  User,
  LogOut,
  Home,
  AlertCircle,
  Clock,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';

const Navbar = () => {
  const navigate = useNavigate();
  const { user, profile, roleState, profileState, sessionState, signOut, reFetchProfile } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const getDashboardPath = () => {
    if (roleState === 'advisor') return '/advisor/dashboard';
    if (roleState === 'bank') return '/bank/dashboard';
    if (roleState === 'admin') return '/admin/dashboard';
    return '/';
  };

  const renderStatusBanner = () => {
    if (sessionState !== 'has-session') return null;

    if (profileState === 'missing') {
      return (
        <div className="bg-amber-50 border-b border-amber-200 py-2 px-4 flex items-center justify-center gap-2 text-amber-800 text-sm font-medium animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-4 w-4" />
          <span>הפרופיל שלך טרם הוקם. פונקציות מסוימות עשויות להיות מוגבלות.</span>
          <button onClick={() => reFetchProfile()} className="underline ml-2 hover:text-amber-900">בדוק עכשיו</button>
        </div>
      );
    }

    if (profileState === 'pending') {
      return (
        <div className="bg-blue-50 border-b border-blue-200 py-2 px-4 flex items-center justify-center gap-2 text-blue-800 text-sm font-medium animate-in fade-in slide-in-from-top-4">
          <Clock className="h-4 w-4" />
          <span>החשבון שלך ממתין לאישור מנהל. תוכל לצפות בנתונים אך לא לבצע פעולות חדשות.</span>
          <button onClick={() => reFetchProfile()} className="underline ml-2 hover:text-blue-900">רענן סטטוס</button>
        </div>
      );
    }

    if (profileState === 'error') {
      return (
        <div className="bg-red-50 border-b border-red-200 py-2 px-4 flex items-center justify-center gap-2 text-red-800 text-sm font-medium animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-4 w-4" />
          <span>שגיאה בטעינת נתוני הפרופיל.</span>
          <button onClick={() => reFetchProfile()} className="underline ml-2 hover:text-red-900">נסה שוב</button>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {renderStatusBanner()}
      <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-right" dir="rtl">
        <div className="container flex h-16 items-center px-4 sm:px-8">
          <Link to="/" className="flex items-center space-x-2 space-x-reverse ml-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MB</span>
            </div>
            <span className="font-semibold text-lg hidden sm:inline-block">MortgageBridge</span>
          </Link>

          {/* Mobile menu button */}
          <button
            className="mr-auto md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="h-6 w-6" />
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-4 md:space-x-reverse md:mr-auto">
            {sessionState === 'has-session' ? (
              <>
                <Link
                  to={getDashboardPath()}
                  className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                >
                  {roleState === 'admin' ? 'לוח בקרה' : 'דאשבורד'}
                </Link>

                {roleState !== 'admin' && (
                  <Link
                    to="/matches"
                    className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                  >
                    התאמות
                  </Link>
                )}

                {roleState === 'advisor' && (
                  <Link
                    to="/advisor/submit-case"
                    className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                  >
                    הגש תיק
                  </Link>
                )}

                {roleState === 'bank' && (
                  <>
                    <Link
                      to="/bank/appetite"
                      className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                    >
                      תיאבון
                    </Link>
                    <Link
                      to="/bank/chat"
                      className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                    >
                      שיחות
                    </Link>
                  </>
                )}

                <div className="border-r h-6 mx-2 hidden md:block" />

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative flex items-center gap-2 rounded-full px-2">
                      <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center">
                        <User className="h-5 w-5" />
                      </div>
                      <span className="text-sm font-medium hidden sm:inline-block">
                        {profile?.full_name ?? user?.email}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-right">
                    <DropdownMenuLabel>{profile?.full_name ?? 'משתמש'}</DropdownMenuLabel>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      {user?.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="justify-end">
                      <span>התנתקות</span>
                      <LogOut className="ml-2 h-4 w-4" />
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link
                  to="/"
                  className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                >
                  התחבר
                </Link>
                <Link to="/?tab=register">
                  <Button>הרשם</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="absolute top-16 left-0 right-0 p-4 bg-background border-b shadow-lg md:hidden animate-in slide-in-from-top-4 duration-200">
              <nav className="flex flex-col space-y-3 text-right">
                {sessionState === 'has-session' ? (
                  <>
                    <Link
                      to={getDashboardPath()}
                      className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {roleState === 'admin' ? 'לוח בקרה' : 'דאשבורד'}
                      <Home className="ml-2 h-4 w-4" />
                    </Link>

                    {roleState !== 'admin' && (
                      <Link
                        to="/matches"
                        className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        התאמות
                      </Link>
                    )}

                    {roleState === 'advisor' && (
                      <Link
                        to="/advisor/submit-case"
                        className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        הגש תיק
                      </Link>
                    )}

                    {roleState === 'bank' && (
                      <>
                        <Link
                          to="/bank/appetite"
                          className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          תיאבון
                        </Link>
                        <Link
                          to="/bank/chat"
                          className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          שיחות
                        </Link>
                      </>
                    )}

                    <button
                      onClick={() => {
                        handleLogout();
                        setIsMobileMenuOpen(false);
                      }}
                      className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                    >
                      התנתקות
                      <LogOut className="ml-2 h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/"
                      className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      התחבר
                    </Link>
                    <Link
                      to="/?tab=register"
                      className="flex items-center justify-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      הרשם
                    </Link>
                  </>
                )}
              </nav>
            </div>
          )}
        </div>
      </header>
    </>
  );
};

export default Navbar;

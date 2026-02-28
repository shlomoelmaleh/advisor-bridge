
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Menu,
  User,
  LogOut,
  Home,
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
  const { user, profile, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center px-4 sm:px-8">
        <Link to="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">MB</span>
          </div>
          <span className="font-semibold text-lg hidden sm:inline-block">MortgageBridge</span>
        </Link>

        {/* Mobile menu button */}
        <button
          className="ml-auto md:hidden"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* Desktop Navigation */}
        <div className="hidden md:flex md:items-center md:space-x-4 md:ml-auto">
          {user ? (
            <>
              <Link
                to={profile?.role === 'advisor' ? '/advisor/dashboard' : profile?.role === 'bank' ? '/bank/dashboard' : '/admin/dashboard'}
                className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
              >
                {profile?.role === 'admin' ? 'לוח בקרה' : 'Dashboard'}
              </Link>

              {profile?.role !== 'admin' && (
                <Link
                  to="/matches"
                  className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                >
                  התאמות
                </Link>
              )}

              {profile?.role === 'advisor' && (
                <Link
                  to="/advisor/submit-case"
                  className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                >
                  Submit Case
                </Link>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <User className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>{profile?.full_name ?? 'User'}</DropdownMenuLabel>
                  <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
              >
                Login
              </Link>
              <Link to="/register">
                <Button>Register</Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="absolute top-16 left-0 right-0 p-4 bg-background border-b shadow-lg md:hidden animate-slide-in">
            <nav className="flex flex-col space-y-3">
              {user ? (
                <>
                  <Link
                    to={profile?.role === 'advisor' ? '/advisor/dashboard' : profile?.role === 'bank' ? '/bank/dashboard' : '/admin/dashboard'}
                    className="flex items-center px-4 py-2 text-foreground rounded-md hover:bg-accent"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    {profile?.role === 'admin' ? 'לוח בקרה' : 'Dashboard'}
                  </Link>

                  {profile?.role !== 'admin' && (
                    <Link
                      to="/matches"
                      className="flex items-center px-4 py-2 text-foreground rounded-md hover:bg-accent"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      התאמות
                    </Link>
                  )}

                  {profile?.role === 'advisor' && (
                    <Link
                      to="/advisor/submit-case"
                      className="flex items-center px-4 py-2 text-foreground rounded-md hover:bg-accent"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      Submit Case
                    </Link>
                  )}

                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="flex items-center px-4 py-2 text-foreground rounded-md hover:bg-accent"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="flex items-center px-4 py-2 text-foreground rounded-md hover:bg-accent"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Register
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;

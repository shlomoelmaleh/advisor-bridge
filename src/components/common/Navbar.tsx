import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, User, LogOut, Home, AlertCircle, Clock, Settings } from "lucide-react";
import ProfileUpdateDialog from "@/components/auth/ProfileUpdateDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const Navbar = () => {
  const navigate = useNavigate();
  const { user, profile, roleState, profileState, sessionState, signOut, reFetchProfile } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isProfileUpdateOpen, setIsProfileUpdateOpen] = React.useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [adminPendingCount, setAdminPendingCount] = useState(0);
  const [newMatchesCount, setNewMatchesCount] = useState(0);
  const [newBankMatchesCount, setNewBankMatchesCount] = useState(0);
  const [approvedAppetiteCount, setApprovedAppetiteCount] = useState(0);
  const [lastSeenAppetiteTime, setLastSeenAppetiteTime] = useState<string>(
    () => localStorage.getItem("last_seen_appetite") ?? new Date(0).toISOString(),
  );

  useEffect(() => {
    const fetchUnread = async () => {
      if (!user?.id) return;

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .is("read_at", null);
      setTotalUnread(count ?? 0);
    };

    if (!user?.id || roleState === "unknown") return;
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [user?.id, roleState]);

  useEffect(() => {
    const fetchAdminPending = async () => {
      if (roleState !== "admin") return;

      const [{ count: pendingUsers }, { count: pendingCases }, { count: pendingAppetites }] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }).eq("is_approved", false),
        supabase.from("cases").select("*", { count: "exact", head: true }).eq("is_approved", false),
        supabase.from("branch_appetites").select("*", { count: "exact", head: true }).eq("is_approved", false),
      ]);

      setAdminPendingCount((pendingUsers ?? 0) + (pendingCases ?? 0) + (pendingAppetites ?? 0));
    };

    if (roleState !== "admin") return;
    fetchAdminPending();
    const interval = setInterval(fetchAdminPending, 30000);
    return () => clearInterval(interval);
  }, [roleState]);

  useEffect(() => {
    const fetchNewMatches = async () => {
      if (roleState !== "advisor" || !user?.id) return;

      const { data: advisorCases } = await supabase.from("cases").select("id").eq("advisor_id", user.id);
      const caseIds = (advisorCases ?? []).map((c) => c.id);
      if (caseIds.length === 0) {
        setNewMatchesCount(0);
        return;
      }

      const { count } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .in("case_id", caseIds)
        .eq("advisor_status", "pending")
        .eq("banker_status", "interested");

      setNewMatchesCount(count ?? 0);
    };

    if (roleState !== "advisor") return;
    fetchNewMatches();
    const interval = setInterval(fetchNewMatches, 30000);
    return () => clearInterval(interval);
  }, [roleState, user?.id]);

  useEffect(() => {
    const fetchApprovedAppetites = async () => {
      if (roleState !== "bank" || !user?.id) return;

      const { count } = await supabase
        .from("branch_appetites")
        .select("*", { count: "exact", head: true })
        .eq("banker_id", user.id)
        .eq("is_approved", true)
        .gt("created_at", lastSeenAppetiteTime);

      setApprovedAppetiteCount(count ?? 0);
    };

    if (roleState !== "bank") return;
    fetchApprovedAppetites();
    const interval = setInterval(fetchApprovedAppetites, 30000);
    return () => clearInterval(interval);
  }, [roleState, user?.id, lastSeenAppetiteTime]);

  useEffect(() => {
    const fetchBankMatches = async () => {
      if (roleState !== "bank" || !user?.id) return;
      const lastSeen = localStorage.getItem("last_seen_matches") ?? new Date(0).toISOString();

      const { count: newCount } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("banker_id", user.id)
        .gt("created_at", lastSeen);

      const { count: closedCount } = await supabase
        .from("matches")
        .select("*", { count: "exact", head: true })
        .eq("banker_id", user.id)
        .eq("status", "closed")
        .gt("created_at", lastSeen);

      setNewBankMatchesCount((newCount ?? 0) + (closedCount ?? 0));
    };
    if (roleState !== "bank") return;
    fetchBankMatches();
    const interval = setInterval(fetchBankMatches, 30000);
    return () => clearInterval(interval);
  }, [roleState, user?.id]);

  const handleAppetiteClick = () => {
    const now = new Date().toISOString();
    localStorage.setItem("last_seen_appetite", now);
    setLastSeenAppetiteTime(now);
    setApprovedAppetiteCount(0);
  };

  const handleMatchesClick = () => {
    localStorage.setItem("last_seen_matches", new Date().toISOString());
    setNewBankMatchesCount(0);
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  const getDashboardPath = () => {
    if (roleState === "advisor") return "/advisor/dashboard";
    if (roleState === "bank") return "/bank/dashboard";
    if (roleState === "admin") return "/admin/dashboard";
    return "/";
  };

  const renderStatusBanner = () => {
    if (sessionState !== "has-session") return null;

    if (profileState === "missing") {
      return (
        <div className="bg-amber-50 border-b border-amber-200 py-2 px-4 flex items-center justify-center gap-2 text-amber-800 text-sm font-medium animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-4 w-4" />
          <span>הפרופיל שלך טרם הוקם. פונקציות מסוימות עשויות להיות מוגבלות.</span>
          <button onClick={() => reFetchProfile()} className="underline ml-2 hover:text-amber-900">
            בדוק עכשיו
          </button>
        </div>
      );
    }

    if (profileState === "pending") {
      return (
        <div className="bg-blue-50 border-b border-blue-200 py-2 px-4 flex items-center justify-center gap-2 text-blue-800 text-sm font-medium animate-in fade-in slide-in-from-top-4">
          <Clock className="h-4 w-4" />
          <span>החשבון שלך ממתין לאישור מנהל. תוכל לצפות בנתונים אך לא לבצע פעולות חדשות.</span>
          <button onClick={() => reFetchProfile()} className="underline ml-2 hover:text-blue-900">
            רענן סטטוס
          </button>
        </div>
      );
    }

    if (profileState === "error") {
      return (
        <div className="bg-red-50 border-b border-red-200 py-2 px-4 flex items-center justify-center gap-2 text-red-800 text-sm font-medium animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="h-4 w-4" />
          <span>שגיאה בטעינת נתוני הפרופיל.</span>
          <button onClick={() => reFetchProfile()} className="underline ml-2 hover:text-red-900">
            נסה שוב
          </button>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      {renderStatusBanner()}
      <header
        className="sticky top-0 z-50 w-full border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/60 text-right"
        dir="rtl"
      >
        <div className="container flex h-16 items-center px-4 sm:px-8">
          <Link to="/" className="flex items-center space-x-2 space-x-reverse ml-4">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">MB</span>
            </div>
            <span className="font-semibold text-lg hidden sm:inline-block">BranchMatch‏</span>
          </Link>

          {/* Mobile menu button */}
          <button className="mr-auto md:hidden" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="h-6 w-6" />
          </button>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-4 md:space-x-reverse md:mr-auto">
            {sessionState === "has-session" ? (
              <>
                <Link
                  to={getDashboardPath()}
                  className="relative text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                >
                  {roleState === "admin" ? "לוח בקרה" : "דאשבורד"}
                  {roleState === "admin" && adminPendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                      {adminPendingCount > 9 ? "9+" : adminPendingCount}
                    </span>
                  )}
                </Link>

                {roleState !== "admin" && (
                  <Link
                    to="/matches"
                    className="relative text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                    onClick={roleState === "bank" ? handleMatchesClick : undefined}
                  >
                    התאמות
                    {roleState === "advisor" && newMatchesCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                        {newMatchesCount > 9 ? "9+" : newMatchesCount}
                      </span>
                    )}
                    {roleState === "bank" && newBankMatchesCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                        {newBankMatchesCount > 9 ? "9+" : newBankMatchesCount}
                      </span>
                    )}
                  </Link>
                )}

                {roleState === "advisor" && (
                  <>
                    <Link
                      to="/advisor/submit-case"
                      className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                    >
                      הגש תיק
                    </Link>
                    <Link
                      to="/advisor/market"
                      className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                    >
                      שוק תיאבון
                    </Link>
                    <Link
                      to="/conversations"
                      className="relative text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                    >
                      שיחות
                      {totalUnread > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                          {totalUnread > 9 ? "9+" : totalUnread}
                        </span>
                      )}
                    </Link>
                  </>
                )}

                {roleState === "bank" && (
                  <>
                    <Link
                      to="/bank/market"
                      className="text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                    >
                      שוק פתוח
                    </Link>
                    <Link
                      to="/bank/appetite"
                      className="relative text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                      onClick={handleAppetiteClick}
                    >
                      תיאבון
                      {approvedAppetiteCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                          {approvedAppetiteCount}
                        </span>
                      )}
                    </Link>
                    <Link
                      to="/conversations"
                      className="relative text-foreground/80 hover:text-foreground px-3 py-2 text-sm font-medium transition-colors"
                    >
                      שיחות
                      {totalUnread > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                          {totalUnread > 9 ? "9+" : totalUnread}
                        </span>
                      )}
                    </Link>
                  </>
                )}

                <div className="border-r h-6 mx-2 hidden md:block" />

                <DropdownMenu modal={false}>
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
                    <DropdownMenuLabel>{profile?.full_name ?? "משתמש"}</DropdownMenuLabel>
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                      {user?.email}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(e) => {
                        e.preventDefault();
                        setIsProfileUpdateOpen(true);
                      }}
                      className="justify-end cursor-pointer"
                    >
                      <span>עדכון פרטים</span>
                      <Settings className="ml-2 h-4 w-4 text-muted-foreground" />
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleLogout}
                      className="justify-end cursor-pointer text-red-600 focus:text-red-600"
                    >
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
                {sessionState === "has-session" ? (
                  <>
                    <Link
                      to={getDashboardPath()}
                      className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {roleState === "admin" ? "לוח בקרה" : "דאשבורד"}
                      {roleState === "admin" && adminPendingCount > 0 && (
                        <span className="mr-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                          {adminPendingCount > 9 ? "9+" : adminPendingCount}
                        </span>
                      )}
                      <Home className="ml-2 h-4 w-4" />
                    </Link>

                    {roleState !== "admin" && (
                      <Link
                        to="/matches"
                        className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                        onClick={() => {
                          setIsMobileMenuOpen(false);
                          if (roleState === "bank") handleMatchesClick();
                        }}
                      >
                        התאמות
                        {roleState === "advisor" && newMatchesCount > 0 && (
                          <span className="mr-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                            {newMatchesCount > 9 ? "9+" : newMatchesCount}
                          </span>
                        )}
                        {roleState === "bank" && newBankMatchesCount > 0 && (
                          <span className="mr-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                            {newBankMatchesCount > 9 ? "9+" : newBankMatchesCount}
                          </span>
                        )}
                      </Link>
                    )}

                    {roleState === "advisor" && (
                      <>
                        <Link
                          to="/advisor/submit-case"
                          className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          הגש תיק
                        </Link>
                        <Link
                          to="/advisor/market"
                          className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          שוק תיאבון
                        </Link>
                        <Link
                          to="/conversations"
                          className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          שיחות
                          {totalUnread > 0 && (
                            <span className="mr-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                              {totalUnread > 9 ? "9+" : totalUnread}
                            </span>
                          )}
                        </Link>
                      </>
                    )}

                    {roleState === "bank" && (
                      <>
                        <Link
                          to="/bank/market"
                          className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          שוק פתוח
                        </Link>
                        <Link
                          to="/bank/appetite"
                          className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                          onClick={() => {
                            setIsMobileMenuOpen(false);
                            handleAppetiteClick();
                          }}
                        >
                          תיאבון
                          {approvedAppetiteCount > 0 && (
                            <span className="mr-2 bg-green-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                              {approvedAppetiteCount}
                            </span>
                          )}
                        </Link>
                        <Link
                          to="/conversations"
                          className="flex items-center justify-end px-4 py-2 text-foreground rounded-md hover:bg-accent"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          שיחות
                          {totalUnread > 0 && (
                            <span className="mr-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                              {totalUnread > 9 ? "9+" : totalUnread}
                            </span>
                          )}
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
      <ProfileUpdateDialog open={isProfileUpdateOpen} onOpenChange={setIsProfileUpdateOpen} />
    </>
  );
};

export default Navbar;

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  MessageSquare,
  Users,
  ArrowLeft,
  ShieldCheck,
  Clock,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAppetites } from '@/hooks/useAppetites';
import type { DbCase } from '@/types/cases';

const fmt = (n: number) => `₪${(n / 1_000).toLocaleString()}K`;

const AnonymousCaseRow: React.FC<{ c: DbCase }> = ({ c }) => (
  <div className="p-4 border rounded-lg hover:bg-accent transition-colors">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-lg text-primary">
            {fmt(c.loan_amount_min)} – {fmt(c.loan_amount_max)}
          </h3>
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-200">פתוח</Badge>
        </div>
        <div className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="text-[10px]">LTV {c.ltv}%</Badge>
          <Badge variant="outline" className="text-[10px]">
            {c.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'}
          </Badge>
          <Badge variant="outline" className="text-[10px]">{c.region}</Badge>
        </div>
      </div>
      <Link to="/bank/appetite">
        <Button variant="ghost" size="sm" className="gap-1">
          הצע התאמה
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
    </div>
  </div>
);

const BankDashboard = () => {
  const { profile, profileState } = useAuth();
  const { myAppetite, openCases, loading, error } = useAppetites();

  const isReadOnly = profileState === 'pending' || profileState === 'missing';

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 text-right" dir="rtl">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">דאשבורד בנקאי</h1>
        <p className="text-muted-foreground mt-1">
          שלום {profile?.full_name ?? 'בנקאי'} — ניהול הצעות ומעקב אחר פניות
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Quick Appetite Status */}
        <Card className="relative overflow-hidden border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <Activity className="h-8 w-8 text-primary opacity-20" />
              <Badge variant={myAppetite ? "default" : "secondary"}>
                {myAppetite ? "תיאבון פעיל" : "אין אות פעיל"}
              </Badge>
            </div>
            <CardTitle className="text-xl mt-2">הגדרות תיאבון</CardTitle>
            <CardDescription>נהל את סוגי התיקים שמעניינים אותך</CardDescription>
          </CardHeader>
          <CardContent>
            {myAppetite ? (
              <div className="space-y-2 text-sm mt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" /> LTV מקסימלי:
                  </span>
                  <span className="font-bold">{myAppetite.max_ltv}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium flex items-center gap-2">
                    <Clock className="h-4 w-4" /> זמן תגובה (SLA):
                  </span>
                  <span className="font-bold">{myAppetite.sla_days} ימים</span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mt-2">טרם הגדרת אות תיאבון. הגדר עכשיו כדי להתחיל לקבל הצעות.</p>
            )}
          </CardContent>
          <CardFooter>
            <Link to="/bank/appetite" className="w-full">
              <Button variant="outline" className="w-full gap-2">
                לניהול תיאבון
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* Quick Chat Status */}
        <Card className="relative overflow-hidden border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-start">
              <MessageSquare className="h-8 w-8 text-blue-500 opacity-20" />
              <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">צ'אטים פעילים</Badge>
            </div>
            <CardTitle className="text-xl mt-2">הודעות ושיחות</CardTitle>
            <CardDescription>תקשורת ישירה מול יועצים בתיקים שנסגרו</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mt-2">צפה בכל השיחות הפעילות שלך ונהל את שלבי הסגירה מול היועצים.</p>
          </CardContent>
          <CardFooter>
            <Link to="/bank/chat" className="w-full">
              <Button variant="outline" className="w-full gap-2 border-blue-200 hover:bg-blue-100">
                לכל השיחות
                <ExternalLink className="h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>

      {/* SECTION 2: Open Cases Preview */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            תיקים פתוחים במערכת
            <Badge variant="secondary">{openCases?.length || 0}</Badge>
          </h2>
          <Link to="/bank/appetite">
            <Button variant="link" className="text-primary gap-1">
              כל ההתאמות
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        {error ? (
          <div className="p-6 text-red-500 bg-red-50 rounded-lg">שגיאה בטעינת תיקים: {error}</div>
        ) : openCases?.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-2xl bg-muted/20">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-muted-foreground mb-1">
              אין תיקים פתוחים כרגע
            </h3>
            <p className="text-sm text-muted-foreground opacity-80">
              יועצי משכנתאות עדיין לא העלו תיקים חדשים
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {openCases?.slice(0, 5).map(c => (
              <AnonymousCaseRow key={c.id} c={c} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default BankDashboard;

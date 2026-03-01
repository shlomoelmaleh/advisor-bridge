import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PlusCircle,
  FileSpreadsheet,
  AlertCircle,
  Check,
  Clock,
  HandshakeIcon,
  LockIcon,
} from 'lucide-react';
import { useCases } from '@/hooks/useCases';
import { useAuth } from '@/hooks/useAuth';
import type { DbCase, CaseStatus } from '@/types/cases';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<CaseStatus, string> = {
  open: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
  in_progress: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
  matched: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
  closed: 'bg-gray-500/10 text-gray-500 hover:bg-gray-500/20',
};

const STATUS_ICON: Record<CaseStatus, React.ReactNode> = {
  open: <AlertCircle className="h-4 w-4 mr-1" />,
  in_progress: <Clock className="h-4 w-4 mr-1" />,
  matched: <HandshakeIcon className="h-4 w-4 mr-1" />,
  closed: <LockIcon className="h-4 w-4 mr-1" />,
};

const STATUS_LABEL: Record<CaseStatus, string> = {
  open: 'פתוח',
  in_progress: 'בטיפול',
  matched: 'הותאם',
  closed: 'סגור',
};

const fmt = (n: number) => `₪${(n / 1_000).toLocaleString()}K`;

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(iso)
  );

// ─── Skeleton loader ──────────────────────────────────────────────────────────

const CaseSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map((i) => (
      <div key={i} className="p-4 border rounded-lg flex flex-col gap-2">
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-1/4" />
      </div>
    ))}
  </div>
);

// ─── Single case row ──────────────────────────────────────────────────────────

const CaseRow: React.FC<{ c: DbCase }> = ({ c }) => (
  <div className="p-4 border rounded-lg hover:bg-accent transition-colors card-highlight">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-lg">
            {fmt(c.loan_amount_min)} – {fmt(c.loan_amount_max)}
          </h3>
          <Badge className={`flex items-center ${STATUS_COLOR[c.status]}`}>
            {STATUS_ICON[c.status]}
            {STATUS_LABEL[c.status]}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          <Badge variant="outline">LTV {c.ltv}%</Badge>
          <Badge variant="outline">
            {c.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'}
          </Badge>
          <Badge variant="outline">{c.property_type}</Badge>
          <Badge variant="outline">{c.region}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">הוגש ב-{formatDate(c.created_at)}</p>
      </div>
    </div>
  </div>
);

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ filtered?: boolean }> = ({ filtered }) => (
  <div className="text-center py-10">
    <p className="text-muted-foreground mb-4">
      {filtered ? 'אין תיקים בסטטוס זה' : 'עדיין לא הגשת תיקים'}
    </p>
    {!filtered && (
      <Link to="/advisor/submit-case">
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          הגש תיק ראשון
        </Button>
      </Link>
    )}
  </div>
);

// ─── Case list for a given filter ─────────────────────────────────────────────

const CaseList: React.FC<{ cases: DbCase[]; filter: string }> = ({ cases, filter }) => {
  const filtered =
    filter === 'all' ? cases : cases.filter((c) => c.status === filter);

  return filtered.length > 0 ? (
    <div className="space-y-3">
      {filtered.map((c) => (
        <CaseRow key={c.id} c={c} />
      ))}
    </div>
  ) : (
    <EmptyState filtered={filter !== 'all'} />
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const AdvisorDashboard = () => {
  const { profile } = useAuth();
  const { cases, loading, error } = useCases();
  const [activeFilter, setActiveFilter] = useState('all');

  if (profile && profile.is_approved === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4 max-w-md p-8">
          <div className="text-5xl">⏳</div>
          <h2 className="text-2xl font-bold">ממתין לאישור</h2>
          <p className="text-muted-foreground">
            החשבון שלך נמצא בבדיקה. מנהל המערכת יאשר אותך בקרוב.
          </p>
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: 'סה"כ תיקים',
      value: cases.length,
      icon: <FileSpreadsheet className="h-4 w-4" />,
      color: 'text-blue-500',
    },
    {
      title: 'הותאמו',
      value: cases.filter((c) => c.status === 'matched').length,
      icon: <Check className="h-4 w-4" />,
      color: 'text-green-500',
    },
    {
      title: 'פתוחים',
      value: cases.filter((c) => c.status === 'open').length,
      icon: <AlertCircle className="h-4 w-4" />,
      color: 'text-amber-500',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">לוח הבקרה</h1>
          <p className="text-muted-foreground">
            שלום, {profile?.full_name ?? 'יועץ'} — כאן כל התיקים שלך
          </p>
        </div>
        <Link to="/advisor/submit-case">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            תיק חדש
          </Button>
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="hover-scale">
            <CardContent className="p-6 flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className={`text-3xl font-bold ${stat.color}`}>
                  {loading ? '—' : stat.value}
                </p>
              </div>
              <div className={`rounded-full p-3 ${stat.color} bg-opacity-10`}>{stat.icon}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cases table */}
      <Card>
        <CardHeader>
          <CardTitle>התיקים שלי</CardTitle>
          <CardDescription>
            ניהול ומעקב אחר כל התיקים שהגשת
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              שגיאה בטעינת התיקים: {error}
            </div>
          ) : loading ? (
            <CaseSkeleton />
          ) : (
            <Tabs defaultValue="all" onValueChange={setActiveFilter}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">הכל ({cases.length})</TabsTrigger>
                <TabsTrigger value="open">
                  פתוח ({cases.filter((c) => c.status === 'open').length})
                </TabsTrigger>
                <TabsTrigger value="in_progress">
                  בטיפול ({cases.filter((c) => c.status === 'in_progress').length})
                </TabsTrigger>
                <TabsTrigger value="matched">
                  הותאם ({cases.filter((c) => c.status === 'matched').length})
                </TabsTrigger>
                <TabsTrigger value="closed">
                  סגור ({cases.filter((c) => c.status === 'closed').length})
                </TabsTrigger>
              </TabsList>

              {/* All tabs render the same CaseList, filtered by value */}
              {(['all', 'open', 'in_progress', 'matched', 'closed'] as const).map((tab) => (
                <TabsContent key={tab} value={tab}>
                  <CaseList cases={cases} filter={tab} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdvisorDashboard;

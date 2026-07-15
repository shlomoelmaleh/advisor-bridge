import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
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
  Trash2,
  Edit,
} from 'lucide-react';
import { useCases } from '@/hooks/useCases';
import { useAuth } from '@/hooks/useAuth';
import type { DbCase } from '@/types/cases';
import { propertyTypeLabel, regionLabel } from '@/lib/labels';
import AdvisorActivityLog from './AdvisorActivityLog';
import { CaseStatusBadge, ApprovalBadge } from '@/components/common/StatusBadge';
import EmptyState from '@/components/common/EmptyState';
import PageHeader from '@/components/common/PageHeader';

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const CaseRow: React.FC<{ c: DbCase; onRefresh: () => Promise<void> }> = ({ c, onRefresh }) => {
  const [showResubmitForm, setShowResubmitForm] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResubmitting, setIsResubmitting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('cases').delete().eq('id', c.id);
      if (error) throw error;
      toast.success('התיק נמחק בהצלחה');
      await onRefresh();
    } catch (err: unknown) {
      toast.error('שגיאה במחיקת התיק');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResubmit = async () => {
    setIsResubmitting(true);
    try {
      const { error } = await supabase
        .from('cases')
        .update({
          status: 'open',
          is_approved: false,
          resubmitted: true,
          admin_note: adminNote || null,
        } as any)
        .eq('id', c.id);
      if (error) throw error;
      toast.success('התיק הוגש מחדש בהצלחה');
      setShowResubmitForm(false);
      setAdminNote('');
      await onRefresh();
    } catch (err: unknown) {
      toast.error('שגיאה בהגשה מחדש');
    } finally {
      setIsResubmitting(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg hover:bg-accent transition-colors">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-lg">
              {fmt(c.loan_amount_min)} – {fmt(c.loan_amount_max)}
            </h3>
            <CaseStatusBadge status={c.status} />
            <ApprovalBadge c={c} />
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            <Badge variant="outline">LTV {c.ltv}%</Badge>
            <Badge variant="outline">
              {c.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'}
            </Badge>
            <Badge variant="outline">{propertyTypeLabel(c.property_type)}</Badge>
            <Badge variant="outline">{regionLabel(c.region)}</Badge>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
            <span>הוגש ב-{formatDate(c.created_at)}</span>
            {c.is_approved && c.last_matched_at && (
              <span>אושר ושודך ב-{formatDate(c.last_matched_at)}</span>
            )}
          </div>
        </div>
      </div>

      {c.status === 'rejected' && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <div className="flex gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 ml-1" />
              {isDeleting ? 'מוחק...' : 'מחק תיק'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
              onClick={() => setShowResubmitForm(!showResubmitForm)}
            >
              <Edit className="h-4 w-4 ml-1" />
              ערוך והגש מחדש
            </Button>
          </div>

          {showResubmitForm && (
            <div className="space-y-3 p-3 bg-accent/30 rounded-lg">
              <div>
                <label className="text-sm font-medium">הערה ל-Admin (אופציונלי)</label>
                <textarea
                  className="w-full mt-1 p-2 border rounded-md text-sm resize-none bg-background"
                  rows={3}
                  placeholder="הוסף הערה..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleResubmit}
                  disabled={isResubmitting}
                >
                  {isResubmitting ? 'שולח...' : 'הגש מחדש'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowResubmitForm(false); setAdminNote(''); }}
                >
                  ביטול
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Empty state ──────────────────────────────────────────────────────────────

const CasesEmptyState: React.FC<{ filtered?: boolean; isReadOnly: boolean }> = ({ filtered, isReadOnly }) => (
  <EmptyState
    title={filtered ? 'אין תיקים בסטטוס זה' : 'עדיין לא הגשת תיקים'}
    action={
      !filtered && (
        <Link to={isReadOnly ? "#" : "/advisor/submit-case"}>
          <Button disabled={isReadOnly} variant={isReadOnly ? "secondary" : "default"}>
            <PlusCircle className="ml-2 h-4 w-4" />
            הגש תיק ראשון
          </Button>
        </Link>
      )
    }
  />
);

// ─── Case list for a given filter ─────────────────────────────────────────────

const CaseList: React.FC<{ cases: DbCase[]; filter: string; isReadOnly: boolean; onRefresh: () => Promise<void> }> = ({ cases, filter, isReadOnly, onRefresh }) => {
  const filtered =
    filter === 'all' ? cases : cases.filter((c) => c.status === filter);

  return filtered.length > 0 ? (
    <div className="space-y-3">
      {filtered.map((c) => (
        <CaseRow key={c.id} c={c} onRefresh={onRefresh} />
      ))}
    </div>
  ) : (
    <CasesEmptyState filtered={filter !== 'all'} isReadOnly={isReadOnly} />
  );
};

// ─── Main component ───────────────────────────────────────────────────────────

const AdvisorDashboard = () => {
  const { profile, profileState, user } = useAuth();
  const { cases, loading, error, refreshCases } = useCases();
  const [activeFilter, setActiveFilter] = useState('all');

  useEffect(() => {
    // Poll for updates (e.g., Admin approval or Banker interest) every 15 seconds
    const interval = setInterval(refreshCases, 15000);
    return () => clearInterval(interval);
  }, [refreshCases]);

  const isReadOnly = profileState === 'pending' || profileState === 'missing';

  const stats = [
    {
      title: 'סה"כ תיקים',
      value: cases.length,
      icon: <FileSpreadsheet className="h-4 w-4" />,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'הותאמו',
      value: cases.filter((c) => c.status === 'matched').length,
      icon: <Check className="h-4 w-4" />,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      title: 'פתוחים',
      value: cases.filter((c) => c.status === 'open').length,
      icon: <AlertCircle className="h-4 w-4" />,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in text-right" dir="rtl">
      {/* Header */}
      <PageHeader
        title="לוח הבקרה"
        subtitle={`שלום, ${profile?.full_name ?? 'יועץ'} — כאן כל התיקים שלך`}
        action={
          <Link to={isReadOnly ? "#" : "/advisor/submit-case"}>
            <Button disabled={isReadOnly} variant={isReadOnly ? "secondary" : "default"}>
              <PlusCircle className="ml-2 h-4 w-4" />
              תיק חדש
            </Button>
          </Link>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="hover-scale">
            <CardContent className="p-6 flex justify-between items-center">
              <div className={`rounded-full p-3 ${stat.bg} ${stat.color}`}>{stat.icon}</div>
              <div className="text-left">
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className={`text-3xl font-bold ${stat.color}`}>
                  {loading ? '—' : stat.value}
                </p>
              </div>
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
              <TabsList className="mb-4 flex flex-wrap justify-start h-auto gap-2 bg-transparent p-0">
                <TabsTrigger value="all" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">הכל ({cases.length})</TabsTrigger>
                <TabsTrigger value="open" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  פתוח ({cases.filter((c) => c.status === 'open').length})
                </TabsTrigger>
                <TabsTrigger value="in_progress" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  בטיפול ({cases.filter((c) => c.status === 'in_progress').length})
                </TabsTrigger>
                <TabsTrigger value="matched" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  הותאם ({cases.filter((c) => c.status === 'matched').length})
                </TabsTrigger>
                <TabsTrigger value="closed" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  סגור ({cases.filter((c) => c.status === 'closed').length})
                </TabsTrigger>
                <TabsTrigger value="rejected" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  ארכיון נדחים ({cases.filter((c) => c.status === 'rejected').length})
                </TabsTrigger>
              </TabsList>

              {(['all', 'open', 'in_progress', 'matched', 'closed', 'rejected'] as const).map((tab) => (
                <TabsContent key={tab} value={tab}>
                  <CaseList cases={cases} filter={tab} isReadOnly={isReadOnly} onRefresh={refreshCases} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Activity Log */}
      {user?.id && <AdvisorActivityLog userId={user.id} />}
    </div>
  );
};

export default AdvisorDashboard;

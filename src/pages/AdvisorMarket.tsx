import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Building2,
  DollarSign,
  MapPin,
  Clock,
  ChevronRight,
  ShieldCheck,
  Search,
  Users,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

interface AppetiteSignal {
  id: string;
  bank_name: string;
  appetite_level: string | null;
  min_loan_amount: number | null;
  max_ltv: number | null;
  preferred_regions: string[] | null;
  preferred_borrower_types: string[] | null;
  sla_days: number | null;
  created_at: string | null;
}

const levelConfig: Record<string, { label: string; class: string }> = {
  high: { label: 'גבוה', class: 'bg-green-500/10 text-green-600 border-green-500/20' },
  medium: { label: 'בינוני', class: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  low: { label: 'נמוך', class: 'bg-muted text-muted-foreground border-muted' },
};

const borrowerTypeLabels: Record<string, string> = {
  employee: 'שכיר',
  self_employed: 'עצמאי',
};

const AdvisorMarket = () => {
  const { user } = useAuth();
  const [appetites, setAppetites] = useState<AppetiteSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAppetites = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('branch_appetites')
          .select('id, bank_name, appetite_level, min_loan_amount, max_ltv, preferred_regions, preferred_borrower_types, sla_days, created_at')
          .eq('is_approved', true)
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAppetites(data ?? []);
      } catch (err) {
        console.error('Error fetching appetites:', err);
        toast.error('שגיאה בטעינת איתותי תיאבון');
      } finally {
        setLoading(false);
      }
    };
    fetchAppetites();
  }, [user]);

  return (
    <AppLayout>
      <div className="container mx-auto p-4 sm:p-8 max-w-5xl text-right animate-in fade-in duration-500" dir="rtl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">שוק תיאבון</h1>
          <p className="text-muted-foreground mt-1">צפה באיתותי תיאבון פעילים של בנקים והגש תיק מתאים</p>
        </header>

        {loading ? (
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          </div>
        ) : appetites.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
            <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
            <h3 className="text-lg font-semibold">אין כרגע איתותי תיאבון פעילים</h3>
            <p className="text-muted-foreground max-w-sm mx-auto mt-2">
              חזור מאוחר יותר כדי לראות איתותים חדשים מבנקים.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {appetites.map((a) => (
              <AppetiteCard key={a.id} appetite={a} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

const AppetiteCard = ({ appetite }: { appetite: AppetiteSignal }) => {
  const navigate = useNavigate();
  const [contacting, setContacting] = useState(false);
  const level = levelConfig[appetite.appetite_level ?? 'medium'] ?? levelConfig.medium;
  const regions = appetite.preferred_regions?.join(', ') || '—';
  const borrowerTypes = appetite.preferred_borrower_types
    ?.map(t => borrowerTypeLabels[t] ?? t)
    .join(', ') || '—';
  const minLoan = appetite.min_loan_amount
    ? `₪${(appetite.min_loan_amount / 1000).toLocaleString()}K`
    : '—';

  const handleContact = async () => {
    setContacting(true);
    try {
      const { data, error } = await (supabase.rpc as any)('express_interest_in_appetite', {
        p_appetite_id: appetite.id,
      });
      if (error) throw error;
      // data is the new match UUID
      navigate(`/chat/${data}`);
    } catch (err: any) {
      console.error('Error expressing interest:', err);
      toast.error(err.message || 'שגיאה ביצירת קשר');
    } finally {
      setContacting(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow border-r-4 border-r-primary overflow-hidden">
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <Badge variant="outline" className={`text-xs font-medium ${level.class}`}>
          תיאבון {level.label}
        </Badge>
        <div className="bg-primary/10 p-2 rounded-lg">
          <Building2 className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardTitle className="text-xl font-bold">
          {appetite.bank_name}
        </CardTitle>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">סכום מינימלי</span>
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <DollarSign className="h-3.5 w-3.5 text-primary/60" />
              {minLoan}
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">LTV מקסימלי</span>
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
              {appetite.max_ltv ?? '—'}%
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">אזורים מועדפים</span>
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <MapPin className="h-3.5 w-3.5 text-primary/60" />
              {regions}
            </div>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">סוגי לווים</span>
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <Users className="h-3.5 w-3.5 text-primary/60" />
              {borrowerTypes}
            </div>
          </div>
          <div className="flex flex-col gap-0.5 col-span-2">
            <span className="text-[10px] uppercase text-muted-foreground tracking-wider">SLA (ימי טיפול)</span>
            <div className="flex items-center gap-1.5 font-semibold text-sm">
              <Clock className="h-3.5 w-3.5 text-primary/60" />
              {appetite.sla_days ?? '—'} ימים
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-muted/20 border-t pt-4">
        <Button
          variant="default"
          className="w-full gap-2"
          onClick={handleContact}
          disabled={contacting}
        >
          {contacting ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> יוצר קשר...</>
          ) : (
            <>
              צור קשר
              <ChevronRight className="h-4 w-4 rotate-180" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default AdvisorMarket;

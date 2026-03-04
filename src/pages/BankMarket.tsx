import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Briefcase,
    DollarSign,
    MapPin,
    Building2,
    Clock,
    ChevronRight,
    ShieldCheck,
    Search,
    AlertCircle,
    Activity
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

interface OpenCase {
    id: string;
    loan_amount_min: number;
    loan_amount_max: number;
    ltv: number;
    borrower_type: string;
    region: string;
    property_type: string;
    created_at: string;
}

const BankMarket = () => {
    const { user, profile, signOut } = useAuth();
    const [cases, setCases] = useState<OpenCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState<string | null>(null);

    useEffect(() => {
        fetchOpenCases();
    }, [user]);

    const fetchOpenCases = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // 1. Fetch cases already matched with this banker to filter them out
            // Check both direct matches and appetite-based matches
            const { data: directMatches } = await supabase
                .from('matches')
                .select('case_id')
                .eq('banker_id', user.id);

            const { data: appetiteMatches } = await supabase
                .from('matches')
                .select('case_id, appetite:branch_appetites!inner(banker_id)')
                .eq('branch_appetites.banker_id', user.id);

            const existingCaseIds = Array.from(new Set([
                ...(directMatches?.map(m => m.case_id) ?? []),
                ...(appetiteMatches?.map(m => m.case_id) ?? [])
            ])).filter(Boolean) as string[];

            // 2. Fetch all approved open cases
            let query = supabase
                .from('cases')
                .select('*')
                .eq('status', 'open')
                .eq('is_approved', true)
                .order('created_at', { ascending: false });

            if (existingCaseIds.length > 0) {
                query = query.not('id', 'in', `(${existingCaseIds.join(',')})`);
            }

            const { data, error } = await query;

            if (error) throw error;
            setCases(data || []);
        } catch (err) {
            console.error('Error fetching cases:', err);
            toast.error('שגיאה בטעינת התיקים');
        } finally {
            setLoading(false);
        }
    };

    const handleExpressInterest = async (caseId: string) => {
        if (!user) return;
        setSubmitting(caseId);
        try {
            // 1. Check if a match already exists for this case + banker
            const { data: existingMatch } = await supabase
                .from('matches')
                .select('id')
                .eq('case_id', caseId)
                .eq('banker_id', user.id)
                .maybeSingle();

            if (existingMatch) {
                toast.info('כבר הבעת עניין בתיק זה');
                setCases(prev => prev.filter(c => c.id !== caseId));
                return;
            }

            // 2. Insert match directly WITHOUT requiring appetite
            const { error: matchError } = await supabase
                .from('matches')
                .insert({
                    case_id: caseId,
                    appetite_id: null,   // no appetite required
                    score: 0,
                    status: 'interested',
                    advisor_status: 'pending',
                    banker_status: 'interested',
                    banker_id: user.id   // add this field if it exists on matches table
                });

            if (matchError) throw matchError;

            toast.success('התעניינות נשלחה ליועץ!');
            // Remove from list locally
            setCases(prev => prev.filter(c => c.id !== caseId));
        } catch (err) {
            console.error('Error expressing interest:', err);
            toast.error('שגיאה בשליחת התעניינות');
        } finally {
            setSubmitting(null);
        }
    };

    if (profile?.is_approved === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
                <div className="text-center space-y-6 max-w-md w-full p-8 border rounded-2xl shadow-sm bg-card">
                    <div className="text-6xl text-center">⏳</div>
                    <h2 className="text-2xl font-bold">החשבון שלך בבדיקה</h2>
                    <p className="text-muted-foreground">
                        מנהל המערכת יאשר את חשבונך בקרוב.
                        תקבל גישה מלאה לפלטפורמה לאחר האישור.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm text-right space-y-1">
                        <p>✅ נרשמת בהצלחה</p>
                        <p>⏳ ממתין לאישור מנהל</p>
                        <p className="text-muted-foreground mt-1">לאחר אישור: גישה מלאה לשוק הפתוח</p>
                    </div>
                    <Button variant="outline" onClick={() => signOut()} className="w-full">
                        התנתק
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <AppLayout>
            <div className="container mx-auto p-4 sm:p-8 max-w-5xl text-right animate-in fade-in duration-500" dir="rtl">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">שוק פתוח</h1>
                    <p className="text-muted-foreground mt-1">צפה בתיקים פתוחים והבע עניין בדיסקרטיות</p>
                </header>

                {loading ? (
                    <div className="flex items-center justify-center min-h-[40vh]">
                        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    </div>
                ) : cases.length === 0 ? (
                    <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
                        <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold">אין תיקים חדשים בשוק</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                            חזור מאוחר יותר כדי לראות תיקים חדשים שאושרו במערכת.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {cases.map((c) => (
                            <CaseMarketCard
                                key={c.id}
                                caseData={c}
                                onExpress={handleExpressInterest}
                                isSubmitting={submitting === c.id}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

const CaseMarketCard = ({ caseData, onExpress, isSubmitting }: {
    caseData: OpenCase,
    onExpress: (id: string) => void,
    isSubmitting: boolean
}) => {
    const amount = `₪${(caseData.loan_amount_min / 1000000).toFixed(1)}M - ₪${(caseData.loan_amount_max / 1000000).toFixed(1)}M`;
    const date = new Date(caseData.created_at).toLocaleDateString('he-IL');

    return (
        <Card className="hover:shadow-md transition-shadow border-r-4 border-r-primary overflow-hidden">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                <Badge variant="outline" className="text-[10px] font-normal">
                    פורסם ב-{date}
                </Badge>
                <div className="bg-primary/10 p-2 rounded-lg">
                    <Briefcase className="h-4 w-4 text-primary" />
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground italic">סכום מבוקש</span>
                    <CardTitle className="text-xl font-bold">{amount}</CardTitle>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase text-muted-foreground tracking-wider">LTV מקסימלי</span>
                        <div className="flex items-center gap-1.5 font-semibold text-sm">
                            <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
                            {caseData.ltv}%
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase text-muted-foreground tracking-wider">סוג לווה</span>
                        <div className="flex items-center gap-1.5 font-semibold text-sm">
                            <Clock className="h-3.5 w-3.5 text-primary/60" />
                            {caseData.borrower_type}
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase text-muted-foreground tracking-wider">אזור</span>
                        <div className="flex items-center gap-1.5 font-semibold text-sm">
                            <MapPin className="h-3.5 w-3.5 text-primary/60" />
                            {caseData.region}
                        </div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] uppercase text-muted-foreground tracking-wider">סוג נכס</span>
                        <div className="flex items-center gap-1.5 font-semibold text-sm">
                            <Activity className="h-3.5 w-3.5 text-primary/60" />
                            {caseData.property_type}
                        </div>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-muted/20 border-t pt-4">
                <Button
                    variant="default"
                    className="w-full gap-2"
                    onClick={() => onExpress(caseData.id)}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'שולח...' : 'מעוניין בתיק זה'}
                    <ChevronRight className="h-4 w-4 rotate-180" />
                </Button>
            </CardFooter>
        </Card>
    );
};

export default BankMarket;

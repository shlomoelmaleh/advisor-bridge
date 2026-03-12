import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useMatches } from '@/hooks/useMatches';
import { useCases } from '@/hooks/useCases';
import type { MatchWithDetails } from '@/types/matches';

const fmt = (n: number) => `₪${(n / 1_000).toLocaleString()}K`;

// ─── Score badge rendering ────────────────────────────────────────────────────
const ScoreBadge: React.FC<{ score: number }> = ({ score }) => {
    let color = 'bg-red-500/10 text-red-500 border-red-500/20';
    if (score >= 70) color = 'bg-green-500/10 text-green-500 border-green-500/20';
    else if (score >= 40) color = 'border-amber-500/20 bg-amber-500/10 text-amber-500';

    return (
        <Badge variant="outline" className={`font-mono text-sm px-2 py-1 ${color}`}>
            {score}% התאמה
        </Badge>
    );
};

// ─── Component: Advisor View ──────────────────────────────────────────────────
const AdvisorMatchesView = () => {
    const navigate = useNavigate();
    const { cases } = useCases();
    const { matches, loading, error, runMatching, expressInterest, rejectMatch, refreshMatches } = useMatches();
    const [runningFor, setRunningFor] = useState<string | null>(null);
    const [actingOn, setActingOn] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(refreshMatches, 15000);
        return () => clearInterval(interval);
    }, [refreshMatches]);

    useEffect(() => {
        const channel = supabase
            .channel('advisor-matches-realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'matches' },
                () => { refreshMatches(); }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleRunMatch = async (caseId: string) => {
        setRunningFor(caseId);
        const { error } = await runMatching(caseId);
        setRunningFor(null);
        if (error) toast.error(`שגיאה בהפעלת התאמה: ${error}`);
        else toast.success('התאמות חדשות נמצאו!');
    };

    const handleInterest = async (matchId: string) => {
        setActingOn(matchId);
        const { error } = await expressInterest(matchId);
        setActingOn(null);
        if (error) toast.error(`שגיאה בשליחת התעניינות: ${error}`);
        else toast.success('התעניינות נשלחה לסניף!');
    };

    const handleInterestAndChat = async (matchId: string) => {
        setActingOn(matchId);
        const { error } = await expressInterest(matchId);
        setActingOn(null);
        if (error) {
            toast.error(`שגיאה בשליחת התעניינות: ${error}`);
        } else {
            navigate(`/chat/${matchId}`);
        }
    };

    const handleReject = async (matchId: string) => {
        setActingOn(matchId);
        const { error } = await rejectMatch(matchId);
        setActingOn(null);
        if (error) toast.error('שגיאה');
        else toast.info('ההצעה נדחתה');
    };

    // Group matches by case ID
    const matchesByCaseId = matches.reduce((acc, m) => {
        if (!acc[m.case_id]) acc[m.case_id] = [];
        acc[m.case_id].push(m);
        return acc;
    }, {} as Record<string, MatchWithDetails[]>);

    if (loading) return <div className="space-y-4"><Skeleton className="h-40 w-full" /></div>;
    if (error) return <div className="text-red-500 p-4 bg-red-50 rounded-lg">{error}</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold">ההתאמות שלי</h1>
                <p className="text-muted-foreground">לוח ניהול שידוכים מול סניפים שמתעניינים בתיקים שלך.</p>
            </div>

            {cases.length === 0 ? (
                <div className="text-center py-12">אין לך עדיין תיקים. צור תיק כדי לקבל התאמות.</div>
            ) : (
                <div className="space-y-8">
                    {cases.filter(c => c.is_approved === true && c.status !== 'rejected').map((c) => {
                        const caseMatches = matchesByCaseId[c.id] || [];
                        return (
                            <Card key={c.id}>
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-lg">
                                                תיק: {fmt(c.loan_amount_min)}–{fmt(c.loan_amount_max)} | LTV {c.ltv}%
                                            </CardTitle>
                                            <CardDescription>
                                                {c.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'} • מבוקש באזור {c.region}
                                            </CardDescription>
                                        </div>
                                        <Button
                                            variant="outline"
                                            onClick={() => handleRunMatch(c.id)}
                                            disabled={runningFor === c.id}
                                        >
                                            {runningFor === c.id ? "מריץ אלגוריתם..." : "הרץ התאמה מחדש"}
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {caseMatches.length === 0 ? (
                                        <div className="text-sm text-muted-foreground text-center py-4 bg-accent/50 rounded-lg">
                                            לא נמצאו עדיין התאמות לתיק זה. נסה שוב מאוחר יותר.
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 mt-2">
                                            {caseMatches.map((m) => (
                                                <div key={m.id} className="flex justify-between items-center p-4 border rounded-lg hover:border-primary/40 transition-colors">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-3">
                                                            <ScoreBadge score={m.score} />
                                                            <h4 className="font-semibold">
                                                                {m.appetite
                                                                    ? `${m.appetite.bank_name} - ${m.appetite.branch_name}`
                                                                    : m.banker?.company
                                                                        ? `${m.banker.company}`
                                                                        : 'בנקאי ללא פרופיל appetite'
                                                                }
                                                            </h4>
                                                            {!m.appetite && m.banker && (
                                                                <Badge variant="outline" className="text-blue-600">
                                                                    פנייה ישירה מהשוק הפתוח
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2 text-sm text-muted-foreground">
                                                            {m.appetite ? (
                                                                <>
                                                                    <Badge variant="secondary">רמת תיאבון בסניף: {m.appetite.appetite_level}</Badge>
                                                                    <span>•</span>
                                                                    <span>זמני טיפול: <strong>{m.appetite.sla_days} ימים</strong></span>
                                                                </>
                                                            ) : (
                                                                <span>{m.banker?.full_name || 'בנקאי'} (פנייה ישירה)</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {/* Banker already interested — advisor needs to respond */}
                                                        {m.banker_status === 'interested' && m.advisor_status === 'pending' && (
                                                            <div className="flex flex-col items-end gap-2">
                                                                <Badge className="bg-blue-500 text-white p-2">
                                                                    🏦 בנק מעוניין! האם אתה מעוניין?
                                                                </Badge>
                                                                    <Button
                                                                        onClick={() => handleInterestAndChat(m.id)}
                                                                        disabled={actingOn === m.id}
                                                                        className="bg-green-600 hover:bg-green-700"
                                                                    >
                                                                        אשר ועבור לצ'אט ←
                                                                    </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    className="border-destructive text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleReject(m.id)}
                                                                    disabled={actingOn === m.id}
                                                                >
                                                                    דחה הצעה
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {/* Advisor already interested — waiting for banker */}
                                                        {m.advisor_status === 'interested' && m.banker_status === 'pending' && (
                                                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white p-2">
                                                                ✅ הבעת עניין - ממתין לאישור בנק
                                                            </Badge>
                                                        )}

                                                        {/* Both interested — match closed */}
                                                        {m.status === 'closed' && (
                                                            <div className="flex flex-col items-end gap-2">
                                                                <Badge className="bg-green-600 hover:bg-green-700 p-2">
                                                                    🎉 שידוך הושלם!
                                                                </Badge>
                                                                <Button
                                                                    variant="link"
                                                                    className="p-0 h-auto"
                                                                    onClick={() => navigate(`/chat/${m.id}`)}
                                                                >
                                                                    מעבר לצ'אט →
                                                                </Button>
                                                            </div>
                                                        )}

                                                        {/* No action yet — advisor can initiate */}
                                                        {m.advisor_status === 'pending' && m.banker_status === 'pending' && (
                                                            <Button
                                                                onClick={() => handleInterest(m.id)}
                                                                disabled={actingOn === m.id}
                                                            >
                                                                מעוניין להגיש
                                                            </Button>
                                                        )}

                                                        {/* Rejected */}
                                                        {(m.advisor_status === 'rejected' || m.banker_status === 'rejected') && (
                                                            <Badge variant="outline" className="text-muted-foreground">נדחה</Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};


// ─── Component: Bank View ─────────────────────────────────────────────────────
const BankMatchesView = () => {
    const navigate = useNavigate();
    const { matches, loading, error, expressInterest, refreshMatches } = useMatches();
    const [actingOn, setActingOn] = useState<string | null>(null);

    useEffect(() => {
        const interval = setInterval(refreshMatches, 15000);
        return () => clearInterval(interval);
    }, [refreshMatches]);

    useEffect(() => {
        const channel = supabase
            .channel('bank-matches-realtime')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'matches' },
                () => { refreshMatches(); }
            )
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const handleInterest = async (matchId: string) => {
        setActingOn(matchId);
        const { error } = await expressInterest(matchId);
        setActingOn(null);
        if (error) toast.error(`שגיאה בשליחת אישור: ${error}`);
        else toast.success('התעניינות אושרה! תעודכן אם היועץ גם יסכים.');
    };

    const handleInterestAndChat = async (matchId: string) => {
        setActingOn(matchId);
        const { error } = await expressInterest(matchId);
        setActingOn(null);
        if (error) {
            toast.error(`שגיאה בשליחת אישור: ${error}`);
        } else {
            navigate(`/chat/${matchId}`);
        }
    };

    if (loading) return <div className="space-y-4"><Skeleton className="h-40 w-full" /></div>;
    if (error) return <div className="text-red-500 p-4 bg-red-50 rounded-lg">{error}</div>;

    const bestMatchPerCase = Object.values(
        matches.reduce((acc, m) => {
            const key = m.case_id;
            if (!acc[key]) { acc[key] = m; return acc; }
            const current = acc[key];
            const statusRank: Record<string, number> = { closed: 3, interested: 2, pending: 1 };
            const currentRank = statusRank[current.status ?? ''] ?? 0;
            const newRank = statusRank[m.status ?? ''] ?? 0;
            if (newRank > currentRank || (newRank === currentRank && (m.score ?? 0) > (current.score ?? 0))) {
                acc[key] = m;
            }
            return acc;
        }, {} as Record<string, MatchWithDetails>)
    );

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold">תיקים בהתאמה (Leads)</h1>
                <p className="text-muted-foreground">תיקים אנונימיים שעלתה בהם התאמה לאות התיאבון שפרסמת.</p>
            </div>

            {bestMatchPerCase.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-background">
                    <h3 className="text-lg text-muted-foreground">אין התאמות כרגע</h3>
                    <p className="text-sm">וודא שאות התיאבון שלך פעיל ועדכני.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {bestMatchPerCase.map((m) => (
                        <Card key={m.id} className="hover-scale flex flex-col">
                            <CardHeader className="pb-3 border-b bg-accent/20">
                                <div className="flex justify-between items-start">
                                    <Badge variant="outline" className="bg-background">
                                        {m.case?.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'}
                                    </Badge>
                                    <ScoreBadge score={m.score} />
                                </div>
                                <CardTitle className="pt-2">
                                    ₪{(m.case?.loan_amount_min / 1_000_000).toFixed(1)}M – ₪{(m.case?.loan_amount_max / 1_000_000).toFixed(1)}M
                                </CardTitle>
                                <CardDescription>
                                    LTV: {m.case?.ltv}% • אזור מבוקש: {m.case?.region}
                                </CardDescription>
                            </CardHeader>

                            <CardContent className="pt-4 flex-1">
                                {/* 
                  Bank sees anonymous case data and has to "accept" the lead. 
                  If status matches 'interested' it means the ADVISOR pressed interested,
                  so if the bank presses interested now, it CLOSES the match.
                  We simplify UI based on the prompt instructions.
                */}
                                <div className="text-sm text-center py-3 bg-accent/20 rounded-md">
                                    {m.banker_status === 'pending' && m.advisor_status === 'pending' && "ממתין לתגובה שלך"}
                                    {m.banker_status === 'pending' && m.advisor_status === 'interested' && <span className="text-blue-600 font-semibold">יועץ הראה התעניינות! 🔥</span>}
                                    {m.banker_status === 'interested' && m.advisor_status === 'pending' && <span className="text-amber-600 font-semibold">ממתין לאישור היועץ...</span>}
                                    {m.status === 'closed' && <span className="text-green-600 font-semibold">שידוך סגור! זהות נחשפת.</span>}
                                    {(m.banker_status === 'rejected' || m.advisor_status === 'rejected') && "נדחה."}
                                </div>
                            </CardContent>

                            <CardFooter className="pt-2 mt-auto">
                                {m.banker_status === 'pending' && m.advisor_status === 'pending' && (
                                    <Button
                                        className="w-full shadow-md"
                                        onClick={() => handleInterest(m.id)}
                                        disabled={actingOn === m.id}
                                    >
                                        {actingOn === m.id ? 'מעדכן...' : 'הצע התאמה'}
                                    </Button>
                                )}
                                {m.banker_status === 'interested' && m.advisor_status === 'pending' && (
                                    <Button disabled className="w-full bg-amber-100 text-amber-800 cursor-not-allowed">
                                        ממתין לאישור יועץ...
                                    </Button>
                                )}
                                {m.banker_status === 'pending' && m.advisor_status === 'interested' && (
                                    <Button
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                        onClick={() => handleInterestAndChat(m.id)}
                                        disabled={actingOn === m.id}
                                    >
                                        {actingOn === m.id ? 'מעדכן...' : 'מעבר לצ\'אט ←'}
                                    </Button>
                                )}
                                {m.status === 'closed' && (
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={() => navigate(`/chat/${m.id}`)}
                                    >
                                        מעבר לצ'אט עם המגיש
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};


// ─── Main Switch Component ────────────────────────────────────────────────────
const MatchesPage = () => {
    const { profile, sessionState, profileState } = useAuth();

    if (sessionState === 'booting' || profileState === 'loading') return null;

    return (
        <div className="container py-8 max-w-6xl">
            {profile?.role === 'advisor' ? <AdvisorMatchesView /> : <BankMatchesView />}
        </div>
    );
};

export default MatchesPage;

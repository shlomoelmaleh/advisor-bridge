import React, { useState } from 'react';
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
    const { matches, loading, error, runMatching, expressInterest } = useMatches();
    const [runningFor, setRunningFor] = useState<string | null>(null);
    const [actingOn, setActingOn] = useState<string | null>(null);

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
                    {cases.map((c) => {
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
                                                            <h4 className="font-semibold">{m.appetite?.bank_name} - {m.appetite?.branch_name}</h4>
                                                        </div>
                                                        <div className="flex gap-2 text-sm text-muted-foreground">
                                                            <Badge variant="secondary">רמת תיאבון בסניף: {m.appetite?.appetite_level}</Badge>
                                                            <span>•</span>
                                                            <span>זמני טיפול: <strong>{m.appetite?.sla_days} ימים</strong></span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {m.status === 'pending' && (
                                                            <Button
                                                                onClick={() => handleInterest(m.id)}
                                                                disabled={actingOn === m.id}
                                                            >
                                                                מעוניין להגיש
                                                            </Button>
                                                        )}
                                                        {m.status === 'interested' && (
                                                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white p-2">
                                                                ✅ הבעת עניין - ממתין לאישור בנק
                                                            </Badge>
                                                        )}
                                                        {m.status === 'closed' && (
                                                            <div className="flex flex-col items-end gap-2">
                                                                <Badge className="bg-green-600 hover:bg-green-700 p-2">🎉 שידוך הושלם!</Badge>
                                                                <Button
                                                                    variant="link"
                                                                    className="p-0 h-auto"
                                                                    onClick={() => navigate(`/chat/${m.id}`)}
                                                                >
                                                                    מעבר לצ'אט →
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {m.status === 'rejected' && (
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
    const { matches, loading, error, expressInterest } = useMatches();
    const [actingOn, setActingOn] = useState<string | null>(null);

    const handleInterest = async (matchId: string) => {
        setActingOn(matchId);
        const { error } = await expressInterest(matchId);
        setActingOn(null);
        if (error) toast.error(`שגיאה בשליחת אישור: ${error}`);
        else toast.success('התעניינות אושרה! תעודכן אם היועץ גם יסכים.');
    };

    if (loading) return <div className="space-y-4"><Skeleton className="h-40 w-full" /></div>;
    if (error) return <div className="text-red-500 p-4 bg-red-50 rounded-lg">{error}</div>;

    return (
        <div className="space-y-8 animate-fade-in">
            <div>
                <h1 className="text-3xl font-bold">תיקים בהתאמה (Leads)</h1>
                <p className="text-muted-foreground">תיקים אנונימיים שעלתה בהם התאמה לאות התיאבון שפרסמת.</p>
            </div>

            {matches.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-lg bg-background">
                    <h3 className="text-lg text-muted-foreground">אין התאמות כרגע</h3>
                    <p className="text-sm">וודא שאות התיאבון שלך פעיל ועדכני.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {matches.map((m) => (
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
                                    {m.status === 'pending' && "ממתין לתגובה שלך / של היועץ"}
                                    {m.status === 'interested' && <span className="text-blue-600 font-semibold">יועץ הראה התעניינות!</span>}
                                    {m.status === 'closed' && <span className="text-green-600 font-semibold">שידוך סגור! זהות המגיש נחשפה.</span>}
                                    {m.status === 'rejected' && "נדחה."}
                                </div>
                            </CardContent>

                            <CardFooter className="pt-2 mt-auto">
                                {m.status !== 'closed' && m.status !== 'rejected' && (
                                    <Button
                                        className="w-full shadow-md"
                                        onClick={() => handleInterest(m.id)}
                                        disabled={actingOn === m.id}
                                    >
                                        {actingOn === m.id ? 'מעדכן...' : '👍 רלוונטי לסניף!'}
                                    </Button>
                                )}
                                {m.status === 'closed' && (
                                    <Button
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={() => navigate(`/chat/${m.id}`)}
                                    >
                                        מעבר לצ'אט עם המגיש →
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
    const { profile, loading } = useAuth();

    if (loading) return null;

    return (
        <div className="container py-8 max-w-6xl">
            {profile?.role === 'advisor' ? <AdvisorMatchesView /> : <BankMatchesView />}
        </div>
    );
};

export default MatchesPage;

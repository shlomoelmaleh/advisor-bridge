import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMatches } from '@/hooks/useMatches';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Clock, ChevronLeft } from 'lucide-react';
import type { MatchWithDetails } from '@/types/matches';

const Conversations = () => {
    const { profile } = useAuth();
    const { matches, loading } = useMatches();
    const navigate = useNavigate();

    const isAdvisor = profile?.role === 'advisor';

    // We only want closed matches where the chat is active
    const closedMatches = matches.filter(m => m.status === 'closed');

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 sm:p-8 max-w-5xl text-right animate-in fade-in duration-500" dir="rtl">
            <header className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight">שיחות</h1>
                <p className="text-muted-foreground mt-1">נהל את התקשורת מול {isAdvisor ? 'הבנקאים' : 'יועצי המשכנתאות'}</p>
            </header>

            {closedMatches.length === 0 ? (
                <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
                    <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                    <h3 className="text-lg font-semibold">אין שיחות פעילות עדיין</h3>
                    <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                        כאשר התאמות יאושרו על ידי שני הצדדים (סטטוס סגור), הם יופיעו כאן ותוכלו להתחיל לשוחח.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {closedMatches.map((match) => (
                        <ConversationCard
                            key={match.id}
                            match={match}
                            isAdvisor={isAdvisor}
                            onClick={() => navigate(`/chat/${match.id}`)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const ConversationCard = ({ match, isAdvisor, onClick }: {
    match: MatchWithDetails,
    isAdvisor: boolean,
    onClick: () => void
}) => {
    // Determine display name
    const displayName = isAdvisor
        ? (match.appetite
            ? `${match.appetite.bank_name} - ${match.appetite.branch_name}`
            : match.banker?.company || 'בנקאי')
        : `תיק: ₪${(match.case.loan_amount_min / 1_000).toLocaleString()}K-₪${(match.case.loan_amount_max / 1_000).toLocaleString()}K`;

    return (
        <Card
            className="p-4 sm:p-5 transition-all hover:shadow-md cursor-pointer border-l-4 border-l-primary flex flex-col sm:flex-row gap-4 sm:items-center justify-between"
            onClick={onClick}
        >
            <div className="flex items-start sm:items-center gap-4 flex-1">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageCircle className="h-6 w-6 text-primary" />
                </div>

                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-lg">{displayName}</h3>
                        {!match.appetite_id && (
                            <Badge variant="outline" className="text-blue-600 text-[10px] h-5 px-1.5 shrink-0">
                                {isAdvisor ? 'פנייה ישירה' : 'שוק פתוח'}
                            </Badge>
                        )}
                    </div>

                    <div className="text-sm text-muted-foreground space-y-0.5">
                        {isAdvisor ? (
                            <p>
                                ₪{(match.case.loan_amount_min / 1_000).toLocaleString()}K – ₪{(match.case.loan_amount_max / 1_000).toLocaleString()}K | LTV {match.case.ltv}%
                            </p>
                        ) : (
                            <p>
                                LTV {match.case.ltv}% | אזור: {match.case.region} | {match.case.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'}
                            </p>
                        )}
                        <p className="line-clamp-1 opacity-60 italic mt-1">
                            היכנס לשיחה כדי לצפות בהודעות...
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 mt-2 sm:mt-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-border/50 w-full sm:w-auto shrink-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>עודכן לאחרונה</span>
                </div>
                <Button size="sm" onClick={(e) => { e.stopPropagation(); onClick(); }}>
                    כנס לשיחה
                    <ChevronLeft className="mr-1 h-4 w-4" />
                </Button>
            </div>
        </Card>
    );
};

export default Conversations;

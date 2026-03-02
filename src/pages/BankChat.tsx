import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, User, ChevronLeft, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';

interface ChatConversation {
    id: string; // match_id
    last_message?: string;
    last_message_at?: string;
    advisor_name: string;
    case_details: {
        loan_amount: number;
        borrower_type: string;
    };
    unread_count?: number;
}

const BankChat = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = React.useState('');

    const { data: conversations, isLoading } = useQuery({
        queryKey: ['bank-conversations', user?.id],
        queryFn: async () => {
            // Fetch matches that are in 'closed' status (meaning chat is open)
            // and belong to this banker's appetites
            const { data, error } = await supabase
                .from('matches')
                .select(`
          id,
          status,
          created_at,
          case:cases(
            loan_amount_max,
            borrower_type,
            advisor:profiles(full_name)
          ),
          appetite:branch_appetites(banker_id)
        `)
                .eq('status', 'closed')
                .eq('appetite.banker_id', user?.id);

            if (error) throw error;

            // Map to our view model
            return (data || []).map((m: any) => ({
                id: m.id,
                advisor_name: m.case?.advisor?.full_name || 'יועץ אנונימי',
                case_details: {
                    loan_amount: m.case?.loan_amount_max || 0,
                    borrower_type: m.case?.borrower_type || 'פרטי'
                },
                last_message: 'לחץ כדי לצפות בשיחה',
                last_message_at: m.created_at
            })) as ChatConversation[];
        },
        enabled: !!user,
    });

    const filteredConversations = conversations?.filter(c =>
        c.advisor_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <AppLayout>
            <div className="container mx-auto p-4 sm:p-8 max-w-4xl text-right animate-in fade-in" dir="rtl">
                <header className="mb-8">
                    <h1 className="text-3xl font-bold tracking-tight">שיחות וצ'אטים</h1>
                    <p className="text-muted-foreground mt-1">נהל את ההתקשרות מול יועצי המשכנתאות בתיקים שנסגרו</p>
                </header>

                <div className="relative mb-6">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="חפש לפי שם יועץ..."
                        className="pr-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
                        ))}
                    </div>
                ) : filteredConversations?.length === 0 ? (
                    <div className="text-center py-20 bg-muted/20 rounded-2xl border-2 border-dashed">
                        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold">אין שיחות פעילות</h3>
                        <p className="text-muted-foreground mt-2">שיחות נפתחות באופן אוטומטי לאחר שבוצע שידוך מוצלח</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filteredConversations?.map((conv) => (
                            <Card
                                key={conv.id}
                                className="hover:bg-accent/50 cursor-pointer transition-colors border-r-4 border-r-primary"
                                onClick={() => navigate(`/chat/${conv.id}`)}
                            >
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                        <User className="h-6 w-6 text-primary" />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h3 className="font-bold truncate">{conv.advisor_name}</h3>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(conv.last_message_at || '').toLocaleDateString('he-IL')}
                                            </span>
                                        </div>
                                        <p className="text-sm text-muted-foreground truncate">
                                            תיק: ₪{(conv.case_details.loan_amount / 1_000_000).toFixed(1)}M | {conv.case_details.borrower_type}
                                        </p>
                                        <p className="text-xs text-primary mt-1 font-medium italic">
                                            {conv.last_message}
                                        </p>
                                    </div>

                                    <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default BankChat;

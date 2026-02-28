import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { mapDatabaseError } from '@/lib/mapDatabaseError';
import { messageSchema } from '@/lib/validation';
import type { MatchWithDetails } from '@/types/matches';

interface Message {
    id: string;
    match_id: string;
    sender_id: string;
    content: string;
    created_at: string;
    sender?: {
        full_name: string;
        role: string;
    };
}

const Chat = () => {
    const { matchId } = useParams<{ matchId: string }>();
    const navigate = useNavigate();
    const { user, profile } = useAuth();

    const [match, setMatch] = useState<MatchWithDetails | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        if (!user || !profile || !matchId) return;

        let isMounted = true;

        const fetchMatchAndMessages = async () => {
            setLoading(true);
            setError(null);

            try {
                // 1. Fetch match details
                const { data: matchData, error: matchError } = await supabase
                    .from('matches')
                    .select(`
            *,
            case:cases(*),
            appetite:branch_appetites(*)
          `)
                    .eq('id', matchId)
                    .single();

                if (matchError) throw matchError;

                if (matchData.status !== 'closed') {
                    throw new Error("הצ'אט נפתח רק לאחר שידוך הדדי (סטטוס סגור)");
                }

                // Security check: ensure user is part of the match
                if (profile.role === 'advisor' && matchData.case.advisor_id !== user.id) {
                    throw new Error('Access denied');
                }
                if (profile.role === 'bank' && matchData.appetite.banker_id !== user.id) {
                    throw new Error('Access denied');
                }

                if (isMounted) setMatch(matchData as unknown as MatchWithDetails);

                // 2. Fetch history
                const { data: messagesData, error: messagesError } = await supabase
                    .from('messages')
                    .select(`
            *,
            sender:profiles(full_name, role)
          `)
                    .eq('match_id', matchId)
                    .order('created_at', { ascending: true });

                if (messagesError) throw messagesError;

                if (isMounted) setMessages(messagesData as unknown as Message[]);
            } catch (err: any) {
                if (isMounted) setError(err.message || 'Error loading chat');
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchMatchAndMessages();

        // 3. Realtime subscription
        const channel = supabase
            .channel(`chat-${matchId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `match_id=eq.${matchId}`,
                },
                async (payload) => {
                    // payload.new only contains the raw row. We need the sender's profile for UI.
                    // Since it's realtime, we quickly fetch the profile for this new message
                    const { data: senderProfile } = await supabase
                        .from('profiles')
                        .select('full_name, role')
                        .eq('user_id', payload.new.sender_id)
                        .single();

                    const newMsg: Message = {
                        id: payload.new.id,
                        match_id: payload.new.match_id,
                        sender_id: payload.new.sender_id,
                        content: payload.new.content,
                        created_at: payload.new.created_at,
                        sender: senderProfile || undefined,
                    };

                    if (isMounted) {
                        setMessages((prev) => [...prev, newMsg]);
                    }
                }
            )
            .subscribe();

        return () => {
            isMounted = false;
            supabase.removeChannel(channel);
        };
    }, [matchId, user, profile]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const validated = messageSchema.safeParse({ content: newMessage });
        if (!validated.success) {
            toast.error(validated.error.errors[0]?.message || 'הודעה לא תקינה');
            return;
        }
        if (!user || !matchId) return;

        setSending(true);
        try {
            const { error } = await supabase.from('messages').insert({
                match_id: matchId,
                sender_id: user.id,
                content: newMessage.trim(),
            });

            if (error) throw error;
            setNewMessage('');
        } catch (err: unknown) {
            toast.error(mapDatabaseError(err));
        } finally {
            setSending(false);
        }
    };

    if (loading) return <div className="p-8"><Skeleton className="h-[600px] w-full" /></div>;

    if (error) {
        return (
            <div className="container max-w-4xl py-12 text-center">
                <div className="bg-red-50 text-red-600 p-6 rounded-lg mb-6">
                    <h2 className="text-xl font-bold mb-2">לא ניתן לטעון צ'אט</h2>
                    <p>{error}</p>
                </div>
                <Button onClick={() => navigate('/matches')}>חזרה להתאמות</Button>
            </div>
        );
    }

    if (!match) return null;

    // Header formatting based on role
    const chatTitle = profile?.role === 'advisor'
        ? `שיחה עם ${match.appetite.bank_name} - ${match.appetite.branch_name}`
        : `שיחה עם יועץ (תיק ע"ס ₪${(match.case.loan_amount_max / 1_000_000).toFixed(1)}M)`;

    return (
        <div className="container max-w-4xl py-6 animate-fade-in flex flex-col h-[calc(100vh-5rem)]">

            {/* Header */}
            <div className="bg-card border rounded-t-xl p-4 flex items-center gap-4 shadow-sm z-10 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => navigate('/matches')} className="rounded-full">
                    <ArrowRight className="h-5 w-5" />
                </Button>
                <div className="flex-1">
                    <h1 className="font-bold text-lg">{chatTitle}</h1>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <span>שידוך מאושר על ידי שני הצדדים</span>
                        <span>•</span>
                        <span className="text-green-600 font-medium">{match.score}% התאמה</span>
                    </p>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 bg-accent/10 border-x flex flex-col gap-4">
                {messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-70">
                        <Badge variant="outline" className="mb-2">הצ'אט מתחיל כאן</Badge>
                        <p className="text-sm">שלח הודעה כדי להתחיל את השיחה.</p>
                    </div>
                ) : (
                    messages.map((msg, idx) => {
                        const isMe = msg.sender_id === user?.id;

                        // Should we show the sender name? (Only if it's the first message or different from previous)
                        const showName = !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id);

                        const timeStr = new Date(msg.created_at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

                        return (
                            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                {showName && (
                                    <span className="text-xs text-muted-foreground mb-1 mr-2 px-1">
                                        {msg.sender?.full_name || 'אנונימי'}
                                    </span>
                                )}
                                <div
                                    className={`max-w-[75%] rounded-2xl px-4 py-2 relative shadow-sm ${isMe
                                            ? 'bg-primary text-primary-foreground rounded-tr-sm'
                                            : 'bg-card border text-card-foreground rounded-tl-sm'
                                        }`}
                                >
                                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                                    <span className={`text-[10px] mt-1 block w-full text-left ${isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                        {timeStr}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-card border rounded-b-xl p-4 shrink-0 shadow-sm relative z-10">
                <form onSubmit={handleSendMessage} className="flex gap-2 relative">
                    <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="כתוב הודעה..."
                        className="flex-1 rounded-full px-6 bg-accent/30 border-transparent focus-visible:border-primary/50"
                        disabled={sending}
                    />
                    <Button
                        type="submit"
                        size="icon"
                        className="rounded-full shadow-sm"
                        disabled={!newMessage.trim() || sending}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>

        </div>
    );
};

export default Chat;

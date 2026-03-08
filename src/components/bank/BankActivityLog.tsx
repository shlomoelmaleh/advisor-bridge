import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle,
  Sparkles,
  UserCheck,
  Handshake,
  MessageSquare,
  ArrowLeft,
} from 'lucide-react';

interface ActivityEvent {
  type: 'appetite_approved' | 'new_match' | 'advisor_interested' | 'match_closed' | 'new_message';
  time: string;
  text: string;
  action: string;
  link: string;
  isNew: boolean;
}

const isRecent = (time: string) =>
  Date.now() - new Date(time).getTime() < 48 * 60 * 60 * 1000;

const formatTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
};

const fmt = (n: number) => `₪${(n / 1_000).toLocaleString()}K`;

const EVENT_ICON: Record<ActivityEvent['type'], React.ReactNode> = {
  appetite_approved: <CheckCircle className="h-4 w-4 text-green-500" />,
  new_match: <Sparkles className="h-4 w-4 text-blue-500" />,
  advisor_interested: <UserCheck className="h-4 w-4 text-amber-500" />,
  match_closed: <Handshake className="h-4 w-4 text-emerald-500" />,
  new_message: <MessageSquare className="h-4 w-4 text-violet-500" />,
};

const BankActivityLog: React.FC<{ userId: string }> = ({ userId }) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const allEvents: ActivityEvent[] = [];

    // 1. Appetite approvals
    const { data: appetites } = await supabase
      .from('branch_appetites')
      .select('id, bank_name, branch_name, is_approved, created_at')
      .eq('banker_id', userId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false })
      .limit(5);

    appetites?.forEach((a) => {
      allEvents.push({
        type: 'appetite_approved',
        time: a.created_at!,
        text: `איתות התיאבון של ${a.bank_name} אושר`,
        action: 'לצפות בהתאמות ←',
        link: '/matches',
        isNew: isRecent(a.created_at!),
      });
    });

    // 2. New matches (auto-matched)
    const { data: newMatches } = await supabase
      .from('matches')
      .select('id, created_at, case_id')
      .eq('banker_id', userId)
      .eq('banker_status', 'pending')
      .eq('advisor_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    newMatches?.forEach((m) => {
      allEvents.push({
        type: 'new_match',
        time: m.created_at!,
        text: 'נמצאה התאמה חדשה לסניף שלך',
        action: 'לבחון התאמה ←',
        link: '/matches',
        isNew: isRecent(m.created_at!),
      });
    });

    // 3. Advisor interest
    const { data: advisorInterested } = await supabase
      .from('matches')
      .select('id, created_at')
      .eq('banker_id', userId)
      .eq('advisor_status', 'interested')
      .eq('banker_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);

    advisorInterested?.forEach((m) => {
      allEvents.push({
        type: 'advisor_interested',
        time: m.created_at!,
        text: 'יועץ הביע עניין בתיק שלך',
        action: 'לאשר ←',
        link: '/matches',
        isNew: isRecent(m.created_at!),
      });
    });

    // 4. Closed matches
    const { data: closed } = await supabase
      .from('matches')
      .select('id, created_at')
      .eq('banker_id', userId)
      .eq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(5);

    closed?.forEach((m) => {
      allEvents.push({
        type: 'match_closed',
        time: m.created_at!,
        text: 'שידוך נסגר! זהות היועץ נחשפת',
        action: 'לפתוח צ׳אט ←',
        link: `/chat/${m.id}`,
        isNew: isRecent(m.created_at!),
      });
    });

    // 5. Unread messages
    const { data: unreadMessages } = await supabase
      .from('messages')
      .select('id, created_at, match_id, sender_id')
      .is('read_at', null)
      .neq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    unreadMessages?.forEach((msg) => {
      allEvents.push({
        type: 'new_message',
        time: msg.created_at!,
        text: 'הודעה חדשה מיועץ',
        action: 'לפתוח שיחה ←',
        link: `/chat/${msg.match_id}`,
        isNew: true,
      });
    });

    allEvents.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    setEvents(allEvents.slice(0, 15));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle>יומן פעילות אחרונה</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>יומן פעילות אחרונה</CardTitle></CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">אין פעילות אחרונה להצגה</p>
        ) : (
          <div className="space-y-1">
            {events.map((event, idx) => (
              <div
                key={`${event.type}-${idx}`}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  event.isNew ? 'bg-primary/5 border border-primary/10' : 'hover:bg-accent'
                }`}
              >
                <div className="flex-shrink-0 w-2.5">
                  {event.isNew && <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />}
                </div>
                <div className="flex-shrink-0">{EVENT_ICON[event.type]}</div>
                <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[90px]">
                  {formatTime(event.time)}
                </span>
                <span className="text-sm flex-1">{event.text}</span>
                <Link to={event.link}>
                  <Button variant="ghost" size="sm" className="text-xs gap-1 flex-shrink-0">
                    {event.action}
                    <ArrowLeft className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BankActivityLog;

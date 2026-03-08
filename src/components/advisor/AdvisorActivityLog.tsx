import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CheckCircle,
  XCircle,
  Handshake,
  MessageSquare,
  ArrowLeft,
  UserCheck,
} from 'lucide-react';

interface ActivityEvent {
  type: 'case_approved' | 'case_rejected' | 'banker_interested' | 'match_closed' | 'new_message';
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

const EVENT_ICON: Record<ActivityEvent['type'], React.ReactNode> = {
  case_approved: <CheckCircle className="h-4 w-4 text-green-500" />,
  case_rejected: <XCircle className="h-4 w-4 text-red-500" />,
  banker_interested: <UserCheck className="h-4 w-4 text-blue-500" />,
  match_closed: <Handshake className="h-4 w-4 text-emerald-500" />,
  new_message: <MessageSquare className="h-4 w-4 text-violet-500" />,
};

const AdvisorActivityLog: React.FC<{ userId: string }> = ({ userId }) => {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    const allEvents: ActivityEvent[] = [];

    // 1. Case approvals & rejections
    const { data: cases } = await supabase
      .from('cases')
      .select('id, loan_amount_min, loan_amount_max, is_approved, status, created_at')
      .eq('advisor_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    cases?.forEach((c) => {
      if (c.is_approved && c.status !== 'rejected') {
        allEvents.push({
          type: 'case_approved',
          time: c.created_at!,
          text: `תיק ₪${((c.loan_amount_min ?? 0) / 1000).toLocaleString()}K אושר ופורסם לבנקאים`,
          action: 'לצפות בהתאמות ←',
          link: '/matches',
          isNew: isRecent(c.created_at!),
        });
      }
      if (c.status === 'rejected') {
        allEvents.push({
          type: 'case_rejected',
          time: c.created_at!,
          text: `תיק ₪${((c.loan_amount_min ?? 0) / 1000).toLocaleString()}K נדחה על ידי Admin`,
          action: 'הגש תיק חדש ←',
          link: '/advisor/submit-case',
          isNew: isRecent(c.created_at!),
        });
      }
    });

    // 2. Banker interest
    const { data: pendingMatches } = await supabase
      .from('matches')
      .select(`id, created_at, banker_status, advisor_status, case_id,
               appetite:branch_appetites(bank_name, branch_name)`)
      .eq('banker_status', 'interested')
      .eq('advisor_status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10) as { data: any[] | null };

    pendingMatches?.forEach((m: any) => {
      const bankName = m.appetite?.bank_name || 'בנקאי';
      allEvents.push({
        type: 'banker_interested',
        time: m.created_at!,
        text: `${bankName} מתעניין בתיק שלך`,
        action: 'לאשר / לדחות ←',
        link: '/matches',
        isNew: isRecent(m.created_at!),
      });
    });

    // 3. Closed matches
    const { data: closedMatches } = await supabase
      .from('matches')
      .select(`id, created_at, status,
               appetite:branch_appetites(bank_name)`)
      .eq('status', 'closed')
      .order('created_at', { ascending: false })
      .limit(5) as { data: any[] | null };

    closedMatches?.forEach((m: any) => {
      allEvents.push({
        type: 'match_closed',
        time: m.created_at!,
        text: `שידוך נסגר עם ${m.appetite?.bank_name || 'בנקאי'}`,
        action: 'לפתוח צ׳אט ←',
        link: `/chat/${m.id}`,
        isNew: isRecent(m.created_at!),
      });
    });

    // 4. Unread messages
    const { data: unreadMessages } = await supabase
      .from('messages')
      .select(`id, created_at, content, sender_id, match_id`)
      .is('read_at', null)
      .neq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    unreadMessages?.forEach((msg) => {
      allEvents.push({
        type: 'new_message',
        time: msg.created_at!,
        text: 'הודעה חדשה מבנקאי',
        action: 'לפתוח שיחה ←',
        link: `/chat/${msg.match_id}`,
        isNew: true,
      });
    });

    // Sort desc, limit 15
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
        <CardHeader>
          <CardTitle>יומן פעילות אחרונה</CardTitle>
        </CardHeader>
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
      <CardHeader>
        <CardTitle>יומן פעילות אחרונה</CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            אין פעילות אחרונה להצגה
          </p>
        ) : (
          <div className="space-y-1">
            {events.map((event, idx) => (
              <div
                key={`${event.type}-${idx}`}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  event.isNew
                    ? 'bg-primary/5 border border-primary/10'
                    : 'hover:bg-accent'
                }`}
              >
                {/* New indicator dot */}
                <div className="flex-shrink-0 w-2.5">
                  {event.isNew && (
                    <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                  )}
                </div>

                {/* Icon */}
                <div className="flex-shrink-0">{EVENT_ICON[event.type]}</div>

                {/* Time */}
                <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[90px]">
                  {formatTime(event.time)}
                </span>

                {/* Text */}
                <span className="text-sm flex-1">{event.text}</span>

                {/* Action */}
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

export default AdvisorActivityLog;

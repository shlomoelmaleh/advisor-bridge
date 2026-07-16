import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { mapDatabaseError } from '@/lib/mapDatabaseError';
import { queryKeys } from '@/lib/queryKeys';
import type { MatchWithDetails, MatchStatus } from '@/types/matches';

interface UseMatchesReturn {
    matches: MatchWithDetails[];
    loading: boolean;
    error: string | null;
    runMatching: (caseId: string) => Promise<{ error: string | null }>;
    expressInterest: (matchId: string) => Promise<{ error: string | null }>;
    rejectMatch: (matchId: string) => Promise<{ error: string | null }>;
    refreshMatches: () => Promise<void>;
    getUnreadCount: (matchId: string) => Promise<number>;
    getUnreadCounts: (matchIds: string[]) => Promise<Record<string, number>>;
}

const MATCHES_SELECT = `
          *,
          case:cases!left (
            advisor_id,
            loan_amount_min,
            loan_amount_max,
            ltv,
            borrower_type,
            region,
            status,
            is_approved
          ),
          appetite:branch_appetites (
            banker_id,
            bank_name,
            branch_name,
            appetite_level,
            sla_days
          ),
          banker:profiles!matches_banker_id_fkey (
            user_id,
            full_name,
            company
          ),
          messages (
            content,
            created_at
          )
        `;

const fetchMatchesForUser = async (
    userId: string,
    role: string,
): Promise<MatchWithDetails[]> => {
    const { data, error } = await supabase
        .from('matches')
        .select(MATCHES_SELECT)
        .order('created_at', { foreignTable: 'messages', ascending: false })
        .limit(1, { foreignTable: 'messages' })
        .order('score', { ascending: false });

    if (error) throw error;

    let filteredData = (data as unknown as MatchWithDetails[]) || [];

    // UX filter only — actual access enforced by RLS "Match participants see matches" policy
    if (role === 'advisor') {
        filteredData = filteredData.filter((m) => {
            if (m.case === null || m.case === undefined) {
                return (m as any).advisor_id === userId;
            }
            return (
                m.case?.advisor_id === userId &&
                m.case?.status !== 'rejected' &&
                m.case?.is_approved === true
            );
        });
    } else if (role === 'bank') {
        filteredData = filteredData.filter(
            (m) =>
                (m.banker_id === userId || m.appetite?.banker_id === userId) &&
                (m.case === null || (m.case?.status !== 'rejected' && m.case?.is_approved === true))
        );
    }

    return filteredData;
};

export const useMatches = (): UseMatchesReturn => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const queryKey = queryKeys.matches(user?.id, profile?.role);

    const query = useQuery({
        queryKey,
        queryFn: () => fetchMatchesForUser(user!.id, profile!.role),
        enabled: !!user && !!profile,
    });

    // ── Realtime → invalidation ────────────────────────────────────────────────
    // Replaces the per-view postgres_changes subscriptions AND the 15s pollers
    // that previously lived in Matches.tsx: any change to `matches` invalidates
    // this user's matches query, so React Query refetches once. Unique per-mount
    // channel name avoids collisions if the hook is used by two components.
    const channelName = useRef(`matches-rt-${Math.random().toString(36).slice(2)}`).current;
    const uid = user?.id;
    const role = profile?.role;
    useEffect(() => {
        if (!uid || !role) return;
        const channel = supabase
            .channel(channelName)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'matches' },
                () => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.matches(uid, role) });
                },
            )
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [uid, role, queryClient, channelName]);

    const getUnreadCount = useCallback(async (matchId: string): Promise<number> => {
        const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('match_id', matchId)
            .neq('sender_id', user?.id)
            .is('read_at', null);
        return count ?? 0;
    }, [user?.id]);

    // Batched variant — one query for all matches instead of one per match
    const getUnreadCounts = useCallback(async (matchIds: string[]): Promise<Record<string, number>> => {
        if (matchIds.length === 0) return {};
        const { data } = await supabase
            .from('messages')
            .select('match_id')
            .in('match_id', matchIds)
            .neq('sender_id', user?.id)
            .is('read_at', null);
        const counts: Record<string, number> = {};
        for (const row of (data as { match_id: string }[]) ?? []) {
            counts[row.match_id] = (counts[row.match_id] || 0) + 1;
        }
        return counts;
    }, [user?.id]);

    const runMatchingMutation = useMutation({
        mutationFn: async (caseId: string) => {
            const { error } = await supabase.rpc('run_matching_for_case', { p_case_id: caseId });
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ matchId, newStatus }: { matchId: string; newStatus: MatchStatus }) => {
            if (!profile) throw new Error('Not authenticated');
            // UX optimization — validate_match_update trigger enforces cross-role protection server-side
            const column = profile.role === 'advisor' ? 'advisor_status' : 'banker_status';
            const { error } = await supabase
                .from('matches')
                .update({ [column]: newStatus } as any)
                .eq('id', matchId);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    });

    const runMatching = async (caseId: string): Promise<{ error: string | null }> => {
        try {
            await runMatchingMutation.mutateAsync(caseId);
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const updateMatchStatus = async (matchId: string, newStatus: MatchStatus) => {
        try {
            await updateStatusMutation.mutateAsync({ matchId, newStatus });
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    return {
        matches: query.data ?? [],
        loading: query.isLoading,
        error: query.isError ? mapDatabaseError(query.error) : null,
        runMatching,
        expressInterest: (id) => updateMatchStatus(id, 'interested'),
        rejectMatch: (id) => updateMatchStatus(id, 'rejected'),
        refreshMatches: async () => { await query.refetch(); },
        getUnreadCount,
        getUnreadCounts,
    };
};

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { mapDatabaseError } from '@/lib/mapDatabaseError';
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
}

export const useMatches = (): UseMatchesReturn => {
    const { user, profile } = useAuth();
    const [matches, setMatches] = useState<MatchWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMatches = useCallback(async () => {
        if (!user || !profile) {
            setMatches([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await supabase
                .from('matches')
                .select(`
          *,
          case:cases (
            advisor_id,
            loan_amount_min,
            loan_amount_max,
            ltv,
            borrower_type,
            region,
            status
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
        `)
                .order('created_at', { foreignTable: 'messages', ascending: false })
                .limit(1, { foreignTable: 'messages' })
                .order('score', { ascending: false });

            if (fetchError) throw fetchError;

            let filteredData = (data as unknown as MatchWithDetails[]) || [];

            // UX filter only — actual access enforced by RLS "Match participants see matches" policy
            if (profile.role === 'advisor') {
                filteredData = filteredData.filter((m) => m.case?.advisor_id === user.id);
            } else if (profile.role === 'bank') {
                filteredData = filteredData.filter((m) => m.banker_id === user.id || m.appetite?.banker_id === user.id);
            }

            setMatches(filteredData);
        } catch (err: unknown) {
            setError(mapDatabaseError(err));
        } finally {
            setLoading(false);
        }
    }, [user, profile]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const getUnreadCount = useCallback(async (matchId: string): Promise<number> => {
        const { count } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('match_id', matchId)
            .neq('sender_id', user?.id)
            .is('read_at', null);
        return count ?? 0;
    }, [user?.id]);

    const runMatching = async (caseId: string): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase.rpc('run_matching_for_case', {
                p_case_id: caseId,
            });
            if (error) throw error;

            await fetchMatches();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const updateMatchStatus = async (matchId: string, newStatus: MatchStatus) => {
        if (!profile) return { error: 'Not authenticated' };

        try {
            // UX optimization — validate_match_update trigger enforces cross-role protection server-side
            const column = profile.role === 'advisor' ? 'advisor_status' : 'banker_status';
            const { error } = await supabase
                .from('matches')
                .update({ [column]: newStatus } as any)
                .eq('id', matchId);

            if (error) throw error;

            await fetchMatches();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    return {
        matches,
        loading,
        error,
        runMatching,
        expressInterest: (id) => updateMatchStatus(id, 'interested'),
        rejectMatch: (id) => updateMatchStatus(id, 'rejected'),
        refreshMatches: fetchMatches,
        getUnreadCount,
    };
};

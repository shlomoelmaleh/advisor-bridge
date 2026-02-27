import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { MatchWithDetails, MatchStatus } from '@/types/matches';

interface UseMatchesReturn {
    matches: MatchWithDetails[];
    loading: boolean;
    error: string | null;
    runMatching: (caseId: string) => Promise<{ error: string | null }>;
    expressInterest: (matchId: string) => Promise<{ error: string | null }>;
    rejectMatch: (matchId: string) => Promise<{ error: string | null }>;
    refreshMatches: () => Promise<void>;
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
            // Query matches with joined case and appetite data
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
          )
        `)
                .order('score', { ascending: false });

            if (fetchError) throw new Error(fetchError.message);

            // Filter the results in memory since PostgREST doesn't support filtering
            // by a joined table's column at the top level easily in the JS client
            let filteredData = (data as unknown as MatchWithDetails[]) || [];

            if (profile.role === 'advisor') {
                filteredData = filteredData.filter((m) => m.case?.advisor_id === user.id);
            } else if (profile.role === 'bank') {
                filteredData = filteredData.filter((m) => m.appetite?.banker_id === user.id);
            }

            setMatches(filteredData);
        } catch (err: any) {
            setError(err.message || 'Error fetching matches');
        } finally {
            setLoading(false);
        }
    }, [user, profile]);

    useEffect(() => {
        fetchMatches();
    }, [fetchMatches]);

    const runMatching = async (caseId: string): Promise<{ error: string | null }> => {
        try {
            const { error } = await supabase.rpc('run_matching_for_case', {
                p_case_id: caseId,
            });
            if (error) throw new Error(error.message);

            await fetchMatches();
            return { error: null };
        } catch (err: any) {
            return { error: err.message || 'Error running matching algorithm' };
        }
    };

    const updateMatchStatus = async (matchId: string, newStatus: MatchStatus) => {
        try {
            const { error } = await supabase
                .from('matches')
                .update({ status: newStatus })
                .eq('id', matchId);

            if (error) throw new Error(error.message);

            // Status update logic: if both sides mark interested it becomes closed.
            // Easiest is to just let a DB trigger handle it, or refresh to see the true state.
            await fetchMatches();
            return { error: null };
        } catch (err: any) {
            return { error: err.message || `Error updating match to ${newStatus}` };
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
    };
};

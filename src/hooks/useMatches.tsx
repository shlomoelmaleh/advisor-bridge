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
          )
        `)
                .order('score', { ascending: false });

            if (fetchError) throw fetchError;

            let filteredData = (data as unknown as MatchWithDetails[]) || [];

            if (profile.role === 'advisor') {
                filteredData = filteredData.filter((m) => m.case?.advisor_id === user.id);
            } else if (profile.role === 'bank') {
                filteredData = filteredData.filter((m) => m.appetite?.banker_id === user.id);
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
            // Use role-specific column to prevent race conditions
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
    };
};

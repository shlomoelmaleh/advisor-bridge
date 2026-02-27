import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { DbCase, CreateCaseData } from '@/types/cases';

interface UseCasesReturn {
    cases: DbCase[];
    loading: boolean;
    error: string | null;
    createCase: (data: CreateCaseData) => Promise<{ error: string | null }>;
    updateCaseStatus: (id: string, status: DbCase['status']) => Promise<{ error: string | null }>;
    refreshCases: () => Promise<void>;
}

export const useCases = (): UseCasesReturn => {
    const { user, profile } = useAuth();
    const [cases, setCases] = useState<DbCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCases = useCallback(async () => {
        if (!user || !profile) {
            setCases([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        let query = supabase
            .from('cases')
            .select('*')
            .order('created_at', { ascending: false });

        if (profile.role === 'advisor') {
            // Advisors see only their own cases
            query = query.eq('advisor_id', user.id);
        } else {
            // Bankers see all open cases
            query = query.eq('status', 'open');
        }

        const { data, error: fetchError } = await query;

        if (fetchError) {
            setError(fetchError.message);
        } else {
            setCases((data ?? []) as DbCase[]);
        }

        setLoading(false);
    }, [user, profile]);

    // Auto-fetch on mount and whenever user/profile changes
    useEffect(() => {
        fetchCases();
    }, [fetchCases]);

    const createCase = async (data: CreateCaseData): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        const { error: insertError } = await supabase.from('cases').insert({
            ...data,
            advisor_id: user.id,
            status: 'open',
        });

        if (insertError) return { error: insertError.message };

        await fetchCases();
        return { error: null };
    };

    const updateCaseStatus = async (
        id: string,
        status: DbCase['status']
    ): Promise<{ error: string | null }> => {
        const { error: updateError } = await supabase
            .from('cases')
            .update({ status })
            .eq('id', id);

        if (updateError) return { error: updateError.message };

        // Optimistic local update
        setCases((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
        return { error: null };
    };

    return {
        cases,
        loading,
        error,
        createCase,
        updateCaseStatus,
        refreshCases: fetchCases,
    };
};

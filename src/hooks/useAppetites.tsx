import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BranchAppetite, UpsertAppetiteData } from '@/types/appetites';
import type { DbCase } from '@/types/cases';
import { mapDatabaseError } from '@/lib/mapDatabaseError';

interface UseAppetitesReturn {
    myAppetite: BranchAppetite | null;
    openCases: DbCase[];
    loading: boolean;
    error: string | null;
    upsertAppetite: (data: UpsertAppetiteData) => Promise<{ error: string | null }>;
    deactivateAppetite: (id: string) => Promise<{ error: string | null }>;
    refreshData: () => Promise<void>;
}

export const useAppetites = (): UseAppetitesReturn => {
    const { user, profile } = useAuth();
    const [myAppetite, setMyAppetite] = useState<BranchAppetite | null>(null);
    const [openCases, setOpenCases] = useState<DbCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAppetiteAndCases = useCallback(async () => {
        // Only bankers should fetch this data
        if (!user || profile?.role !== 'bank') {
            setMyAppetite(null);
            setOpenCases([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Fetch active appetite for the current banker
            const { data: appetiteData, error: appetiteError } = await supabase
                .from('branch_appetites')
                .select('*')
                .eq('banker_id', user.id)
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (appetiteError) throw new Error(mapDatabaseError(appetiteError));
            setMyAppetite(appetiteData as BranchAppetite | null);

            // 2. Fetch open cases (anonymous cases from advisors)
            const { data: casesData, error: casesError } = await supabase
                .from('cases')
                .select('*')
                .eq('status', 'open')
                .order('created_at', { ascending: false });

            if (casesError) throw new Error(mapDatabaseError(casesError));
            setOpenCases((casesData ?? []) as unknown as DbCase[]);
        } catch (err: any) {
            setError(err.message || 'Error fetching data');
        } finally {
            setLoading(false);
        }
    }, [user, profile]);

    // Auto-fetch on mount and when auth state changes
    useEffect(() => {
        fetchAppetiteAndCases();
    }, [fetchAppetiteAndCases]);

    const upsertAppetite = async (data: UpsertAppetiteData): Promise<{ error: string | null }> => {
        if (!user) return { error: 'Not authenticated' };

        // UPSERT: We insert a new record or update existing active one.
        // If an active appetite exists, we update it.
        // If not, we insert a new one.
        try {
            let result;

            if (myAppetite?.id) {
                // Update existing active appetite
                result = await supabase
                    .from('branch_appetites')
                    .update(data)
                    .eq('id', myAppetite.id);
            } else {
                // Insert new appetite
                result = await supabase.from('branch_appetites').insert({
                    ...data,
                    banker_id: user.id,
                    is_active: true,
                });
            }

            if (result.error) throw new Error(mapDatabaseError(result.error));

            await fetchAppetiteAndCases();
            return { error: null };
        } catch (err: any) {
            return { error: err.message || 'Error saving appetite' };
        }
    };

    const deactivateAppetite = async (id: string): Promise<{ error: string | null }> => {
        try {
            const { error: updateError } = await supabase
                .from('branch_appetites')
                .update({ is_active: false })
                .eq('id', id);

            if (updateError) throw new Error(mapDatabaseError(updateError));

            setMyAppetite(null);
            return { error: null };
        } catch (err: any) {
            return { error: err.message || 'Error deactivating appetite' };
        }
    };

    return {
        myAppetite,
        openCases,
        loading,
        error,
        upsertAppetite,
        deactivateAppetite,
        refreshData: fetchAppetiteAndCases,
    };
};

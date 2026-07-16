import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BranchAppetite, UpsertAppetiteData } from '@/types/appetites';
import type { DbCase } from '@/types/cases';
import { mapDatabaseError } from '@/lib/mapDatabaseError';
import { queryKeys } from '@/lib/queryKeys';

interface UseAppetitesReturn {
    myAppetite: BranchAppetite | null;
    openCases: DbCase[];
    loading: boolean;
    error: string | null;
    upsertAppetite: (data: UpsertAppetiteData) => Promise<{ error: string | null }>;
    deactivateAppetite: (id: string) => Promise<{ error: string | null }>;
    refreshData: () => Promise<void>;
}

const fetchMyAppetite = async (userId: string): Promise<BranchAppetite | null> => {
    const { data, error } = await supabase
        .from('branch_appetites')
        .select('*')
        .eq('banker_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    if (error) throw error;
    return data as BranchAppetite | null;
};

const fetchOpenCases = async (): Promise<DbCase[]> => {
    const { data, error } = await supabase
        .from('anonymous_cases')
        .select('*')
        .eq('status', 'open')
        .eq('is_approved', true)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as DbCase[];
};

export const useAppetites = (): UseAppetitesReturn => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const isBank = !!user && profile?.role === 'bank';

    const appetiteKey = queryKeys.appetiteMine(user?.id);
    const openCasesKey = queryKeys.appetiteOpenCases(user?.id);

    const appetiteQuery = useQuery({
        queryKey: appetiteKey,
        queryFn: () => fetchMyAppetite(user!.id),
        enabled: isBank,
    });

    const openCasesQuery = useQuery({
        queryKey: openCasesKey,
        queryFn: fetchOpenCases,
        enabled: isBank,
    });

    const invalidateBoth = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: appetiteKey }),
        queryClient.invalidateQueries({ queryKey: openCasesKey }),
    ]);

    const upsertMutation = useMutation({
        mutationFn: async (data: UpsertAppetiteData) => {
            if (!user) throw new Error('Not authenticated');
            const existing = appetiteQuery.data;
            const result = existing?.id
                ? await supabase
                    .from('branch_appetites')
                    .update({ ...data, is_approved: false, is_active: true })
                    .eq('id', existing.id)
                : await supabase
                    .from('branch_appetites')
                    .insert({ ...data, banker_id: user.id, is_active: true });
            if (result.error) throw result.error;
        },
        onSuccess: () => invalidateBoth(),
    });

    const deactivateMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('branch_appetites')
                .update({ is_active: false })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: appetiteKey }),
    });

    const upsertAppetite = async (data: UpsertAppetiteData): Promise<{ error: string | null }> => {
        try {
            await upsertMutation.mutateAsync(data);
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const deactivateAppetite = async (id: string): Promise<{ error: string | null }> => {
        try {
            await deactivateMutation.mutateAsync(id);
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const error = appetiteQuery.isError
        ? mapDatabaseError(appetiteQuery.error)
        : openCasesQuery.isError
            ? mapDatabaseError(openCasesQuery.error)
            : null;

    return {
        myAppetite: appetiteQuery.data ?? null,
        openCases: openCasesQuery.data ?? [],
        loading: isBank && (appetiteQuery.isLoading || openCasesQuery.isLoading),
        error,
        upsertAppetite,
        deactivateAppetite,
        refreshData: async () => { await invalidateBoth(); },
    };
};

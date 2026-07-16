import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { DbCase, CreateCaseData, CasePriorities } from '@/types/cases';
import { mapDatabaseError } from '@/lib/mapDatabaseError';
import { queryKeys } from '@/lib/queryKeys';

interface UseCasesReturn {
    cases: DbCase[];
    loading: boolean;
    error: string | null;
    createCase: (data: CreateCaseData) => Promise<{ error: string | null }>;
    updateCaseStatus: (id: string, status: DbCase['status']) => Promise<{ error: string | null }>;
    refreshCases: () => Promise<void>;
}

const fetchCasesForUser = async (userId: string, role: string): Promise<DbCase[]> => {
    let query = supabase
        .from('cases')
        .select('*')
        .order('created_at', { ascending: false });

    // UX query optimization only — actual row filtering enforced by RLS policies on the cases table
    if (role === 'advisor') {
        query = query.eq('advisor_id', userId);
    } else {
        query = query.eq('status', 'open');
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []).map((row) => ({
        ...row,
        priorities: (row.priorities ?? { speed: false, rate: false, ltv: false }) as unknown as CasePriorities,
        status: row.status as DbCase['status'],
        borrower_type: row.borrower_type as DbCase['borrower_type'],
    })) as DbCase[];
};

export const useCases = (): UseCasesReturn => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const queryKey = queryKeys.cases(user?.id, profile?.role);

    const query = useQuery({
        queryKey,
        queryFn: () => fetchCasesForUser(user!.id, profile!.role),
        enabled: !!user && !!profile,
    });

    const createCaseMutation = useMutation({
        mutationFn: async (data: CreateCaseData) => {
            if (!user) throw new Error('Not authenticated');
            const { error } = await supabase.from('cases').insert([{
                loan_amount_min: data.loan_amount_min,
                loan_amount_max: data.loan_amount_max,
                ltv: data.ltv,
                borrower_type: data.borrower_type,
                property_type: data.property_type,
                region: data.region,
                priorities: data.priorities as unknown as Record<string, boolean>,
                is_anonymous: data.is_anonymous,
                advisor_id: user.id,
                status: 'open',
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            return queryClient.invalidateQueries({ queryKey });
        },
    });

    const updateCaseStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: DbCase['status'] }) => {
            const { error } = await supabase.from('cases').update({ status }).eq('id', id);
            if (error) throw error;
        },
        onSuccess: (_result, { id, status }) => {
            // Immediate optimistic patch, then invalidate to re-sync with the server
            queryClient.setQueryData<DbCase[]>(queryKey, (prev) =>
                prev ? prev.map((c) => (c.id === id ? { ...c, status } : c)) : prev
            );
            return queryClient.invalidateQueries({ queryKey });
        },
    });

    const createCase = async (data: CreateCaseData): Promise<{ error: string | null }> => {
        try {
            await createCaseMutation.mutateAsync(data);
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const updateCaseStatus = async (id: string, status: DbCase['status']): Promise<{ error: string | null }> => {
        try {
            await updateCaseStatusMutation.mutateAsync({ id, status });
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    return {
        cases: query.data ?? [],
        loading: query.isLoading,
        error: query.isError ? mapDatabaseError(query.error) : null,
        createCase,
        updateCaseStatus,
        refreshCases: async () => { await query.refetch(); },
    };
};

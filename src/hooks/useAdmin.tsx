import { useCallback, useState } from 'react';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, Profile, UserRole } from '@/hooks/useAuth';
import type { DbCase } from '@/types/cases';
import type { BranchAppetite } from '@/types/appetites';
import { mapDatabaseError } from '@/lib/mapDatabaseError';
import { queryKeys } from '@/lib/queryKeys';

export interface AdminStats {
    totalAdvisors: number;
    totalBankers: number;
    openCases: number;
    totalMatches: number;
    closedMatches: number;
}

export const ADMIN_PAGE_SIZE = 20;

const ZERO_STATS: AdminStats = {
    totalAdvisors: 0, totalBankers: 0, openCases: 0, totalMatches: 0, closedMatches: 0,
};

// ─── Fetchers (mirror the queries the hand-rolled hook used) ────────────────────

const fetchPendingUsers = async (): Promise<Profile[]> => {
    const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, company, role, is_approved, created_at')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as Profile[];
};

const fetchAllUsers = async (page: number): Promise<{ rows: Profile[]; count: number }> => {
    const from = page * ADMIN_PAGE_SIZE;
    const to = from + ADMIN_PAGE_SIZE - 1;
    const { data, error, count } = await supabase
        .from('profiles')
        .select('user_id, full_name, company, role, is_approved, created_at', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);
    if (error) throw error;
    return { rows: (data ?? []) as unknown as Profile[], count: count ?? 0 };
};

const fetchPendingCases = async (): Promise<DbCase[]> => {
    const { data, error } = await (supabase
        .from('cases')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false })) as any;
    if (error) throw error;
    return (data ?? []) as unknown as DbCase[];
};

const fetchPendingAppetites = async (): Promise<BranchAppetite[]> => {
    const { data, error } = await (supabase
        .from('branch_appetites')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false })) as any;
    if (error) throw error;
    return (data ?? []) as unknown as BranchAppetite[];
};

const fetchStats = async (): Promise<AdminStats> => {
    const [
        { count: advCount },
        { count: bankCount },
        { count: openCount },
        { count: matchCount },
        { count: closedCount },
    ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'advisor').eq('is_approved', true),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'bank').eq('is_approved', true),
        supabase.from('cases').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('is_approved', true),
        supabase.from('matches').select('*', { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
    ]) as any;
    return {
        totalAdvisors: advCount || 0,
        totalBankers: bankCount || 0,
        openCases: openCount || 0,
        totalMatches: matchCount || 0,
        closedMatches: closedCount || 0,
    };
};

export const useAdmin = () => {
    const { user, profile } = useAuth();
    const queryClient = useQueryClient();
    const userId = user?.id;
    const isAdmin = profile?.role === 'admin';

    const [allUsersPage, setAllUsersPage] = useState(0);

    // UX guard only — actual authorization enforced by RLS policies (is_admin() SECURITY DEFINER function)
    const checkAdmin = () => {
        if (profile?.role !== 'admin') {
            if (import.meta.env.DEV) console.warn('Unauthorized: useAdmin hook requires admin role.');
            return false;
        }
        return true;
    };

    const pendingUsersQuery = useQuery({
        queryKey: queryKeys.admin.pendingUsers(userId),
        queryFn: fetchPendingUsers,
        enabled: isAdmin,
    });

    const allUsersQuery = useQuery({
        queryKey: queryKeys.admin.allUsers(userId, allUsersPage),
        queryFn: () => fetchAllUsers(allUsersPage),
        enabled: isAdmin,
        placeholderData: keepPreviousData,
    });

    const pendingCasesQuery = useQuery({
        queryKey: queryKeys.admin.pendingCases(userId),
        queryFn: fetchPendingCases,
        enabled: isAdmin,
    });

    const pendingAppetitesQuery = useQuery({
        queryKey: queryKeys.admin.pendingAppetites(userId),
        queryFn: fetchPendingAppetites,
        enabled: isAdmin,
    });

    const statsQuery = useQuery({
        queryKey: queryKeys.admin.stats(userId),
        queryFn: fetchStats,
        enabled: isAdmin,
    });

    // Invalidate every admin query for this user (all keys share the ['admin', userId] prefix)
    const invalidateAdmin = useCallback(
        () => queryClient.invalidateQueries({ queryKey: ['admin', userId ?? 'anon'] }),
        [queryClient, userId],
    );

    // Wrap a mutating admin action: guard, run, invalidate, map errors to the {error} contract.
    const runAction = async (fn: () => Promise<void>): Promise<{ error: string | null }> => {
        if (!checkAdmin()) return { error: 'Unauthorized' };
        try {
            await fn();
            await invalidateAdmin();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    // -- User Actions --
    const approveUser = (userId: string) => runAction(async () => {
        const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('user_id', userId);
        if (error) throw error;
    });

    const suspendUser = (userId: string) => runAction(async () => {
        const { error } = await supabase.from('profiles').update({ is_approved: false }).eq('user_id', userId);
        if (error) throw error;
    });

    const changeUserRole = (userId: string, role: UserRole) => runAction(async () => {
        const { error } = await supabase.from('profiles').update({ role }).eq('user_id', userId);
        if (error) throw error;
    });

    // -- Case Actions --
    const approveCase = (caseId: string) => runAction(async () => {
        const { error } = await supabase.from('cases').update({ is_approved: true }).eq('id', caseId);
        if (error) throw error;
    });

    const rejectCase = (caseId: string) => runAction(async () => {
        const { error } = await supabase
            .from('cases')
            .update({ status: 'rejected', is_approved: false })
            .eq('id', caseId);
        if (error) throw error;
    });

    // -- Appetite Actions --
    const approveAppetite = (appetiteId: string) => runAction(async () => {
        const { error } = await supabase.from('branch_appetites').update({ is_approved: true, is_active: true }).eq('id', appetiteId);
        if (error) throw error;
    });

    const rejectAppetite = (appetiteId: string) => runAction(async () => {
        // Mark as approved (out of queue) but inactive (rejected)
        const { error: updateError } = await supabase
            .from('branch_appetites')
            .update({ is_approved: true, is_active: false })
            .eq('id', appetiteId);
        if (updateError) throw updateError;

        // Invoke Edge Function for notification
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-banker-appetite-rejected`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ appetiteId }),
            }
        );
    });

    const deleteUser = (userId: string) => runAction(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ userId }),
            }
        );
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || 'Failed to delete user');
        }
    });

    const loading = isAdmin && (
        pendingUsersQuery.isLoading ||
        allUsersQuery.isLoading ||
        pendingCasesQuery.isLoading ||
        pendingAppetitesQuery.isLoading ||
        statsQuery.isLoading
    );

    return {
        pendingUsers: pendingUsersQuery.data ?? [],
        allUsers: allUsersQuery.data?.rows ?? [],
        allUsersTotalCount: allUsersQuery.data?.count ?? 0,
        allUsersPage,
        setAllUsersPage,
        pendingCases: pendingCasesQuery.data ?? [],
        pendingAppetites: pendingAppetitesQuery.data ?? [],
        stats: statsQuery.data ?? ZERO_STATS,
        loading,
        approveUser,
        suspendUser,
        deleteUser,
        changeUserRole,
        approveCase,
        rejectCase,
        approveAppetite,
        rejectAppetite,
        refreshAll: invalidateAdmin,
    };
};

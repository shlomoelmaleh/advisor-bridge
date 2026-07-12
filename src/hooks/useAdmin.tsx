import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, Profile, UserRole } from '@/hooks/useAuth';
import type { DbCase } from '@/types/cases';
import type { BranchAppetite } from '@/types/appetites';
import { mapDatabaseError } from '@/lib/mapDatabaseError';

export interface AdminStats {
    totalAdvisors: number;
    totalBankers: number;
    openCases: number;
    totalMatches: number;
    closedMatches: number;
}

export const ADMIN_PAGE_SIZE = 20;

export const useAdmin = () => {
    const { profile } = useAuth();

    const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
    const [allUsersTotalCount, setAllUsersTotalCount] = useState(0);
    const [allUsersPage, setAllUsersPage] = useState(0);
    const [pendingCases, setPendingCases] = useState<DbCase[]>([]);
    const [pendingAppetites, setPendingAppetites] = useState<BranchAppetite[]>([]);
    const [stats, setStats] = useState<AdminStats>({
        totalAdvisors: 0,
        totalBankers: 0,
        openCases: 0,
        totalMatches: 0,
        closedMatches: 0,
    });
    const [loading, setLoading] = useState(true);
    const initialized = useRef(false);

    // UX guard only — actual authorization enforced by RLS policies (is_admin() SECURITY DEFINER function)
    const checkAdmin = () => {
        if (profile?.role !== 'admin') {
            console.warn('Unauthorized: useAdmin hook requires admin role.');
            return false;
        }
        return true;
    };

    const fetchAll = useCallback(async () => {
        if (!checkAdmin()) {
            setLoading(false);
            return;
        }

        if (!initialized.current) {
            setLoading(true);
            initialized.current = true;
        }
        try {
            // 1a. Pending users — separate query (inherently small, no pagination needed)
            const { data: pendingProfiles, error: pendingProfilesError } = await supabase
                .from('profiles')
                .select('user_id, full_name, company, role, is_approved, created_at')
                .eq('is_approved', false)
                .order('created_at', { ascending: false });

            if (pendingProfilesError) throw pendingProfilesError;
            setPendingUsers((pendingProfiles ?? []) as unknown as Profile[]);

            // 1b. All users — paginated
            const from = allUsersPage * ADMIN_PAGE_SIZE;
            const to = from + ADMIN_PAGE_SIZE - 1;
            const { data: profiles, error: profilesError, count } = await supabase
                .from('profiles')
                .select('user_id, full_name, company, role, is_approved, created_at', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (profilesError) throw profilesError;
            setAllUsers((profiles ?? []) as unknown as Profile[]);
            setAllUsersTotalCount(count ?? 0);

            // 2. Fetch Pending Cases
            const { data: casesData, error: casesError } = await (supabase
                .from('cases')
                .select('*')
                .eq('is_approved', false)
                .order('created_at', { ascending: false })) as any;

            if (casesError) throw casesError;
            setPendingCases((casesData ?? []) as unknown as DbCase[]);

            // 3. Fetch Pending Appetites
            const { data: appetitesData, error: appetitesError } = await (supabase
                .from('branch_appetites')
                .select('*')
                .eq('is_approved', false)
                .order('created_at', { ascending: false })) as any;

            if (appetitesError) throw appetitesError;
            setPendingAppetites((appetitesData ?? []) as unknown as BranchAppetite[]);

            // 4. Fetch Stats Data
            // Use concurrent count queries to compute stats efficiently
            const [
                { count: advCount },
                { count: bankCount },
                { count: openCount },
                { count: matchCount },
                { count: closedCount }
            ] = await Promise.all([
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'advisor').eq('is_approved', true),
                supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'bank').eq('is_approved', true),
                supabase.from('cases').select('*', { count: 'exact', head: true }).eq('status', 'open').eq('is_approved', true),
                supabase.from('matches').select('*', { count: 'exact', head: true }),
                supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'closed')
            ]) as any;

            setStats({
                totalAdvisors: advCount || 0,
                totalBankers: bankCount || 0,
                openCases: openCount || 0,
                totalMatches: matchCount || 0,
                closedMatches: closedCount || 0,
            });

        } catch (err: unknown) {
            console.error(mapDatabaseError(err));
        } finally {
            setLoading(false);
        }
    }, [profile, allUsersPage]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    // -- User Actions --

    const approveUser = async (userId: string) => {
        if (!checkAdmin()) return { error: 'Unauthorized' };
        try {
            const { error } = await supabase.from('profiles').update({ is_approved: true }).eq('user_id', userId);
            if (error) throw error;
            await fetchAll();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const suspendUser = async (userId: string) => {
        if (!checkAdmin()) return { error: 'Unauthorized' };
        try {
            const { error } = await supabase.from('profiles').update({ is_approved: false }).eq('user_id', userId);
            if (error) throw error;
            await fetchAll();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const changeUserRole = async (userId: string, role: UserRole) => {
        if (!checkAdmin()) return { error: 'Unauthorized' };
        try {
            const { error } = await supabase.from('profiles').update({ role }).eq('user_id', userId);
            if (error) throw error;
            await fetchAll();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    // -- Case Actions --

    const approveCase = async (caseId: string) => {
        if (!checkAdmin()) return { error: 'Unauthorized' };
        try {
            const { error } = await supabase.from('cases').update({ is_approved: true }).eq('id', caseId);
            if (error) throw error;
            await fetchAll();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const rejectCase = async (caseId: string) => {
        if (!checkAdmin()) return { error: 'Unauthorized' };
        try {
            const { error } = await supabase
                .from('cases')
                .update({ status: 'rejected', is_approved: false })
                .eq('id', caseId);
            if (error) throw error;
            await fetchAll();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    // -- Appetite Actions --

    const approveAppetite = async (appetiteId: string) => {
        if (!checkAdmin()) return { error: 'Unauthorized' };
        console.log(`Approving appetite ${appetiteId} and setting is_active=true`);
        try {
            const { error } = await supabase.from('branch_appetites').update({ is_approved: true, is_active: true }).eq('id', appetiteId);
            if (error) throw error;
            await fetchAll();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const rejectAppetite = async (appetiteId: string) => {
        if (!checkAdmin()) return { error: 'Unauthorized' };
        try {
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

            await fetchAll();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    const deleteUser = async (userId: string) => {
        if (!checkAdmin()) return { error: 'Unauthorized' };
        try {
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

            await fetchAll();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    return {
        pendingUsers,
        allUsers,
        allUsersTotalCount,
        allUsersPage,
        setAllUsersPage,
        pendingCases,
        pendingAppetites,
        stats,
        loading,
        approveUser,
        suspendUser,
        deleteUser,
        changeUserRole,
        approveCase,
        rejectCase,
        approveAppetite,
        rejectAppetite,
        refreshAll: fetchAll
    };
};

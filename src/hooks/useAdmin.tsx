import { useState, useEffect, useCallback } from 'react';
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

export const useAdmin = () => {
    const { profile } = useAuth();

    const [pendingUsers, setPendingUsers] = useState<Profile[]>([]);
    const [allUsers, setAllUsers] = useState<Profile[]>([]);
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

        setLoading(true);
        try {
            // 1. Fetch Users
            const { data: profiles, error: profilesError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profilesError) throw profilesError;

            const allProfiles = profiles as Profile[];
            setAllUsers(allProfiles);
            setPendingUsers(allProfiles.filter(p => p.is_approved === false));

            // 2. Fetch Pending Cases
            const { data: casesData, error: casesError } = await supabase
                .from('cases')
                .select('*')
                .eq('is_approved', false)
                .order('created_at', { ascending: false });

            if (casesError) throw casesError;
            setPendingCases(casesData as DbCase[]);

            // 3. Fetch Pending Appetites
            const { data: appetitesData, error: appetitesError } = await supabase
                .from('branch_appetites')
                .select('*')
                .eq('is_approved', false)
                .order('created_at', { ascending: false });

            if (appetitesError) throw appetitesError;
            setPendingAppetites(appetitesData as BranchAppetite[]);

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
            ]);

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
    }, [profile]);

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
            const { error } = await supabase.from('cases').delete().eq('id', caseId);
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
        try {
            const { error } = await supabase.from('branch_appetites').update({ is_approved: true }).eq('id', appetiteId);
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
            const { error } = await supabase.from('branch_appetites').update({ is_approved: false, is_active: false }).eq('id', appetiteId);
            if (error) throw error;
            await fetchAll();
            return { error: null };
        } catch (err: unknown) {
            return { error: mapDatabaseError(err) };
        }
    };

    return {
        pendingUsers,
        allUsers,
        pendingCases,
        pendingAppetites,
        stats,
        loading,
        approveUser,
        suspendUser,
        changeUserRole,
        approveCase,
        rejectCase,
        approveAppetite,
        rejectAppetite,
        refreshAll: fetchAll
    };
};

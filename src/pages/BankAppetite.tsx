import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
    Plus,
    Trash2,
    Save,
    ChevronRight,
    Activity,
    DollarSign,
    Clock,
    ShieldCheck,
    Building2
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';

interface AppetiteSignal {
    id: string;
    bank_name: string;
    branch_name: string | null;
    banker_id: string | null;
    is_active: boolean;
    max_ltv: number | null;
    min_loan_amount: number | null;
    sla_days: number | null;
    appetite_level: string | null;
    preferred_borrower_types: string[] | null;
    preferred_regions: string[] | null;
    is_approved: boolean | null;
}

const BankAppetite = () => {
    const { user, profile, profileState } = useAuth();
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);

    // ─── Data Fetching ────────────────────────────────────────────────────────
    const { data: appetites, isLoading, error } = useQuery({
        queryKey: ['bank-appetites', user?.id],
        queryFn: async () => {
            if (!user) return [];
            const { data, error } = await supabase
                .from('branch_appetites')
                .select('*')
                .eq('banker_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as AppetiteSignal[];
        },
        enabled: !!user,
    });

    // ─── Mutations ─────────────────────────────────────────────────────────────
    const updateMutation = useMutation({
        mutationFn: async (updated: Partial<AppetiteSignal> & { id: string }) => {
            const { data, error } = await supabase
                .from('branch_appetites')
                .update(updated)
                .eq('id', updated.id)
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-appetites'] });
            toast.success('הגדרות עודכנו בהצלחה');
        },
        onError: (err) => {
            console.error(err);
            toast.error('שגיאה בעדכון ההגדרות');
        }
    });

    const createMutation = useMutation({
        mutationFn: async (newAppetite: Partial<AppetiteSignal>) => {
            if (!user) throw new Error('Not authenticated');
            const { data, error } = await supabase
                .from('branch_appetites')
                .insert([{
                    ...newAppetite,
                    banker_id: user.id,
                    bank_name: profile?.company || 'Unknown Bank',
                    is_active: true
                }])
                .select()
                .single();
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-appetites'] });
            setIsAdding(false);
            toast.success('אות חדש נוסף');
        },
        onError: (err) => {
            console.error(err);
            toast.error('שגיאה ביצירת הגדרות חדשות');
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await supabase
                .from('branch_appetites')
                .delete()
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-appetites'] });
            toast.success('הגדרות נמחקו');
        }
    });

    // ─── Render ────────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                </div>
            </AppLayout>
        );
    }

    if (error) {
        return (
            <AppLayout>
                <div className="container p-8 text-center">
                    <Badge variant="destructive" className="mb-4">שגיאה בטעינת נתונים</Badge>
                    <p className="text-muted-foreground">אנא נסה שוב מאוחר יותר</p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="container mx-auto p-4 sm:p-8 max-w-5xl text-right animate-in fade-in duration-500" dir="rtl">
                <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">אותות תיאבון</h1>
                        <p className="text-muted-foreground mt-1">נהל את קריטריוני המימון שלך ואת החשיפה לתיקים חדשים</p>
                    </div>
                    <Button
                        disabled={profileState === 'pending' || profileState === 'missing'}
                        onClick={() => setIsAdding(true)}
                        className="w-full sm:w-auto gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        הוסף הגדרת תיאבון
                    </Button>
                </header>

                {isAdding && (
                    <Card className="mb-8 border-primary/30 shadow-lg bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-xl">חדש: קריטריון מימון</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                createMutation.mutate({
                                    branch_name: formData.get('branch') as string,
                                    max_ltv: Number(formData.get('ltv')),
                                    min_loan_amount: Number(formData.get('min_loan')),
                                    sla_days: Number(formData.get('sla')),
                                    appetite_level: 'High'
                                });
                            }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">סניף / יחידה</label>
                                    <Input name="branch" placeholder="לדוגמה: עסקי מרכז" required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">מימון מקסימלי (LTV %)</label>
                                    <Input name="ltv" type="number" placeholder="75" required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">סכום מינימלי (₪)</label>
                                    <Input name="min_loan" type="number" placeholder="1000000" required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">זמן תגובה מובטח (ימים)</label>
                                    <Input name="sla" type="number" placeholder="3" required />
                                </div>
                                <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-3 mt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsAdding(false)}>ביטול</Button>
                                    <Button type="submit" disabled={createMutation.isPending}>
                                        {createMutation.isPending ? 'יוצר...' : 'צור הגדרה'}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                )}

                {appetites?.length === 0 && !isAdding ? (
                    <div className="text-center py-20 bg-muted/30 rounded-2xl border-2 border-dashed">
                        <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-20" />
                        <h3 className="text-lg font-semibold">אין אותות פעילים</h3>
                        <p className="text-muted-foreground max-w-sm mx-auto mt-2">
                            הגדר את קריטריוני המימון שלך כדי להתחיל לקבל הצעות רלוונטיות מיועצי משכנתאות
                        </p>
                        <Button variant="outline" className="mt-6" onClick={() => setIsAdding(true)}>
                            הוסף הגדרה ראשונה
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {appetites?.map((item) => (
                            <AppetiteItem
                                key={item.id}
                                item={item}
                                onUpdate={(upd) => updateMutation.mutate({ id: item.id, ...upd })}
                                onDelete={() => deleteMutation.mutate(item.id)}
                                isReadOnly={profileState === 'pending' || profileState === 'missing'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

const AppetiteItem = ({ item, onUpdate, onDelete, isReadOnly }: {
    item: AppetiteSignal,
    onUpdate: (upd: Partial<AppetiteSignal>) => void,
    onDelete: () => void,
    isReadOnly: boolean
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempData, setTempData] = useState(item);

    return (
        <Card className={`transition-all duration-300 hover:shadow-md ${!item.is_active ? 'opacity-70 grayscale-[50%]' : 'border-l-4 border-l-primary'}`}>
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                            <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{item.branch_name || 'סניף כללי'}</CardTitle>
                            <p className="text-xs text-muted-foreground">{item.bank_name}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{item.is_active ? 'פעיל' : 'מושהה'}</span>
                            <Switch
                                checked={item.is_active}
                                onCheckedChange={(val) => onUpdate({ is_active: val })}
                                disabled={isReadOnly}
                            />
                        </div>
                        <Badge variant={item.is_approved ? "outline" : "secondary"} className="h-6">
                            {item.is_approved ? "מאושר" : "בבדיקה"}
                        </Badge>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isEditing ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">LTV %</label>
                            <Input
                                type="number"
                                value={tempData.max_ltv || ''}
                                onChange={(e) => setTempData({ ...tempData, max_ltv: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">מינימום (₪)</label>
                            <Input
                                type="number"
                                value={tempData.min_loan_amount || ''}
                                onChange={(e) => setTempData({ ...tempData, min_loan_amount: Number(e.target.value) })}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">SLA (ימים)</label>
                            <Input
                                type="number"
                                value={tempData.sla_days || ''}
                                onChange={(e) => setTempData({ ...tempData, sla_days: Number(e.target.value) })}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4 mt-2">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">מקסימום LTV</span>
                            <div className="flex items-center gap-1.5 font-semibold">
                                <ShieldCheck className="h-3.5 w-3.5 text-primary/60" />
                                {item.max_ltv}%
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">מימון מינימלי</span>
                            <div className="flex items-center gap-1.5 font-semibold">
                                <DollarSign className="h-3.5 w-3.5 text-primary/60" />
                                ₪{item.min_loan_amount?.toLocaleString()}
                            </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">זמן תגובה (SLA)</span>
                            <div className="flex items-center gap-1.5 font-semibold">
                                <Clock className="h-3.5 w-3.5 text-primary/60" />
                                {item.sla_days} ימים
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
            <CardFooter className="pt-2 border-t mt-4 flex justify-between items-center bg-muted/10 py-3">
                <div className="text-[10px] text-muted-foreground">
                    עודכן לאחרונה: {new Date().toLocaleDateString('he-IL')}
                </div>
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <>
                            <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>ביטול</Button>
                            <Button size="sm" gap-2 onClick={() => {
                                onUpdate(tempData);
                                setIsEditing(false);
                            }}>
                                <Save className="h-3.5 w-3.5" />
                                שמור
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                    if (confirm('בטוח שברצונך למחוק אות זה?')) onDelete();
                                }}
                                disabled={isReadOnly}
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIsEditing(true)}
                                disabled={isReadOnly}
                            >
                                ערוך
                            </Button>
                        </>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
};

export default BankAppetite;

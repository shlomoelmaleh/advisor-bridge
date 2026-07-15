import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
import { appetiteSchema } from '@/lib/validation';
import {
    BORROWER_TYPE_OPTIONS,
    REGION_OPTIONS,
    borrowerTypesLabel,
    regionsLabel,
} from '@/lib/labels';
import AppLayout from '@/components/layout/AppLayout';
import PageHeader from '@/components/common/PageHeader';

/** ISO yyyy-mm-dd for "today + N days" (used for appetite validity). */
const isoDatePlusDays = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().split('T')[0];

const toggleInArray = (value: string, list: string[]): string[] =>
    list.includes(value) ? list.filter((x) => x !== value) : [...list, value];

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
    valid_until: string | null;
    is_approved: boolean | null;
}

const BankAppetite = () => {
    const { user, profile, profileState, signOut } = useAuth();
    const queryClient = useQueryClient();
    const [isAdding, setIsAdding] = useState(false);
    const [editingAppetite, setEditingAppetite] = useState<AppetiteSignal | null>(null);
    const [appetiteLevel, setAppetiteLevel] = useState<'low' | 'medium' | 'high'>('medium');
    const [borrowerTypes, setBorrowerTypes] = useState<string[]>([]);
    const [regions, setRegions] = useState<string[]>([]);
    const [validUntil, setValidUntil] = useState<string>(() => isoDatePlusDays(90));

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
                .update({ ...updated, is_active: true }) // Explicitly set active upon any update/resubmission
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
        mutationFn: async (newAppetite: Partial<AppetiteSignal> & { bank_name: string }) => {
            if (!user) throw new Error('Not authenticated');
            const { data, error } = await supabase
                .from('branch_appetites')
                .insert([{
                    ...newAppetite,
                    banker_id: user.id,
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

    if (profile?.is_approved === false) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
                <div className="text-center space-y-6 max-w-md w-full p-8 border rounded-2xl shadow-sm bg-card">
                    <div className="text-6xl text-center">⏳</div>
                    <h2 className="text-2xl font-bold">החשבון שלך בבדיקה</h2>
                    <p className="text-muted-foreground">
                        מנהל המערכת יאשר את חשבונך בקרוב.
                        תקבל גישה מלאה לפלטפורמה לאחר האישור.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-4 text-sm text-right space-y-1">
                        <p>✅ נרשמת בהצלחה</p>
                        <p>⏳ ממתין לאישור מנהל</p>
                        <p className="text-muted-foreground mt-1">לאחר אישור: גישה מלאה להגדרת ביקוש וקבלת התאמות</p>
                    </div>
                    <Button variant="outline" onClick={() => signOut()} className="w-full">
                        התנתק
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <AppLayout>
            <div className="container mx-auto p-4 sm:p-8 max-w-5xl text-right animate-in fade-in duration-500" dir="rtl">
                <PageHeader
                    className="mb-8"
                    title="ביקושים"
                    subtitle="נהל את קריטריוני המימון שלך ואת החשיפה לתיקים חדשים"
                    action={
                        <Button
                            disabled={profileState === 'pending' || profileState === 'missing'}
                            onClick={() => {
                                setEditingAppetite(null);
                                setAppetiteLevel('medium');
                                setBorrowerTypes([]);
                                setRegions([]);
                                setValidUntil(isoDatePlusDays(90));
                                setIsAdding(true);
                            }}
                            className="w-full sm:w-auto gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            הוסף הגדרת ביקוש
                        </Button>
                    }
                />

                {(isAdding || editingAppetite) && (
                    <Card className="mb-8 border-primary/30 shadow-lg bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-xl">
                                {editingAppetite ? 'עריכת קריטריון קשור (בבדיקה)' : 'חדש: קריטריון מימון'}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                const bankNameVal = (formData.get('bank_name') as string)?.trim() || profile?.company || '';
                                if (!bankNameVal) {
                                    toast.error('נא למלא שם בנק');
                                    return;
                                }
                                const raw = {
                                    bank_name: bankNameVal,
                                    branch_name: (formData.get('branch') as string) || null,
                                    appetite_level: appetiteLevel,
                                    max_ltv: Number(formData.get('ltv')),
                                    min_loan_amount: Number(formData.get('min_loan')),
                                    sla_days: Number(formData.get('sla')),
                                    preferred_borrower_types: borrowerTypes,
                                    preferred_regions: regions,
                                    valid_until: validUntil,
                                };
                                const result = appetiteSchema.safeParse(raw);
                                if (!result.success) {
                                    toast.error(result.error.errors[0]?.message || 'נתונים לא תקינים');
                                    return;
                                }
                                if (editingAppetite) {
                                    updateMutation.mutate({
                                        id: editingAppetite.id,
                                        bank_name: bankNameVal,
                                        branch_name: raw.branch_name,
                                        max_ltv: raw.max_ltv,
                                        min_loan_amount: raw.min_loan_amount,
                                        sla_days: raw.sla_days,
                                        appetite_level: appetiteLevel,
                                        preferred_borrower_types: borrowerTypes,
                                        preferred_regions: regions,
                                        valid_until: validUntil,
                                        is_approved: false, // Always ensure it stays pending upon edit
                                        is_active: true // Ensure it is active (not rejected) when resubmitting
                                    }, {
                                        onSuccess: () => setEditingAppetite(null)
                                    });
                                } else {
                                    createMutation.mutate({
                                        bank_name: bankNameVal,
                                        branch_name: raw.branch_name,
                                        max_ltv: raw.max_ltv,
                                        min_loan_amount: raw.min_loan_amount,
                                        sla_days: raw.sla_days,
                                        appetite_level: appetiteLevel,
                                        preferred_borrower_types: borrowerTypes,
                                        preferred_regions: regions,
                                        valid_until: validUntil,
                                    });
                                }
                            }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">שם בנק</label>
                                    <Input name="bank_name" placeholder="לדוגמה: בנק לאומי" defaultValue={editingAppetite?.bank_name || profile?.company || ''} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">סניף / יחידה</label>
                                    <Input name="branch" placeholder="לדוגמה: עסקי מרכז" defaultValue={editingAppetite?.branch_name || ''} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">מימון מקסימלי (LTV %)</label>
                                    <Input name="ltv" type="number" placeholder="75" defaultValue={editingAppetite?.max_ltv || ''} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">סכום מינימלי (₪)</label>
                                    <Input name="min_loan" type="number" placeholder="1000000" defaultValue={editingAppetite?.min_loan_amount || ''} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">זמן תגובה מובטח (ימים)</label>
                                    <Input name="sla" type="number" placeholder="3" defaultValue={editingAppetite?.sla_days || ''} required />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">תוקף ההגדרה עד</label>
                                    <Input
                                        type="date"
                                        value={validUntil}
                                        min={isoDatePlusDays(1)}
                                        onChange={(e) => setValidUntil(e.target.value)}
                                        required
                                    />
                                    <p className="text-[11px] text-muted-foreground">לאחר תאריך זה האות יפסיק להופיע בהתאמות</p>
                                </div>

                                <div className="space-y-3 md:col-span-2 lg:col-span-4">
                                    <label className="text-sm font-medium">סוגי לווים מועדפים</label>
                                    <p className="text-xs text-muted-foreground -mt-1">לא נבחר = מתאים לכל סוגי הלווים</p>
                                    <div className="flex flex-wrap gap-2">
                                        {BORROWER_TYPE_OPTIONS.map((opt) => {
                                            const active = borrowerTypes.includes(opt.value);
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    aria-pressed={active}
                                                    onClick={() => setBorrowerTypes(toggleInArray(opt.value, borrowerTypes))}
                                                    className={`px-4 py-2 rounded-full border text-sm transition-colors ${active ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border bg-card text-muted-foreground hover:bg-accent'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-3 md:col-span-2 lg:col-span-4">
                                    <label className="text-sm font-medium">אזורים מועדפים</label>
                                    <p className="text-xs text-muted-foreground -mt-1">לא נבחר = מתאים לכל האזורים</p>
                                    <div className="flex flex-wrap gap-2">
                                        {REGION_OPTIONS.map((opt) => {
                                            const active = regions.includes(opt.value);
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    aria-pressed={active}
                                                    onClick={() => setRegions(toggleInArray(opt.value, regions))}
                                                    className={`px-4 py-2 rounded-full border text-sm transition-colors ${active ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border bg-card text-muted-foreground hover:bg-accent'}`}
                                                >
                                                    {opt.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="space-y-4 md:col-span-2 lg:col-span-4">
                                    <label className="text-sm font-medium">רמת ביקוש (כמה אתה מחפש עסקאות כרגע?)</label>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {[
                                            { id: 'low', label: 'נמוך', color: 'border-red-500 bg-red-50', icon: '🔴', desc: 'הסניף עמוס, פחות עסקאות' },
                                            { id: 'medium', label: 'בינוני', color: 'border-yellow-500 bg-yellow-50', icon: '🟡', desc: 'עסק כרגיל' },
                                            { id: 'high', label: 'גבוה', color: 'border-green-500 bg-green-50', icon: '🟢', desc: 'רעבים לעסקאות חדשות' }
                                        ].map((level) => (
                                            <div
                                                key={level.id}
                                                onClick={() => setAppetiteLevel(level.id as any)}
                                                className={`cursor-pointer border-2 rounded-xl p-4 transition-all hover:shadow-md flex flex-col items-center text-center gap-1 ${appetiteLevel === level.id ? `${level.color} shadow-sm scale-[1.02]` : 'border-muted bg-card hover:border-muted-foreground/30'
                                                    }`}
                                            >
                                                <span className="text-xl mb-1">{level.icon}</span>
                                                <span className={`font-bold ${appetiteLevel === level.id ? 'text-foreground' : 'text-muted-foreground'}`}>{level.label}</span>
                                                <span className="text-xs text-muted-foreground opacity-80">{level.desc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="md:col-span-2 lg:col-span-4 flex justify-end gap-3 mt-4">
                                    <Button type="button" variant="outline" onClick={() => {
                                        setIsAdding(false);
                                        setEditingAppetite(null);
                                    }}>ביטול</Button>
                                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                        {createMutation.isPending || updateMutation.isPending ? 'שומר...' : (editingAppetite ? 'שמור שינויים' : 'צור הגדרה')}
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
                                onEdit={() => {
                                    setEditingAppetite(item);
                                    setAppetiteLevel((item.appetite_level as any) || 'medium');
                                    setBorrowerTypes(item.preferred_borrower_types ?? []);
                                    setRegions(item.preferred_regions ?? []);
                                    setValidUntil(item.valid_until ?? isoDatePlusDays(90));
                                    setIsAdding(false); // Make sure it's the edit mode
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                isReadOnly={profileState === 'pending' || profileState === 'missing'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

const AppetiteItem = ({ item, onUpdate, onDelete, onEdit, isReadOnly }: {
    item: AppetiteSignal,
    onUpdate: (upd: Partial<AppetiteSignal>) => void,
    onDelete: () => void,
    onEdit: () => void,
    isReadOnly: boolean
}) => {
    // Validity / expiry — surfaced so a banker knows when their signal stops
    // appearing in matches (the engine filters on valid_until >= today).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const validUntilDate = item.valid_until ? new Date(item.valid_until) : null;
    const isExpired = !!validUntilDate && validUntilDate < today;
    const daysLeft = validUntilDate
        ? Math.ceil((validUntilDate.getTime() - today.getTime()) / 86400000)
        : null;
    const isExpiringSoon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 14;
    const validUntilStr = validUntilDate ? validUntilDate.toLocaleDateString('he-IL') : '—';

    // Editable when the signal is rejected (approved + inactive) or expired.
    const canEdit = !isReadOnly && ((item.is_approved && !item.is_active) || isExpired);

    return (
        <Card className="transition-all duration-300 hover:shadow-md border-r-4 border-r-primary">
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
                    <div className="flex items-center gap-2">
                        {!item.is_approved ? (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200">בבדיקה</Badge>
                        ) : !item.is_active ? (
                            <Badge variant="destructive">נדחה</Badge>
                        ) : isExpired ? (
                            <Badge className="bg-gray-200 text-gray-700 border-gray-300">פג תוקף</Badge>
                        ) : (
                            <Badge className="bg-green-100 text-green-800 border-green-200">פעיל</Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
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
                <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">אזורים מועדפים</span>
                        <span className="text-sm">{regionsLabel(item.preferred_regions) || 'כל האזורים'}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">סוגי לווים</span>
                        <span className="text-sm">{borrowerTypesLabel(item.preferred_borrower_types) || 'כל הסוגים'}</span>
                    </div>
                </div>
                {isExpired ? (
                    <div className="mt-4 p-2.5 bg-red-50 border border-red-200 rounded-md text-red-800 text-xs font-medium flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        פג תוקף ב-{validUntilStr} — האות אינו מופיע בהתאמות. ערוך כדי לחדש.
                    </div>
                ) : isExpiringSoon && (
                    <div className="mt-4 p-2.5 bg-amber-50 border border-amber-200 rounded-md text-amber-800 text-xs font-medium flex items-center gap-2">
                        <Clock className="h-3.5 w-3.5" />
                        התוקף יפוג בעוד {daysLeft} ימים ({validUntilStr}).
                    </div>
                )}
            </CardContent>
            <CardFooter className="pt-2 border-t mt-4 flex justify-between items-center bg-muted/10 py-3">
                <div className="text-[10px] text-muted-foreground">
                    תוקף עד: {validUntilStr}
                </div>
                <div className="flex items-center gap-2">
                            {/* Editable when rejected or expired */}
                            {canEdit && (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground hover:text-primary hover:bg-primary/10"
                                    onClick={onEdit}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>
                                    <span className="mr-1">ערוך</span>
                                </Button>
                            )}
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
                </div>
            </CardFooter>
        </Card>
    );
};

export default BankAppetite;

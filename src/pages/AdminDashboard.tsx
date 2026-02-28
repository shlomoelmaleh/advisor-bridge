import React, { useState } from 'react';
import { useAdmin } from '@/hooks/useAdmin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Users, Briefcase, Activity, CheckCircle, Ban, RefreshCw, Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { UserRole } from '@/hooks/useAuth';

const AdminDashboard = () => {
    const {
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
        refreshAll
    } = useAdmin();

    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const handleAction = async (id: string, action: () => Promise<{ error: string | null }>, successMsg: string) => {
        setActionLoading(id);
        const { error } = await action();
        setActionLoading(null);
        if (error) toast.error(`פעולה נכשלה: ${error}`);
        else toast.success(successMsg);
    };

    if (loading && allUsers.length === 0) {
        return <div className="p-8 space-y-4 max-w-6xl mx-auto"><Skeleton className="h-64 w-full" /></div>;
    }

    // Role badge color helper
    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'advisor': return <Badge className="bg-blue-500 hover:bg-blue-600">יועץ</Badge>;
            case 'bank': return <Badge className="bg-green-500 hover:bg-green-600">בנקאי</Badge>;
            case 'admin': return <Badge className="bg-red-500 hover:bg-red-600">מנהל</Badge>;
            default: return <Badge variant="outline">{role}</Badge>;
        }
    };

    return (
        <div className="container max-w-7xl py-8 space-y-8 animate-fade-in">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <ShieldAlert className="h-8 w-8 text-primary" />
                        לוח בקרה - ניהול מערכת
                    </h1>
                    <p className="text-muted-foreground mt-2">פיקוח על משתמשים, תיקים ופעילות המערכת.</p>
                </div>
                <Button variant="outline" onClick={refreshAll} className="gap-2">
                    <RefreshCw className="h-4 w-4" /> רענן נתונים
                </Button>
            </div>

            <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-8">
                    <TabsTrigger value="overview">סקירה כללית</TabsTrigger>
                    <TabsTrigger value="pending-users">
                        משתמשים ליאשור
                        {pendingUsers.length > 0 && (
                            <Badge variant="destructive" className="mr-2 ml-0 rounded-full">{pendingUsers.length}</Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="all-users">כל המשתמשים</TabsTrigger>
                    <TabsTrigger value="pending-content">
                        תוכן לאישור
                        {(pendingCases.length + pendingAppetites.length) > 0 && (
                            <Badge variant="destructive" className="mr-2 ml-0 rounded-full">
                                {pendingCases.length + pendingAppetites.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: Overview */}
                <TabsContent value="overview">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">יועצים פעילים</CardTitle>
                                <Users className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalAdvisors}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">בנקאים פעילים</CardTitle>
                                <Briefcase className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalBankers}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">תיקים פתוחים</CardTitle>
                                <Activity className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.openCases}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">שידוכים מוצלחים</CardTitle>
                                <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.closedMatches} <span className="text-sm font-normal text-muted-foreground">/ {stats.totalMatches}</span></div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* TAB 2: Pending Users */}
                <TabsContent value="pending-users">
                    <Card>
                        <CardHeader>
                            <CardTitle>משתמשים ממתינים לאישור</CardTitle>
                            <CardDescription>משתמשים שנרשמו לאחרונה וטרם אושרו במערכת.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {pendingUsers.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">אין משתמשים ממתינים.</div>
                            ) : (
                                <div className="space-y-4">
                                    {pendingUsers.map(u => (
                                        <div key={u.user_id} className="flex flex-col sm:flex-row justify-between items-center p-4 border rounded-lg bg-card">
                                            <div className="mb-4 sm:mb-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold">{u.full_name || 'אנונימי'}</span>
                                                    {getRoleBadge(u.role)}
                                                </div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                                    <span>{u.company || 'ללא חברה'}</span>
                                                    <span>•</span>
                                                    <span className="text-xs">הצטרף לאחרונה</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    className="border-destructive text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleAction(u.user_id, () => suspendUser(u.user_id), 'משתמש נדחה')}
                                                    disabled={actionLoading === u.user_id}
                                                >
                                                    <Ban className="h-4 w-4 mr-2" /> דחה
                                                </Button>
                                                <Button
                                                    className="bg-green-600 hover:bg-green-700"
                                                    onClick={() => handleAction(u.user_id, () => approveUser(u.user_id), 'משתמש אושר בהצלחה')}
                                                    disabled={actionLoading === u.user_id}
                                                >
                                                    <CheckCircle2 className="h-4 w-4 mr-2" /> אשר
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 3: All Users */}
                <TabsContent value="all-users">
                    <Card>
                        <CardHeader>
                            <CardTitle>כל המשתמשים</CardTitle>
                            <CardDescription>ניהול כלל המשתמשים הרשומים בפלטפורמה.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border overflow-x-auto">
                                <table className="w-full text-sm text-left rtl:text-right">
                                    <thead className="text-xs text-muted-foreground bg-muted/50">
                                        <tr>
                                            <th className="px-4 py-3 font-medium">שם משתמש</th>
                                            <th className="px-4 py-3 font-medium">חברה / סניף</th>
                                            <th className="px-4 py-3 font-medium text-center">תפקיד</th>
                                            <th className="px-4 py-3 font-medium text-center">סטטוס</th>
                                            <th className="px-4 py-3 font-medium text-left">פעולות</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {allUsers.map((u) => (
                                            <tr key={u.user_id} className="bg-card hover:bg-accent/30 transition-colors">
                                                <td className="px-4 py-3 font-medium">{u.full_name || '—'}</td>
                                                <td className="px-4 py-3 text-muted-foreground">{u.company || '—'}</td>
                                                <td className="px-4 py-3 text-center">{getRoleBadge(u.role)}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {u.is_approved ? (
                                                        <span className="text-green-600 font-medium text-xs">פעיל</span>
                                                    ) : (
                                                        <span className="text-red-500 font-medium text-xs">ממתין/מושעה</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-left">
                                                    {u.role !== 'admin' && (
                                                        <>
                                                            {u.is_approved ? (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                                    onClick={() => handleAction(u.user_id + 'susp', () => suspendUser(u.user_id), 'משתמש הושעה')}
                                                                    disabled={actionLoading === u.user_id + 'susp'}
                                                                >
                                                                    השעה חשבון
                                                                </Button>
                                                            ) : (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="text-green-600 hover:text-green-700 hover:bg-green-600/10"
                                                                    onClick={() => handleAction(u.user_id + 'appr', () => approveUser(u.user_id), 'משתמש אושר/שוחזר')}
                                                                    disabled={actionLoading === u.user_id + 'appr'}
                                                                >
                                                                    שחזר ציוות / אשר
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* TAB 4: Pending Content */}
                <TabsContent value="pending-content">
                    <div className="grid gap-6 md:grid-cols-2">
                        {/* Pending Cases */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">תיקים ממתינים השגחה</CardTitle>
                                <CardDescription>תיקים חדשים לפני פרסום לבנקים.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {pendingCases.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground bg-accent/20 rounded-lg">אין תיקים ממתינים.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {pendingCases.map(c => (
                                            <div key={c.id} className="p-4 border rounded-lg bg-card text-sm">
                                                <div className="font-bold whitespace-nowrap overflow-hidden text-ellipsis mb-2">
                                                    ₪{(c.loan_amount_min / 1_000_000).toFixed(1)}M - ₪{(c.loan_amount_max / 1_000_000).toFixed(1)}M | LTV {c.ltv}%
                                                </div>
                                                <div className="text-muted-foreground mb-4">
                                                    <p>סוג תעסוקה: {c.borrower_type === 'employee' ? 'שכיר' : 'עצמאי'}</p>
                                                    <p>אזור: {c.region}</p>
                                                    <p>הוגש ב: {new Date(c.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 text-destructive hover:bg-destructive/10 border-destructive"
                                                        onClick={() => handleAction(c.id, () => rejectCase(c.id), 'תיק הוסר')}
                                                        disabled={actionLoading === c.id}
                                                    >
                                                        <Trash2 className="h-4 w-4 mr-2" /> דחה ומחק
                                                    </Button>
                                                    <Button
                                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleAction(c.id, () => approveCase(c.id), 'תיק אושר לפרסום')}
                                                        disabled={actionLoading === c.id}
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-2" /> אשר לפרסום
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Pending Appetites */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-xl">אותות תיאבון ממתינים</CardTitle>
                                <CardDescription>הגדרות בנקים חדשות שדורשות אישור.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {pendingAppetites.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground bg-accent/20 rounded-lg">אין אותות רעבים.</div>
                                ) : (
                                    <div className="space-y-4">
                                        {pendingAppetites.map(a => (
                                            <div key={a.id} className="p-4 border rounded-lg bg-card text-sm">
                                                <div className="font-bold mb-2">
                                                    {a.bank_name} - {a.branch_name}
                                                </div>
                                                <div className="text-muted-foreground mb-4 space-y-1">
                                                    <p>רמת תיאבון: <Badge variant="outline">{a.appetite_level}</Badge></p>
                                                    <p>SLA לימים: {a.sla_days}</p>
                                                    <p>עודכן ב: {new Date(a.created_at).toLocaleDateString()}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="outline"
                                                        className="flex-1 text-destructive hover:bg-destructive/10 border-destructive"
                                                        onClick={() => handleAction(a.id, () => rejectAppetite(a.id), 'אות תיאבון נדחה')}
                                                        disabled={actionLoading === a.id}
                                                    >
                                                        <Ban className="h-4 w-4 mr-2" /> דחה אות
                                                    </Button>
                                                    <Button
                                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleAction(a.id, () => approveAppetite(a.id), 'אות תיאבון נכנס לתוקף')}
                                                        disabled={actionLoading === a.id}
                                                    >
                                                        <CheckCircle className="h-4 w-4 mr-2" /> אשר אות
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default AdminDashboard;

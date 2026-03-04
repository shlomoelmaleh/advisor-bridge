import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProfileUpdateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ProfileUpdateDialog: React.FC<ProfileUpdateDialogProps> = ({ open, onOpenChange }) => {
    const { profile, user, reFetchProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        company: '',
        phone: '',
    });

    useEffect(() => {
        if (open && profile) {
            setFormData({
                full_name: profile.full_name || '',
                company: profile.company || '',
                phone: profile.phone || '',
            });
        }
    }, [profile, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from('profiles')
                .update({
                    full_name: formData.full_name,
                    company: formData.company,
                    phone: formData.phone,
                })
                .eq('user_id', user.id);

            if (error) throw error;

            await reFetchProfile();
            toast.success('הפרופיל עודכן בהצלחה');
            onOpenChange(false);
        } catch (err: any) {
            toast.error('שגיאה בעדכון הפרופיל: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px] text-right" dir="rtl">
                <DialogHeader>
                    <DialogTitle>עדכון פרטי פרופיל</DialogTitle>
                    <DialogDescription>
                        עדכן את פרטי הקשר והעסק שלך כאן. לחץ על שמירה לסיום.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="full_name">שם מלא</Label>
                        <Input
                            id="full_name"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            placeholder="ישראל ישראלי"
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="company">
                            {profile?.role === 'advisor' ? 'שם העסק / חברה' : 'שם הבנק / סניף'}
                        </Label>
                        <Input
                            id="company"
                            value={formData.company}
                            onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                            placeholder={profile?.role === 'advisor' ? 'יועצי משכנתאות בע"מ' : 'בנק הפועלים'}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="phone">טלפון ליצירת קשר</Label>
                        <Input
                            id="phone"
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="050-1234567"
                            dir="ltr"
                            className="text-right"
                        />
                    </div>
                    <div className="space-y-2 opacity-50">
                        <Label>אימייל (לא ניתן לשינוי)</Label>
                        <Input value={user?.email || ''} disabled dir="ltr" className="text-right" />
                    </div>
                    <DialogFooter className="pt-4">
                        <Button type="submit" disabled={loading} className="w-full">
                            {loading ? 'שומר שינויים...' : 'שמור שינויים'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default ProfileUpdateDialog;

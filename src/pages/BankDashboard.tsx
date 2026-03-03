import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import BankDashboardContent from '@/components/bank/BankDashboard';
import AppLayout from '@/components/layout/AppLayout';

const BankDashboard = () => {
  const { profile, signOut } = useAuth();

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
            <p className="text-muted-foreground mt-1">לאחר אישור: גישה מלאה להגדרת תיאבון וקבלת התאמות</p>
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
      <div className="container py-8">
        <BankDashboardContent />
      </div>
    </AppLayout>
  );
};

export default BankDashboard;

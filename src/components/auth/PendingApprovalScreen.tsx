import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

/** Full-screen "account pending admin approval" notice, shared by the advisor
 *  and bank dashboards. */
const PendingApprovalScreen = ({ afterApprovalText }: { afterApprovalText: string }) => {
  const { signOut } = useAuth();

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
          <p className="text-muted-foreground mt-1">{afterApprovalText}</p>
        </div>
        <Button variant="outline" onClick={() => signOut()} className="w-full">
          התנתק
        </Button>
      </div>
    </div>
  );
};

export default PendingApprovalScreen;

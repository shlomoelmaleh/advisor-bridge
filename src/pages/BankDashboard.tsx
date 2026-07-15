import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import BankDashboardContent from '@/components/bank/BankDashboard';
import AppLayout from '@/components/layout/AppLayout';
import PendingApprovalScreen from '@/components/auth/PendingApprovalScreen';

const BankDashboard = () => {
  const { profile } = useAuth();

  if (profile?.is_approved === false) {
    return <PendingApprovalScreen afterApprovalText="לאחר אישור: גישה מלאה להגדרת ביקוש וקבלת התאמות" />;
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

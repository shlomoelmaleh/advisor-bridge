import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import AdvisorDashboardContent from '@/components/advisor/AdvisorDashboard';
import AppLayout from '@/components/layout/AppLayout';
import PendingApprovalScreen from '@/components/auth/PendingApprovalScreen';

const AdvisorDashboard = () => {
  const { profile } = useAuth();

  if (profile?.is_approved === false) {
    return <PendingApprovalScreen afterApprovalText="לאחר אישור: גישה מלאה להגשת תיקים וצפייה בהתאמות" />;
  }

  return (
    <AppLayout>
      <div className="container py-8">
        <AdvisorDashboardContent />
      </div>
    </AppLayout>
  );
};

export default AdvisorDashboard;

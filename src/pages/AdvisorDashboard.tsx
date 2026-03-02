import React from 'react';
import AdvisorDashboardContent from '@/components/advisor/AdvisorDashboard';
import AppLayout from '@/components/layout/AppLayout';

const AdvisorDashboard = () => {
  return (
    <AppLayout>
      <div className="container py-8">
        <AdvisorDashboardContent />
      </div>
    </AppLayout>
  );
};

export default AdvisorDashboard;

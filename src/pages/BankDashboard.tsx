import React from 'react';
import BankDashboardContent from '@/components/bank/BankDashboard';
import AppLayout from '@/components/layout/AppLayout';

const BankDashboard = () => {
  return (
    <AppLayout>
      <div className="container py-8">
        <BankDashboardContent />
      </div>
    </AppLayout>
  );
};

export default BankDashboard;

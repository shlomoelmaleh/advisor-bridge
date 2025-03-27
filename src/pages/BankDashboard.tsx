
import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import BankDashboardContent from '@/components/bank/BankDashboard';

const BankDashboard = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container py-8">
        <BankDashboardContent />
      </main>
      <Footer />
    </div>
  );
};

export default BankDashboard;

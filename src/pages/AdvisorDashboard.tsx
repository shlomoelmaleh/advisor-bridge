
import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import AdvisorDashboardContent from '@/components/advisor/AdvisorDashboard';

const AdvisorDashboard = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container py-8">
        <AdvisorDashboardContent />
      </main>
      <Footer />
    </div>
  );
};

export default AdvisorDashboard;

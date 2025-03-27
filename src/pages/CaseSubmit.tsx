
import React from 'react';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import CaseForm from '@/components/advisor/CaseForm';

const CaseSubmit = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow container py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Submit a New Case</h1>
          <CaseForm />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CaseSubmit;

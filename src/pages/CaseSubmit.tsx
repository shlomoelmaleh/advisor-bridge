import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CaseForm from '@/components/advisor/CaseForm';

const CaseSubmit = () => {
  return (
    <AppLayout>
      <div className="container py-8 max-w-4xl mx-auto text-right" dir="rtl">
        <h1 className="text-3xl font-bold mb-8">הגש תיק חדש</h1>
        <CaseForm />
      </div>
    </AppLayout>
  );
};

export default CaseSubmit;

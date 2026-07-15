import React from 'react';
import AppLayout from '@/components/layout/AppLayout';
import CaseForm from '@/components/advisor/CaseForm';
import PageHeader from '@/components/common/PageHeader';

const CaseSubmit = () => {
  return (
    <AppLayout>
      <div className="container py-8 max-w-4xl mx-auto text-right" dir="rtl">
        <PageHeader className="mb-8" title="הגש תיק חדש" />
        <CaseForm />
      </div>
    </AppLayout>
  );
};

export default CaseSubmit;

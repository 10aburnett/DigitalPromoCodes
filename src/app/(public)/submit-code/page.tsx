'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PromoCodeSubmissionForm from '@/components/PromoCodeSubmissionForm';

export default function SubmitCodePage() {
  const router = useRouter();
  const [showForm, setShowForm] = useState(true);

  const handleClose = () => {
    setShowForm(false);
    router.push('/'); // Navigate back to home
  };

  const handleSuccess = () => {
    setShowForm(false);
    router.push('/'); // Navigate back to home after success
  };

  return (
    <div className="min-h-screen pt-20 transition-theme" style={{ backgroundColor: 'var(--background-color)' }}>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-center mb-8" style={{ color: 'var(--text-color)' }}>
            Submit a Promo Code
          </h1>
          
          {showForm && (
            <PromoCodeSubmissionForm
              onClose={handleClose}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}
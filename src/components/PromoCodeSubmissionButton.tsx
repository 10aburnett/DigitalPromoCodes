'use client'
import { useState } from 'react'
import PromoCodeSubmissionForm from './PromoCodeSubmissionForm'

interface PromoCodeSubmissionButtonProps {
  whopId: string
  whopName: string
}

export default function PromoCodeSubmissionButton({ whopId, whopName }: PromoCodeSubmissionButtonProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <section
        className="better-code-tile rounded-2xl border p-5 md:p-6 shadow-sm
                   bg-white border-gray-200"  /* light mode unchanged */
      >
        {/* This wrapper neutralizes any nested bg-white in dark */}
        <div className="kill-white flex flex-col md:flex-row md:items-center md:justify-between md:gap-6">
          <div className="md:flex-1 text-center md:text-left">
            <h3 className="tile-heading text-2xl font-semibold text-gray-900">
              Know a Better Code?
            </h3>

            <p className="tile-description mt-2 md:mt-1 leading-relaxed text-gray-600">
              Help the community by submitting a promo code for {whopName}
            </p>
          </div>

          <div className="mt-4 md:mt-0 self-center md:self-auto">
            <button
              onClick={() => setShowForm(true)}
              type="button"
              className="tile-btn inline-flex items-center justify-center rounded-xl px-4 py-3 font-semibold text-white transition-colors
                         bg-[#497BFF] hover:bg-[#3f6df0]"  /* light mode colors */
            >
              Submit Code
            </button>
          </div>
        </div>
      </section>

      {/* Submission Form Modal */}
      {showForm && (
        <PromoCodeSubmissionForm
          preselectedWhopId={whopId}
          preselectedWhopName={whopName}
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}
    </>
  )
}
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
      {/* Submission Button */}
      <div className="rounded-xl px-7 py-4 border transition-theme" style={{ 
        backgroundColor: 'var(--background-secondary)', 
        borderColor: 'var(--border-color)' 
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Know a Better Code?</h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Help the community by submitting a promo code for {whopName}
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg font-medium transition-colors"
            style={{ 
              backgroundColor: 'var(--accent-color)', 
              color: 'white' 
            }}
          >
            Submit Code
          </button>
        </div>
      </div>

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
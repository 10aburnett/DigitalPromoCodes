'use client'
import { useState } from 'react'
import PromoCodeSubmissionForm from './PromoCodeSubmissionForm'

interface GeneralPromoSubmissionButtonProps {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}

export default function GeneralPromoSubmissionButton({ 
  className, 
  style,
  children 
}: GeneralPromoSubmissionButtonProps) {
  const [showForm, setShowForm] = useState(false)

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className={className}
        style={style}
      >
        {children || 'Submit Code'}
      </button>

      {/* Submission Form Modal */}
      {showForm && (
        <PromoCodeSubmissionForm
          onClose={() => setShowForm(false)}
          onSuccess={() => setShowForm(false)}
        />
      )}
    </>
  )
}
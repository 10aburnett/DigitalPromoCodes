'use client'
import { useState, useEffect } from 'react'

interface PromoCodeSubmission {
  id: string
  title: string
  description: string
  code: string
  value: string
  whopId: string | null
  whop?: {
    id: string
    name: string
    slug: string
  }
  customCourseName: string | null
  isGeneral: boolean
  isNewCourse: boolean
  submitterName: string
  submitterEmail: string
  submitterMessage: string | null
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE' | 'SPAM'
  reviewedAt: Date | null
  reviewedBy: string | null
  adminNotes: string | null
  createdAt: Date
  updatedAt: Date
}

export default function PromoSubmissionsManager() {
  const [submissions, setSubmissions] = useState<PromoCodeSubmission[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const [processingId, setProcessingId] = useState<string | null>(null)

  useEffect(() => {
    fetchSubmissions()
  }, [filter])

  const fetchSubmissions = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/admin/promo-submissions?status=${filter}`)
      if (response.ok) {
        const data = await response.json()
        setSubmissions(data)
      }
    } catch (error) {
      console.error('Error fetching submissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (
    submissionId: string, 
    newStatus: 'APPROVED' | 'REJECTED' | 'DUPLICATE' | 'SPAM' | 'PENDING',
    adminNotes?: string
  ) => {
    setProcessingId(submissionId)
    try {
      const response = await fetch('/api/admin/promo-submissions/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId,
          status: newStatus,
          adminNotes: adminNotes || ''
        })
      })

      if (response.ok) {
        await fetchSubmissions() // Refresh the list
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('API Error:', response.status, errorData)
        alert(`Failed to update submission status: ${errorData.error || errorData.details || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error updating submission:', error)
      alert('Error updating submission')
    } finally {
      setProcessingId(null)
    }
  }

  const handleDelete = async (submissionId: string, submissionTitle: string) => {
    // Confirm deletion with strong warning
    if (!confirm(`⚠️ PERMANENT DELETE WARNING ⚠️\n\nAre you sure you want to permanently delete the submission "${submissionTitle}"?\n\nThis will DELETE the record from the database and CANNOT BE UNDONE.\n\nClick OK only if you are absolutely sure.`)) {
      return
    }

    setProcessingId(submissionId)
    try {
      // Call the proper DELETE endpoint with ID in path
      const response = await fetch(`/api/admin/promo-submissions/${encodeURIComponent(submissionId)}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Submission permanently deleted from database:', result)
        
        // Remove from UI immediately and refresh
        await fetchSubmissions()
        alert(`✅ Successfully deleted from database: "${submissionTitle}"`)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Delete API Error:', response.status, errorData)
        alert(`❌ Failed to delete from database: ${errorData.error || errorData.details || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error deleting submission from database:', error)
      alert('❌ Network error: Failed to delete submission from database')
    } finally {
      setProcessingId(null)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800'
      case 'APPROVED': return 'bg-green-100 text-green-800'
      case 'REJECTED': return 'bg-red-100 text-red-800'
      case 'DUPLICATE': return 'bg-orange-100 text-orange-800'
      case 'SPAM': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {['PENDING', 'ALL', 'APPROVED', 'REJECTED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'ALL' ? 'All Submissions' : tab}
              {tab === 'PENDING' && (
                <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded-full">
                  {submissions.filter(s => s.status === 'PENDING').length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No submissions found for the selected filter.
        </div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <div key={submission.id} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{submission.title}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(submission.status)}`}>
                      {submission.status}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <p><strong>Promo Code:</strong> {submission.code}</p>
                      <p><strong>Value:</strong> {submission.value}</p>
                      <p><strong>Type:</strong> {submission.isGeneral ? 'General Promo' : 'Course-Specific'}</p>
                    </div>
                    <div>
                      <p><strong>Course:</strong> {
                        submission.isGeneral 
                          ? 'General (no specific course)' 
                          : submission.isNewCourse 
                            ? `New Course: ${submission.customCourseName}`
                            : submission.whop?.name || 'Unknown Course'
                      }</p>
                      <p><strong>Submitted by:</strong> {submission.submitterName} ({submission.submitterEmail})</p>
                      <p><strong>Date:</strong> {formatDate(submission.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-gray-700 mb-2"><strong>Description:</strong></p>
                <p className="text-gray-600 bg-gray-50 p-3 rounded">{submission.description}</p>
                
                {submission.submitterMessage && (
                  <>
                    <p className="text-gray-700 mt-3 mb-2"><strong>Additional Message:</strong></p>
                    <p className="text-gray-600 bg-gray-50 p-3 rounded">{submission.submitterMessage}</p>
                  </>
                )}
              </div>

              {submission.adminNotes && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm font-medium text-blue-900">Admin Notes:</p>
                  <p className="text-sm text-blue-800">{submission.adminNotes}</p>
                  {submission.reviewedBy && submission.reviewedAt && (
                    <p className="text-xs text-blue-600 mt-1">
                      Reviewed by {submission.reviewedBy} on {formatDate(submission.reviewedAt)}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
                {submission.status === 'PENDING' ? (
                  <>
                    <button
                      onClick={() => handleStatusUpdate(submission.id, 'APPROVED', 'Approved for publication')}
                      disabled={processingId === submission.id}
                      className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                    >
                      {processingId === submission.id ? 'Processing...' : '✓ Approve'}
                    </button>
                    
                    <button
                      onClick={() => {
                        const notes = prompt('Reason for rejection (optional):')
                        if (notes !== null) {
                          handleStatusUpdate(submission.id, 'REJECTED', notes || 'Rejected by admin')
                        }
                      }}
                      disabled={processingId === submission.id}
                      className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      ✗ Reject
                    </button>
                    
                    <button
                      onClick={() => handleStatusUpdate(submission.id, 'DUPLICATE', 'Marked as duplicate')}
                      disabled={processingId === submission.id}
                      className="bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-orange-700 disabled:opacity-50"
                    >
                      Duplicate
                    </button>
                    
                    <button
                      onClick={() => handleStatusUpdate(submission.id, 'SPAM', 'Marked as spam')}
                      disabled={processingId === submission.id}
                      className="bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700 disabled:opacity-50"
                    >
                      Spam
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        const reason = prompt('Reason for reverting to pending (optional):')
                        if (reason !== null) {
                          handleStatusUpdate(submission.id, 'PENDING', reason || 'Reverted to pending for re-evaluation')
                        }
                      }}
                      disabled={processingId === submission.id}
                      className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                    >
                      {processingId === submission.id ? 'Processing...' : '🔄 Revert to Pending'}
                    </button>
                    
                    <span className="text-sm text-gray-500 self-center">
                      Current status: <span className={`font-medium px-2 py-1 rounded text-xs ${getStatusColor(submission.status)}`}>
                        {submission.status}
                      </span>
                    </span>
                  </>
                )}
                
                {/* Delete button - available for all submissions */}
                <button
                  onClick={() => handleDelete(submission.id, submission.title)}
                  disabled={processingId === submission.id}
                  className="bg-red-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-900 disabled:opacity-50 border-2 border-red-600"
                >
                  {processingId === submission.id ? 'Deleting...' : '🗑️ Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
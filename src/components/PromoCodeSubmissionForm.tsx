'use client'
import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

interface DealSearchResult {
  id: string
  name: string
  slug: string
}

interface PromoCodeSubmissionFormProps {
  preselectedWhopId?: string // For deal-specific submissions
  preselectedWhopName?: string // For displaying the preselected deal name
  onClose?: () => void
  onSuccess?: () => void
}

export default function PromoCodeSubmissionForm({
  preselectedWhopId,
  preselectedWhopName,
  onClose,
  onSuccess
}: PromoCodeSubmissionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [searchResults, setSearchResults] = useState<DealSearchResult[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const searchController = useRef<AbortController | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    code: '',
    value: '',
    submitterName: '',
    submitterEmail: '',
    submitterMessage: '',
    isGeneral: !preselectedWhopId, // Default to general if no preselected course
    whopId: preselectedWhopId || '',
    customCourseName: '', // For new courses
    isNewCourse: false
  })

  // Initialize search term with preselected course name only once
  useEffect(() => {
    if (preselectedWhopName && !searchTerm) {
      setSearchTerm(preselectedWhopName)
      setDebouncedSearchTerm(preselectedWhopName)
    }
  }, [preselectedWhopName])

  // Optimized debounce with shorter delay for instant feel
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 100) // Reduced from 150ms to 100ms

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Server-side search with caching and request deduplication
  const searchWhops = useCallback(async (query: string) => {
    // Cancel any existing search request
    if (searchController.current) {
      searchController.current.abort()
    }

    if (!query.trim() || query.length < 2) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    // Create new abort controller for this request
    searchController.current = new AbortController()
    setIsSearching(true)

    try {
      const response = await fetch(`/api/whops/search?q=${encodeURIComponent(query)}&limit=20`, {
        signal: searchController.current.signal
      })
      
      if (response.ok && !searchController.current.signal.aborted) {
        const data = await response.json()
        setSearchResults(data)
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Error searching courses:', error)
      }
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Trigger search when debounced term changes
  useEffect(() => {
    if (showDropdown) {
      searchWhops(debouncedSearchTerm)
    }
  }, [debouncedSearchTerm, showDropdown, searchWhops])

  // Get selected course name efficiently
  const selectedCourseName = useMemo(() => {
    if (formData.isNewCourse) return formData.customCourseName
    const selectedWhop = searchResults.find(w => w.id === formData.whopId)
    return selectedWhop?.name || ''
  }, [searchResults, formData.whopId, formData.isNewCourse, formData.customCourseName])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Validate required fields
    if (!formData.title || !formData.description || !formData.submitterName || !formData.submitterEmail) {
      alert('Please fill in all required fields.')
      setIsSubmitting(false)
      return
    }

    // Validate promo code and value are provided
    if (!formData.code.trim() || !formData.value.trim()) {
      alert('Please provide both a promo code and discount value. If no code is required, enter "No code required" in the promo code field.')
      setIsSubmitting(false)
      return
    }

    // Validate course selection for non-general submissions
    if (!formData.isGeneral && !formData.whopId && !formData.isNewCourse) {
      alert('Please select a course or mark it as a new course for course-specific submissions.')
      setIsSubmitting(false)
      return
    }

    // Validate new course name
    if (!formData.isGeneral && formData.isNewCourse && !formData.customCourseName.trim()) {
      alert('Please enter the name of the new course.')
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/promo-submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          whopId: formData.isGeneral ? null : (formData.isNewCourse ? null : formData.whopId),
          customCourseName: formData.isNewCourse ? formData.customCourseName : null
        })
      })

      if (response.ok) {
        // Show success message
        setShowSuccessMessage(true)
        
        // Reset form
        setTimeout(() => {
          setFormData({
            title: '',
            description: '',
            code: '',
            value: '',
            submitterName: '',
            submitterEmail: '',
            submitterMessage: '',
            isGeneral: !preselectedWhopId,
            whopId: preselectedWhopId || '',
            customCourseName: '',
            isNewCourse: false
          })
          setSearchTerm('')
          setShowSuccessMessage(false)
          onSuccess?.()
        }, 15000) // Show success message for 15 seconds
      } else {
        throw new Error('Failed to submit promo code')
      }
    } catch (error) {
      console.error('Error submitting promo code:', error)
      alert('Failed to submit promo code. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCourseSelect = useCallback((whop: DealSearchResult) => {
    setFormData(prev => ({ 
      ...prev, 
      whopId: whop.id, 
      isNewCourse: false, 
      customCourseName: '' 
    }))
    setSearchTerm(whop.name)
    setShowDropdown(false)
    // Add selected item to search results if not already there
    setSearchResults(prev => {
      const exists = prev.find(w => w.id === whop.id)
      return exists ? prev : [whop, ...prev]
    })
  }, [])

  const handleNewCourse = useCallback(() => {
    setFormData(prev => ({ 
      ...prev, 
      isNewCourse: true, 
      whopId: '',
      customCourseName: searchTerm 
    }))
    setShowDropdown(false)
  }, [searchTerm])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (searchController.current) {
        searchController.current.abort()
      }
    }
  }, [])

  const handleCloseSuccess = () => {
    setShowSuccessMessage(false)
    onSuccess?.() // This closes the entire modal and returns to the original page
  }

  // Success Message Component
  if (showSuccessMessage) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
           onClick={handleCloseSuccess}>
        <div className="rounded-lg shadow-xl max-w-md w-full p-8 text-center relative transition-theme" 
             style={{ backgroundColor: 'var(--background-color)' }}
             onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleCloseSuccess}
            className="absolute top-4 right-4 hover:opacity-80 text-2xl font-bold"
            style={{ color: 'var(--text-secondary)' }}
          >
            ×
          </button>
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                 style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                   strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>Thank You! 🎉</h3>
            <p className="text-lg leading-relaxed" style={{ color: 'var(--text-color)' }}>
              You're awesome! Thanks for making our community better by sharing this promo code. 
              Your contribution adds real value to our group and helps fellow members save money. 
            </p>
            <p className="mt-4" style={{ color: 'var(--text-secondary)' }}>
              We'll review your submission and add it to the site once approved. Keep being amazing! ✨
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-theme"
           style={{ backgroundColor: 'var(--background-color)' }}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>Submit a Promo Code</h2>
            {onClose && (
              <button
                onClick={onClose}
                className="hover:opacity-80 text-2xl font-bold"
                style={{ color: 'var(--text-secondary)' }}
              >
                ×
              </button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Promo Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-color)' }}>
                Promo Code Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center" style={{ color: 'var(--text-color)' }}>
                  <input
                    type="radio"
                    checked={!formData.isGeneral}
                    onChange={() => setFormData(prev => ({ ...prev, isGeneral: false }))}
                    className="mr-2"
                  />
                  Course-Specific
                </label>
                <label className="flex items-center" style={{ color: 'var(--text-color)' }}>
                  <input
                    type="radio"
                    checked={formData.isGeneral}
                    onChange={() => setFormData(prev => ({ ...prev, isGeneral: true, whopId: '' }))}
                    className="mr-2"
                  />
                  General Promo
                </label>
              </div>
            </div>

            {/* Course Selection (only for course-specific) */}
            {!formData.isGeneral && (
              <div className="relative">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                  Select Course *
                </label>
                
                {/* Optimized Search input */}
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      const value = e.target.value
                      setSearchTerm(value)
                      setShowDropdown(true)
                      // Clear selections when typing
                      if (value !== searchTerm) {
                        setFormData(prev => ({ 
                          ...prev, 
                          whopId: '', 
                          isNewCourse: false, 
                          customCourseName: '' 
                        }))
                      }
                    }}
                    onFocus={() => {
                      setShowDropdown(true)
                      if (searchTerm.length >= 2) {
                        searchWhops(searchTerm)
                      }
                    }}
                    placeholder="Type to search for a course..."
                    className="w-full px-3 py-2 pr-10 border rounded-md focus:outline-none focus:ring-2 transition-colors"
                    style={{
                      backgroundColor: 'var(--background-secondary)',
                      borderColor: 'var(--border-color)',
                      color: 'var(--text-color)'
                    }}
                    required={!formData.isGeneral}
                    autoComplete="off"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    {isSearching ? (
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
                           style={{ color: 'var(--text-secondary)' }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                  </div>
                </div>

                {/* Optimized Dropdown results */}
                {showDropdown && (
                  <div className="absolute z-10 w-full mt-1 rounded-md shadow-lg max-h-60 overflow-y-auto transition-theme" 
                       style={{ backgroundColor: 'var(--background-color)', borderColor: 'var(--border-color)', border: '1px solid' }}>
                    {/* Search instruction for short queries */}
                    {searchTerm && searchTerm.length < 2 && (
                      <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Type at least 2 characters to search...
                      </div>
                    )}
                    
                    {/* Loading state */}
                    {isSearching && searchTerm.length >= 2 && (
                      <div className="px-3 py-2 text-secondary text-sm flex items-center">
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2" />
                        Searching courses...
                      </div>
                    )}
                    
                    {/* Search results */}
                    {!isSearching && searchTerm.length >= 2 && searchResults.length > 0 && (
                      <div>
                        {searchResults.map(whop => (
                          <button
                            key={whop.id}
                            type="button"
                            onClick={() => handleCourseSelect(whop)}
                            className="w-full px-3 py-2 text-left focus:outline-none transition-colors"
                            style={{
                              color: 'var(--text-color)'
                            }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--background-secondary)'}
                            onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'}
                          >
                            <div className="truncate">{whop.name}</div>
                          </button>
                        ))}
                        {searchResults.length === 20 && (
                          <div className="px-3 py-1 text-xs text-gray-400 border-t border-gray-100">
                            Showing first 20 results. Be more specific to narrow down.
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* New course option */}
                    {searchTerm && searchTerm.length > 2 && (
                      <div className={searchResults.length > 0 ? "border-t border-gray-200" : ""}>
                        <button
                          type="button"
                          onClick={handleNewCourse}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none text-blue-600 transition-colors"
                        >
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add "{searchTerm}" as new course
                          </div>
                        </button>
                      </div>
                    )}
                    
                    {/* No results */}
                    {!isSearching && searchTerm.length >= 2 && searchResults.length === 0 && (
                      <div className="px-3 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        No courses found matching "{searchTerm}". {searchTerm.length > 2 && 'Use the option above to add as new course.'}
                      </div>
                    )}
                  </div>
                )}
                
                {/* Selected course indicator */}
                {(selectedCourseName || formData.isNewCourse) && (
                  <div className="mt-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm">
                    {formData.isNewCourse ? (
                      <span className="text-green-700">
                        ✅ New course: <strong>{formData.customCourseName}</strong>
                      </span>
                    ) : (
                      <span className="text-green-700">
                        ✅ Selected: <strong>{selectedCourseName}</strong>
                      </span>
                    )}
                  </div>
                )}

                {/* Click outside to close dropdown */}
                {showDropdown && (
                  <div 
                    className="fixed inset-0 z-5" 
                    onClick={() => setShowDropdown(false)}
                  />
                )}
              </div>
            )}

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                Promo Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. 20% Off Summer Sale, Free Month Trial"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors"
                style={{ 
                  backgroundColor: 'var(--background-secondary)', 
                  borderColor: 'var(--border-color)', 
                  color: 'var(--text-color)'
                }}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe the promo code and any conditions..."
                rows={3}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors"
                style={{ 
                  backgroundColor: 'var(--background-secondary)', 
                  borderColor: 'var(--border-color)', 
                  color: 'var(--text-color)'
                }}
                required
              />
            </div>

            {/* Code */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                Promo Code *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. SUMMER20, FREEMONTH, or 'No code required'"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors"
                style={{ 
                  backgroundColor: 'var(--background-secondary)', 
                  borderColor: 'var(--border-color)', 
                  color: 'var(--text-color)'
                }}
                required
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                If no promo code is needed, enter "No code required"
              </p>
            </div>

            {/* Value */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                Discount Value *
              </label>
              <input
                type="text"
                value={formData.value}
                onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                placeholder="e.g. 20% off, $50 off, Free trial, Free access"
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors"
                style={{ 
                  backgroundColor: 'var(--background-secondary)', 
                  borderColor: 'var(--border-color)', 
                  color: 'var(--text-color)'
                }}
                required
              />
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                What do users get with this promo? (discount amount, free trial, etc.)
              </p>
            </div>

            {/* Submitter Name */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                Your Name *
              </label>
              <input
                type="text"
                value={formData.submitterName}
                onChange={(e) => setFormData(prev => ({ ...prev, submitterName: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors"
                style={{ 
                  backgroundColor: 'var(--background-secondary)', 
                  borderColor: 'var(--border-color)', 
                  color: 'var(--text-color)'
                }}
                required
              />
            </div>

            {/* Submitter Email */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                Your Email *
              </label>
              <input
                type="email"
                value={formData.submitterEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, submitterEmail: e.target.value }))}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors"
                style={{ 
                  backgroundColor: 'var(--background-secondary)', 
                  borderColor: 'var(--border-color)', 
                  color: 'var(--text-color)'
                }}
                required
              />
            </div>

            {/* Optional Message */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                Additional Message
              </label>
              <textarea
                value={formData.submitterMessage}
                onChange={(e) => setFormData(prev => ({ ...prev, submitterMessage: e.target.value }))}
                placeholder="Any additional information about this promo code..."
                rows={2}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 transition-colors"
                style={{ 
                  backgroundColor: 'var(--background-secondary)', 
                  borderColor: 'var(--border-color)', 
                  color: 'var(--text-color)'
                }}
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 border rounded-md hover:opacity-80 transition-opacity"
                  style={{ 
                    borderColor: 'var(--border-color)', 
                    color: 'var(--text-color)',
                    backgroundColor: 'var(--background-secondary)'
                  }}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
                style={{ backgroundColor: 'var(--accent-color)', color: 'white' }}
              >
                {isSubmitting ? 'Submitting...' : 'Submit a Promo Code'}
              </button>
            </div>
          </form>

          <div className="mt-6 p-4 rounded-lg transition-theme" 
               style={{ backgroundColor: 'var(--background-tertiary)' }}>
            <p className="text-sm" style={{ color: 'var(--text-color)' }}>
              <strong>Community Guidelines:</strong> Please only submit legitimate promo codes.
              All submissions are reviewed by our team before being published. Thank you for
              helping build the community!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
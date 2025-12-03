'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { SITE_BRAND } from '@/lib/brand';

interface ContactSubmission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'UNREAD' | 'READ' | 'REPLIED';
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  email: string;
  role: string;
}

export default function EnquiriesAdmin() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [user, setUser] = useState<User | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCompact, setIsCompact] = useState(false);

  // Check authentication
  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch submissions when filter changes
  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [statusFilter, user]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin-auth');
      if (response.ok) {
        const userData = await response.json();
        if (userData.success && userData.user) {
          setUser(userData.user);
        } else {
          router.push('/admin/login');
        }
      } else {
        router.push('/admin/login');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/admin/login');
    }
  };

  const fetchSubmissions = async () => {
    try {
      const url = statusFilter === 'all' 
        ? '/api/contact' 
        : `/api/contact?status=${statusFilter}`;
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSubmissions(data);
      } else {
        toast.error('Failed to fetch enquiries');
      }
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Failed to fetch enquiries');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch(`/api/contact/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success('Status updated successfully');
        fetchSubmissions();
        if (selectedSubmission?.id === id) {
          setSelectedSubmission({ ...selectedSubmission, status: status as any });
        }
      } else {
        toast.error('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const openGmail = (email: string, subject: string, name: string, originalMessage: string, date: string) => {
    const quotedMessage = originalMessage
      .split('\n')
      .map(line => `> ${line}`)
      .join('\n');
    
    const replyBody = `Hi ${name},

                    Thank you for contacting ${SITE_BRAND}.
                    We have received your message and will get back to you soon.
                    Best regards,
                    ${SITE_BRAND} Team

---

On ${new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}, ${name} wrote:

${quotedMessage}`;

    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}&su=${encodeURIComponent(`Re: ${subject}`)}&body=${encodeURIComponent(replyBody)}`;
    window.open(gmailUrl, '_blank');
    
    // Mark as replied if not already
    if (selectedSubmission && selectedSubmission.status !== 'REPLIED') {
      updateStatus(selectedSubmission.id, 'REPLIED');
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredSubmissions.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectSubmission = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.length === 0) {
      toast.error('Please select submissions to delete');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${selectedIds.length} submission(s)? This action cannot be undone.`)) {
      return;
    }

    setBulkDeleting(true);
    try {
      const response = await fetch('/api/contact', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: selectedIds }),
      });

      if (response.ok) {
        const result = await response.json();
        toast.success(result.message);
        setSelectedIds([]);
        fetchSubmissions();
        if (selectedSubmission && selectedIds.includes(selectedSubmission.id)) {
          setSelectedSubmission(null);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete submissions');
      }
    } catch (error) {
      console.error('Error deleting submissions:', error);
      toast.error('Failed to delete submissions');
    } finally {
      setBulkDeleting(false);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = filteredSubmissions
      .filter(s => s.status === 'UNREAD')
      .map(s => s.id);
    
    if (unreadIds.length === 0) {
      toast.error('No unread submissions to mark');
      return;
    }

    try {
      await Promise.all(unreadIds.map(id => updateStatus(id, 'READ')));
      toast.success(`Marked ${unreadIds.length} submissions as read`);
    } catch (error) {
      toast.error('Failed to mark submissions as read');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UNREAD': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'READ': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'REPLIED': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusDot = (status: string) => {
    switch (status) {
      case 'UNREAD': return 'bg-red-500';
      case 'READ': return 'bg-yellow-500';
      case 'REPLIED': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusCounts = () => {
    return {
      all: submissions.length,
      unread: submissions.filter(s => s.status === 'UNREAD').length,
      read: submissions.filter(s => s.status === 'READ').length,
      replied: submissions.filter(s => s.status === 'REPLIED').length,
    };
  };

  // Filter submissions based on search term
  const filteredSubmissions = submissions.filter(submission => 
    submission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
    submission.message.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[#343541] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#68D08B] mx-auto mb-4"></div>
          <p>Loading enquiries...</p>
        </div>
      </div>
    );
  }

  const counts = getStatusCounts();

  return (
    <div className="min-h-screen bg-[#343541] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with enhanced controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Contact Enquiries</h1>
            <p className="text-gray-400">Manage customer enquiries and support requests</p>
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Search bar */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search enquiries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#3e4050] border border-[#404055] rounded-lg px-4 py-2 pl-10 text-white placeholder-gray-400 focus:ring-2 focus:ring-[#68D08B] focus:border-transparent transition-all duration-200 w-64"
              />
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* View toggle */}
            <button
              onClick={() => setIsCompact(!isCompact)}
              className="bg-[#3e4050] hover:bg-[#404055] border border-[#404055] text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isCompact ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
              {isCompact ? 'Detailed' : 'Compact'}
            </button>

            {/* Mark all as read */}
            <button
              onClick={markAllAsRead}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Mark All Read
            </button>

            {/* Bulk delete */}
            {selectedIds.length > 0 && (
              <button
                onClick={bulkDelete}
                disabled={bulkDeleting}
                className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 text-white font-semibold px-6 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 animate-fadeIn"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c0-1 1-2 2-2v2"/>
                  <line x1="10" y1="11" x2="10" y2="17"/>
                  <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
                {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
              </button>
            )}
          </div>
        </div>

        {/* Enhanced Status Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { key: 'all', label: `All`, count: counts.all, color: 'bg-gray-500' },
            { key: 'unread', label: `Unread`, count: counts.unread, color: 'bg-red-500' },
            { key: 'read', label: `Read`, count: counts.read, color: 'bg-yellow-500' },
            { key: 'replied', label: `Replied`, count: counts.replied, color: 'bg-green-500' }
          ].map(({ key, label, count, color }) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 ${
                statusFilter === key
                  ? 'bg-[#68D08B] text-black font-semibold shadow-lg transform scale-105'
                  : 'bg-[#3e4050] hover:bg-[#404055] text-white border border-[#404055] hover:border-[#68D08B]/50'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${color}`}></span>
              {label}
              <span className={`px-2 py-0.5 text-xs rounded-full ${
                statusFilter === key ? 'bg-black/20' : 'bg-[#2a2b35]'
              }`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Enhanced Submissions List */}
          <div className="lg:col-span-1">
            <div className="bg-[#3e4050] rounded-xl border border-[#404055] shadow-xl">
              <div className="p-6 border-b border-[#404055]">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">
                    Enquiries ({filteredSubmissions.length})
                    {searchTerm && (
                      <span className="text-sm text-gray-400 ml-2">
                        filtered from {submissions.length}
                      </span>
                    )}
                  </h2>
                  {filteredSubmissions.length > 0 && (
                                          <label className="flex items-center gap-2 text-sm text-gray-400 hover:text-white cursor-pointer transition-colors duration-200">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === filteredSubmissions.length && filteredSubmissions.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 rounded border-2 border-[#404055] bg-[#3e4050] text-[#68D08B] focus:ring-2 focus:ring-[#68D08B] focus:ring-offset-0 focus:border-[#68D08B] transition-all duration-200 cursor-pointer"
                        />
                        Select All
                      </label>
                  )}
                </div>
              </div>
              
              <div className="max-h-[600px] overflow-y-auto">
                {filteredSubmissions.map((submission, index) => (
                  <div
                    key={submission.id}
                    onClick={() => {
                      setSelectedSubmission(submission);
                      if (submission.status === 'UNREAD') {
                        updateStatus(submission.id, 'READ');
                      }
                    }}
                    className={`p-4 cursor-pointer transition-all duration-200 border-b border-[#404055] last:border-b-0 hover:bg-[#404055] ${
                      selectedSubmission?.id === submission.id
                        ? 'bg-[#68D08B]/10 border-l-4 border-l-[#68D08B] shadow-lg'
                        : ''
                    } ${isCompact ? 'py-3' : 'py-4'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(submission.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleSelectSubmission(submission.id, e.target.checked);
                          }}
                          className="w-4 h-4 rounded border-2 border-[#404055] bg-[#3e4050] text-[#68D08B] focus:ring-2 focus:ring-[#68D08B] focus:ring-offset-0 focus:border-[#68D08B] transition-all duration-200 cursor-pointer"
                        />
                        <span className={`w-3 h-3 rounded-full ${getStatusDot(submission.status)} animate-pulse`}></span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDate(submission.createdAt)}
                      </span>
                    </div>
                    
                    <div className="ml-6">
                      <h3 className="font-semibold text-white mb-1 truncate">{submission.name}</h3>
                      {!isCompact && (
                        <p className="text-sm text-gray-400 mb-1 truncate">{submission.email}</p>
                      )}
                      <p className="text-sm text-[#68D08B] mb-2 font-medium truncate">{submission.subject}</p>
                      {!isCompact && (
                        <p className="text-xs text-gray-300 line-clamp-2">
                          {submission.message.substring(0, 100)}...
                        </p>
                      )}
                      
                      <div className="mt-2">
                        <span className={`inline-block px-2 py-1 text-xs rounded border ${getStatusColor(submission.status)}`}>
                          {submission.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {filteredSubmissions.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <p className="text-lg">
                      {searchTerm ? 'No matching enquiries found' : 'No enquiries found'}
                    </p>
                    <p className="text-sm">
                      {searchTerm ? 'Try adjusting your search terms' : 'Contact submissions will appear here'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Enhanced Submission Details */}
          <div className="lg:col-span-2">
            {selectedSubmission ? (
              <div className="bg-[#3e4050] rounded-xl border border-[#404055] shadow-xl">
                <div className="p-6 border-b border-[#404055]">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h2 className="text-2xl font-semibold text-white mb-2">{selectedSubmission.subject}</h2>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        <span><strong>From:</strong> {selectedSubmission.name}</span>
                        <span><strong>Email:</strong> {selectedSubmission.email}</span>
                        <span><strong>Date:</strong> {formatDate(selectedSubmission.createdAt)}</span>
                      </div>
                    </div>
                    <span className={`px-3 py-1 text-sm rounded border ${getStatusColor(selectedSubmission.status)}`}>
                      {selectedSubmission.status}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => openGmail(
                        selectedSubmission.email, 
                        selectedSubmission.subject, 
                        selectedSubmission.name,
                        selectedSubmission.message,
                        selectedSubmission.createdAt
                      )}
                      className="bg-[#68D08B] hover:bg-[#5bc47d] text-black font-semibold px-6 py-2 rounded-lg transition-all duration-200 flex items-center gap-2 hover:shadow-lg transform hover:scale-105"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                        <polyline points="22,6 12,13 2,6"/>
                      </svg>
                      Reply
                    </button>
                    
                    <div className="relative">
                      <select
                        value={selectedSubmission.status}
                        onChange={(e) => updateStatus(selectedSubmission.id, e.target.value)}
                        className="appearance-none bg-[#2a2b35] border border-[#404055] rounded-lg px-4 py-2 pr-10 text-white focus:ring-2 focus:ring-[#68D08B] focus:border-transparent transition-all duration-200 cursor-pointer hover:bg-[#3e4050]"
                      >
                        <option value="UNREAD">Unread</option>
                        <option value="READ">Read</option>
                        <option value="REPLIED">Replied</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4 text-white">Message</h3>
                  <div className="bg-[#2a2b35] rounded-lg p-6 border border-[#404055] hover:border-[#68D08B]/30 transition-all duration-200">
                    <p className="whitespace-pre-wrap text-gray-300 leading-relaxed">{selectedSubmission.message}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#3e4050] rounded-xl border border-[#404055] flex items-center justify-center h-[500px] shadow-xl">
                <div className="text-center text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <p className="text-lg mb-2">Select an enquiry to view details</p>
                  <p className="text-sm">Choose a contact submission from the list to read and respond</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
} 
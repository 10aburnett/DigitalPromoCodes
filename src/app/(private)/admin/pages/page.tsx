'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Page {
  id: string;
  slug: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

interface User {
  id: string;
  email: string;
  role: string;
}

export default function PagesAdmin() {
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPage, setSelectedPage] = useState<Page | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    slug: '',
    title: '',
    content: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check authentication on component mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Fetch pages after authentication is confirmed
  useEffect(() => {
    if (isAuthenticated) {
      fetchPages();
    }
  }, [isAuthenticated]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin-auth');
      const data = await response.json();
      
      if (response.ok && data.success && data.user) {
        setIsAuthenticated(true);
        setUser(data.user);
      } else {
        // Redirect to login if not authenticated
        router.push('/admin/login');
        return;
      }
    } catch (error) {
      console.error('Auth check error:', error);
      router.push('/admin/login');
      return;
    } finally {
      setLoading(false);
    }
  };

  const fetchPages = async () => {
    try {
      const response = await fetch('/api/legal-pages');
      if (response.ok) {
        const pagesData = await response.json();
        setPages(pagesData);
      } else {
        toast.error('Failed to fetch pages');
      }
    } catch (error) {
      console.error('Error fetching pages:', error);
      toast.error('Failed to fetch pages');
    }
  };

  const handlePageSelect = (page: Page) => {
    setSelectedPage(page);
    setFormData({
      slug: page.slug,
      title: page.title,
      content: page.content
    });
    setIsEditing(true);
  };

  const handleNewPage = () => {
    setSelectedPage(null);
    setFormData({
      slug: '',
      title: '',
      content: ''
    });
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!formData.slug || !formData.title || !formData.content) {
      toast.error('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      const response = await fetch('/api/legal-pages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast.success('Page saved successfully');
        setIsEditing(false);
        fetchPages();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save page');
      }
    } catch (error) {
      console.error('Error saving page:', error);
      toast.error('Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedPage(null);
    setFormData({ slug: '', title: '', content: '' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#343541] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#68D08B] border-r-transparent"></div>
          <p className="mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#343541] text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Pages Management</h1>
          <button
            onClick={handleNewPage}
            className="bg-[#68D08B] hover:bg-[#5bc47d] text-black font-semibold px-6 py-2 rounded-lg transition-colors duration-200"
          >
            New Page
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pages List */}
          <div className="lg:col-span-1">
            <div className="bg-[#3e4050] rounded-xl p-6 border border-[#404055]">
              <h2 className="text-xl font-semibold mb-4">Pages</h2>
              <div className="space-y-2">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => handlePageSelect(page)}
                    className={`w-full text-left p-3 rounded-lg transition-colors duration-200 ${
                      selectedPage?.id === page.id
                        ? 'bg-[#68D08B] text-black'
                        : 'bg-[#2c2f3a] hover:bg-[#404055] text-white'
                    }`}
                  >
                    <div className="font-medium">{page.title}</div>
                    <div className="text-sm opacity-70">/{page.slug}</div>
                  </button>
                ))}
                {pages.length === 0 && (
                  <p className="text-[#a4a5b0] text-center py-4">No pages found</p>
                )}
              </div>
            </div>
          </div>

          {/* Editor */}
          <div className="lg:col-span-2">
            {isEditing ? (
              <div className="bg-[#3e4050] rounded-xl p-6 border border-[#404055]">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-semibold">
                    {selectedPage ? 'Edit Page' : 'New Page'}
                  </h2>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancel}
                      className="px-4 py-2 text-[#a4a5b0] hover:text-white transition-colors duration-200"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-[#68D08B] hover:bg-[#5bc47d] disabled:bg-[#68D08B]/50 text-black font-semibold px-6 py-2 rounded-lg transition-colors duration-200"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Slug</label>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-4 py-2 bg-[#2c2f3a] border border-[#404055] rounded-lg focus:outline-none focus:border-[#68D08B] transition-colors duration-200"
                      placeholder="e.g., privacy, terms, contact"
                      disabled={!!selectedPage} // Don't allow changing slug for existing pages
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Title</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full px-4 py-2 bg-[#2c2f3a] border border-[#404055] rounded-lg focus:outline-none focus:border-[#68D08B] transition-colors duration-200"
                      placeholder="Page title"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Content (HTML)</label>
                    <textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      rows={20}
                      className="w-full px-4 py-2 bg-[#2c2f3a] border border-[#404055] rounded-lg focus:outline-none focus:border-[#68D08B] transition-colors duration-200 font-mono text-sm"
                      placeholder="Enter HTML content..."
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#3e4050] rounded-xl p-6 border border-[#404055] text-center">
                <p className="text-[#a4a5b0] mb-4">Select a page to edit or create a new one</p>
                <button
                  onClick={handleNewPage}
                  className="bg-[#68D08B] hover:bg-[#5bc47d] text-black font-semibold px-6 py-2 rounded-lg transition-colors duration-200"
                >
                  Create New Page
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 
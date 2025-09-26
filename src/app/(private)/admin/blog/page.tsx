'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface BlogPost {
  id: string
  title: string
  slug: string
  published: boolean
  publishedAt: string | null
  createdAt: string
  pinned: boolean
  pinnedAt: string | null
  author?: {
    name: string
  }
}

export default function AdminBlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchPosts()
  }, [])

  const fetchPosts = async () => {
    try {
      const response = await fetch('/api/admin/blog', {
        credentials: 'include',
        cache: 'no-store'
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Unauthorized - Please login as admin')
          return
        }
        throw new Error('Failed to fetch posts')
      }
      
      const data = await response.json()
      console.log('Fetched data:', data) // Debug log
      
      // Handle ultra-compatible response format - find the array regardless of key
      const postsArray = 
        data.items ||
        data.posts ||
        data.rows ||
        data.list ||
        data.results ||
        (data.payload && data.payload.items) ||
        (Array.isArray(data.data) ? data.data : data.data?.items) ||
        []
      
      setPosts(Array.isArray(postsArray) ? postsArray : [])
    } catch (error) {
      console.error('Error fetching posts:', error)
      setError('Failed to load blog posts')
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePublish = async (id: string, published: boolean) => {
    try {
      const response = await fetch(`/api/admin/blog/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish', value: !published }),
        credentials: 'include'
      })
      
      if (response.ok) {
        fetchPosts()
      } else {
        console.error('Failed to toggle publish status:', response.status, await response.text())
      }
    } catch (error) {
      console.error('Error updating post:', error)
    }
  }

  const handleTogglePin = async (id: string, pinned: boolean) => {
    try {
      const response = await fetch(`/api/admin/blog/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pin', value: !pinned }),
        credentials: 'include'
      })
      
      if (response.ok) {
        fetchPosts()
      } else {
        console.error('Failed to toggle pin status:', response.status, await response.text())
      }
    } catch (error) {
      console.error('Error updating post:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return
    
    try {
      const response = await fetch(`/api/admin/blog/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        fetchPosts()
      }
    } catch (error) {
      console.error('Error deleting post:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Blog Posts</h1>
        <Link
          href="/admin/blog/new"
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          New Post
        </Link>
      </div>

      {posts.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 mb-4">No blog posts yet.</p>
          <Link
            href="/admin/blog/new"
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your First Post
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pinned
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Author
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {post.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        /{post.slug}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      post.published 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {post.published ? 'Published' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {post.pinned && (
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                        📌 Pinned
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {post.author?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {post.publishedAt 
                      ? new Date(post.publishedAt).toLocaleDateString()
                      : new Date(post.createdAt).toLocaleDateString()
                    }
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <Link
                      href={`/admin/blog/${post.id}/edit`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleTogglePublish(post.id, post.published)}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      {post.published ? 'Unpublish' : 'Publish'}
                    </button>
                    <button
                      onClick={() => handleTogglePin(post.id, post.pinned)}
                      className="text-yellow-600 hover:text-yellow-800"
                    >
                      {post.pinned ? 'Unpin' : 'Pin'}
                    </button>
                    {post.published && (
                      <Link
                        href={`/blog/${post.slug}`}
                        target="_blank"
                        className="text-green-600 hover:text-green-800"
                      >
                        View
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
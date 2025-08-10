'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Custom Editor Component
function CustomEditor({ value, onChange }: { value: string, onChange: (value: string) => void }) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showBgColorPicker, setShowBgColorPicker] = useState(false)
  
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const insertBulletAtCaret = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
    
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    
    const range = sel.getRangeAt(0)
    const bulletNode = document.createTextNode('• ')
    range.insertNode(bulletNode)
    
    // Move caret after bullet
    range.setStartAfter(bulletNode)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    
    // Update content
    onChange(editorRef.current.innerHTML)
  }

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const insertOrderedList = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
    
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    
    const range = sel.getRangeAt(0)
    const numberNode = document.createTextNode('1. ')
    range.insertNode(numberNode)
    
    range.setStartAfter(numberNode)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    
    onChange(editorRef.current.innerHTML)
  }

  const insertLink = () => {
    const url = prompt('Enter URL:')
    if (!url) return
    
    const text = prompt('Enter link text:') || url
    if (!editorRef.current) return
    
    editorRef.current.focus()
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    
    const range = sel.getRangeAt(0)
    const link = document.createElement('a')
    link.href = url
    link.textContent = text
    link.style.color = '#0066cc'
    link.style.textDecoration = 'underline'
    
    range.insertNode(link)
    range.setStartAfter(link)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
    
    onChange(editorRef.current.innerHTML)
  }

  const insertBlockquote = () => {
    if (!editorRef.current) return
    editorRef.current.focus()
    
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    
    const range = sel.getRangeAt(0)
    const blockquote = document.createElement('blockquote')
    blockquote.style.borderLeft = '4px solid #ccc'
    blockquote.style.paddingLeft = '1rem'
    blockquote.style.margin = '1rem 0'
    blockquote.style.fontStyle = 'italic'
    blockquote.innerHTML = 'Quote text here...'
    
    range.insertNode(blockquote)
    range.selectNodeContents(blockquote)
    sel.removeAllRanges()
    sel.addRange(range)
    
    onChange(editorRef.current.innerHTML)
  }

  const applyTextColor = (color: string) => {
    formatText('foreColor', color)
    setShowColorPicker(false)
  }

  const applyBackgroundColor = (color: string) => {
    formatText('backColor', color)
    setShowBgColorPicker(false)
  }

  const formatHeader = (level: number) => {
    if (!editorRef.current) return
    
    const tag = `h${level}`
    const sel = window.getSelection()
    if (!sel?.rangeCount) return
    
    const range = sel.getRangeAt(0)
    const header = document.createElement(tag)
    header.style.fontWeight = 'bold'
    header.style.fontSize = level === 1 ? '2rem' : level === 2 ? '1.75rem' : '1.5rem'
    header.style.marginTop = '2rem'
    header.style.marginBottom = '1rem'
    
    if (range.collapsed) {
      header.innerHTML = `Header ${level} text`
      range.insertNode(header)
    } else {
      const contents = range.extractContents()
      header.appendChild(contents)
      range.insertNode(header)
    }
    
    onChange(editorRef.current.innerHTML)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const sel = window.getSelection()
      if (!sel?.rangeCount) return
      
      const range = sel.getRangeAt(0)
      const br = document.createElement('br')
      range.insertNode(br)
      
      const zwsp = document.createTextNode('\u200B') // zero-width space
      br.parentNode?.insertBefore(zwsp, br.nextSibling)
      
      const newRange = document.createRange()
      newRange.setStartAfter(zwsp)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
      
      e.preventDefault()
      if (editorRef.current) {
        onChange(editorRef.current.innerHTML)
      }
    }
  }

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML)
    }
  }

  const colors = ['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080', '#008000']

  return (
    <div className="border border-gray-300 rounded-md">
      {/* Toolbar */}
      <div className="border-b border-gray-200 p-2 bg-gray-50">
        {/* Row 1 - Headers */}
        <div className="flex gap-1 mb-2">
          <button type="button" onClick={() => formatHeader(1)} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black font-semibold">H1</button>
          <button type="button" onClick={() => formatHeader(2)} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black font-semibold">H2</button>
          <button type="button" onClick={() => formatHeader(3)} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black font-semibold">H3</button>
        </div>
        
        {/* Row 2 - Basic Formatting */}
        <div className="flex gap-1 mb-2">
          <button type="button" onClick={() => formatText('bold')} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 font-bold text-black">B</button>
          <button type="button" onClick={() => formatText('italic')} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 italic text-black">I</button>
          <button type="button" onClick={() => formatText('underline')} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 underline text-black">U</button>
          <button type="button" onClick={() => formatText('strikeThrough')} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 line-through text-black">S</button>
        </div>
        
        {/* Row 3 - Colors */}
        <div className="flex gap-1 mb-2">
          <div className="relative">
            <button type="button" onClick={() => setShowColorPicker(!showColorPicker)} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black font-semibold">A</button>
            {showColorPicker && (
              <div className="absolute top-8 left-0 bg-white border rounded shadow-lg p-4 z-10">
                <div className="grid grid-cols-5 gap-6">
                  {colors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => applyTextColor(color)}
                      className="w-8 h-8 border-2 rounded hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="relative">
            <button type="button" onClick={() => setShowBgColorPicker(!showBgColorPicker)} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black">⬛</button>
            {showBgColorPicker && (
              <div className="absolute top-8 left-0 bg-white border rounded shadow-lg p-4 z-10">
                <div className="grid grid-cols-5 gap-6">
                  {colors.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => applyBackgroundColor(color)}
                      className="w-8 h-8 border-2 rounded hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Row 4 - Lists and Others */}
        <div className="flex gap-1 mb-2">
          <button type="button" onClick={insertOrderedList} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black font-semibold">1.</button>
          <button type="button" onClick={insertBulletAtCaret} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black font-semibold">•</button>
          <button type="button" onClick={insertLink} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black">🔗</button>
          <button type="button" onClick={insertBlockquote} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black">❝</button>
        </div>
        
        {/* Row 5 - Alignment */}
        <div className="flex gap-1">
          <button type="button" onClick={() => formatText('justifyLeft')} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black">⬅️</button>
          <button type="button" onClick={() => formatText('justifyCenter')} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black">⬇️</button>
          <button type="button" onClick={() => formatText('justifyRight')} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black">➡️</button>
          <button type="button" onClick={() => formatText('removeFormat')} className="px-2 py-1 text-sm border rounded hover:bg-gray-100 text-black">🧹</button>
        </div>
      </div>
      
      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        className="p-4 min-h-96 focus:outline-none"
        style={{ 
          color: '#000000', 
          backgroundColor: '#ffffff',
          fontSize: '14px',
          lineHeight: '1.5'
        }}
        suppressContentEditableWarning={true}
      />
    </div>
  )
}

export default function NewBlogPostPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    published: false,
    authorName: ''
  })

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const handleTitleChange = (title: string) => {
    setFormData(prev => ({
      ...prev,
      title,
      slug: prev.slug || generateSlug(title)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        router.push('/admin/blog')
      } else {
        throw new Error('Failed to create post')
      }
    } catch (error) {
      console.error('Error creating post:', error)
      alert('Failed to create post. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">New Blog Post</h1>
        <button
          onClick={() => router.back()}
          className="text-gray-200 hover:text-white border border-gray-300 px-4 py-2 rounded"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slug *
              </label>
              <input
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                URL: /blog/{formData.slug}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Author Name
            </label>
            <input
              type="text"
              value={formData.authorName}
              onChange={(e) => setFormData(prev => ({ ...prev, authorName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Will Smith, Alex Burnett, etc."
            />
            <p className="text-xs text-gray-500 mt-1">
              The name that will appear as "By [Author Name]" on the blog post
            </p>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Excerpt
            </label>
            <textarea
              value={formData.excerpt}
              onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description for the blog listing page..."
            />
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Content *
            </label>
            <CustomEditor
              value={formData.content}
              onChange={(value) => setFormData(prev => ({ ...prev, content: value }))}
            />
            <p className="text-xs text-gray-500 mt-1">
              Use the toolbar above to format your text. What you see is exactly what will appear on the frontend.
            </p>
          </div>

          <div className="mt-6 flex items-center">
            <input
              type="checkbox"
              id="published"
              checked={formData.published}
              onChange={(e) => setFormData(prev => ({ ...prev, published: e.target.checked }))}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="published" className="ml-2 block text-sm text-gray-700">
              Publish immediately
            </label>
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2 border border-gray-300 rounded-md text-gray-200 hover:text-white hover:border-gray-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Post'}
          </button>
        </div>
      </form>
    </div>
  )
}
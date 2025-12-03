'use client';

import { useState } from 'react';

interface ShareIconsProps {
  title: string;
  url: string;
}

// Client-side origin detection
const getOrigin = () => typeof window !== 'undefined' ? window.location.origin : '';

export default function ShareIcons({ title, url }: ShareIconsProps) {
  const [copied, setCopied] = useState(false);

  // Make sure we have a fully qualified URL
  const fullUrl = url.startsWith('http') ? url : `${getOrigin()}${url}`;
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleShare = (platform: 'twitter' | 'facebook') => {
    let shareUrl = '';
    
    if (platform === 'twitter') {
      shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(fullUrl)}`;
    } else if (platform === 'facebook') {
      shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`;
    }
    
    if (shareUrl) {
      window.open(shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <button 
        onClick={() => handleShare('twitter')}
        className="p-1.5 bg-[#2c2f3a] hover:bg-[#343747] rounded-md transition-colors" 
        title="Share on Twitter"
        aria-label="Share on Twitter"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#1DA1F2]">
          <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path>
        </svg>
      </button>
      
      <button 
        onClick={() => handleShare('facebook')}
        className="p-1.5 bg-[#2c2f3a] hover:bg-[#343747] rounded-md transition-colors" 
        title="Share on Facebook"
        aria-label="Share on Facebook"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#1877F2]">
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path>
        </svg>
      </button>
      
      <button 
        onClick={handleCopyLink}
        className="p-1.5 bg-[#2c2f3a] hover:bg-[#343747] rounded-md transition-colors" 
        title="Copy link"
        aria-label="Copy link"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#68D08B]">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
      </button>
      
      {copied && (
        <span className="text-xs text-white/80 bg-[#343747] px-2 py-1 rounded-md">
          Link copied!
        </span>
      )}
    </div>
  );
} 
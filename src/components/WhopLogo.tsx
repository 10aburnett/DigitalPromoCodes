'use client';

import { useState } from 'react';
import Image from 'next/image';
import { normalizeImagePath, getImageFallbackPaths } from '@/lib/image-utils';
import InitialsAvatar from '@/components/InitialsAvatar';

interface Whop {
  id: string;
  name: string;
  logo: string | null;
}

interface WhopLogoProps {
  whop: Whop;
}

export default function WhopLogo({ whop }: WhopLogoProps) {
  const [imageError, setImageError] = useState(false);
  const [imagePath, setImagePath] = useState(normalizeImagePath(whop.logo || ''));
  const [fallbackPaths] = useState(() => getImageFallbackPaths(whop.logo || ''));
  const [currentFallbackIndex, setCurrentFallbackIndex] = useState(0);
  
  const handleImageError = () => {
    console.error(`❌ Image failed to load: ${imagePath} for ${whop.name}`);
    
    // Try the next fallback path
    const nextIndex = currentFallbackIndex + 1;
    
    if (nextIndex < fallbackPaths.length) {
      const nextPath = fallbackPaths[nextIndex];
      console.log(`🔄 Trying fallback path ${nextIndex + 1}/${fallbackPaths.length}: ${nextPath} for ${whop.name}`);
      setCurrentFallbackIndex(nextIndex);
      setImagePath(nextPath);
    } else {
      // All alternatives failed, show initials
      console.log(`💔 All ${fallbackPaths.length} image paths failed for ${whop.name}, showing initials avatar`);
      console.log(`Failed paths were:`, fallbackPaths);
      setImageError(true);
    }
  };
  
  return (
    <>
      {!imageError ? (
        <Image
          src={imagePath}
          alt={`${whop.name} logo`}
          width={80}
          height={80}
          className="w-full h-full object-contain"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          priority
          unoptimized={imagePath.includes('@avif')}
          onError={handleImageError}
        />
      ) : (
        <InitialsAvatar 
          name={whop.name} 
          size="xl" 
          shape="square"
          className="w-full h-full"
        />
      )}
    </>
  );
} 
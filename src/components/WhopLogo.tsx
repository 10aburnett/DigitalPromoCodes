'use client';

import { useState } from 'react';
import Image from 'next/image';
import { normalizeImagePath } from '@/lib/image-utils';
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
  const imagePath = normalizeImagePath(whop.logo || '');
  
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
          onError={() => setImageError(true)}
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
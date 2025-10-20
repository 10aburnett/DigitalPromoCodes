'use client';

import React from 'react';

type Props = {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  loading?: 'eager' | 'lazy';
  decoding?: 'auto' | 'sync' | 'async';
  fallbackSrc?: string;
};

export default function LogoImg({
  src,
  alt,
  width = 48,
  height = 48,
  className,
  loading,
  decoding = 'async',
  fallbackSrc = '/logo.png',
}: Props) {
  const [current, setCurrent] = React.useState(src || fallbackSrc);
  return (
    <img
      src={current}
      alt={alt}
      width={width}
      height={height}
      className={className}
      loading={loading}
      decoding={decoding}
      onError={() => setCurrent(fallbackSrc)}
    />
  );
}

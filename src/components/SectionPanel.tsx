'use client';

import React from 'react';

export default function SectionPanel({
  title,
  subtitle,
  children,
  className = '',
  id,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`rounded-xl px-7 py-6 sm:p-8 border transition-theme ${className}`}
      style={{
        backgroundColor: 'var(--background-secondary)',
        borderColor: 'var(--border-color)',
      }}
    >
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">{title}</h2>
        {subtitle ? (
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
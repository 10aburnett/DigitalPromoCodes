// src/components/ClientLink.tsx
'use client';
import Link from 'next/link';
import { ComponentProps } from 'react';

export default function ClientLink(props: ComponentProps<typeof Link>) {
  return <Link {...props}>{props.children}</Link>;
}
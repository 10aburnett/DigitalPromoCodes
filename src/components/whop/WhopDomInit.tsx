'use client';
import { useEffect } from 'react';

export default function WhopDomInit() {
  useEffect(() => {
    const el = document.querySelector('#coupon'); // replace with your actual selector
    if (!el || !el.parentNode) return;            // hard guard
    // safe DOM work here...
  }, []);
  return null;
}

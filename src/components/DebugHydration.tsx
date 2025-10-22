// src/components/DebugHydration.tsx
'use client'
import { useEffect } from 'react';

export default function DebugHydration() {
  useEffect(() => {
    // Check Recommended section
    const recSec = document.querySelector('section[aria-label="Recommended for you"] ul');
    if (recSec) {
      const recIssues: Array<{i:number; reason:string}> = [];
      recSec.querySelectorAll('li').forEach((li, i) => {
        const first = li.firstElementChild;
        if (!first) recIssues.push({ i, reason: 'empty <li>' });
        else if (first.tagName.toLowerCase() !== 'a')
          recIssues.push({ i, reason: `first child is <${first.tagName.toLowerCase()}>` });
      });
      console.log('[probe] rec length =', recSec.children.length, 'issues =', recIssues);
    } else {
      console.log('[probe] no rec list');
    }

    // Check Alternatives section
    const altSec = document.querySelector('section[aria-label="Similar offers"] ul');
    if (altSec) {
      const altIssues: Array<{i:number; reason:string}> = [];
      altSec.querySelectorAll('li').forEach((li, i) => {
        const first = li.firstElementChild;
        if (!first) altIssues.push({ i, reason: 'empty <li>' });
        else if (first.tagName.toLowerCase() !== 'a')
          altIssues.push({ i, reason: `first child is <${first.tagName.toLowerCase()}>` });
      });
      console.log('[probe] alt length =', altSec.children.length, 'issues =', altIssues);
    } else {
      console.log('[probe] no alt list');
    }
  }, []);

  return null;
}
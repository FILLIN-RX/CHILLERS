'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminShortcut() {
  const router = useRouter();
  const buffer = useRef('');

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter' && buffer.current === 'admin') {
        buffer.current = '';
        router.push('/admin');
        return;
      }
      if (typeof e.key === 'string' && e.key.length === 1) {
        buffer.current += e.key.toLowerCase();
        if (!'admin'.startsWith(buffer.current)) {
          buffer.current = '';
        }
      } else {
        buffer.current = '';
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return null;
}

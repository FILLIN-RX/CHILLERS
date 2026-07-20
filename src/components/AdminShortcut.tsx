'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const BUFFER_RESET_MS = 1500;

export default function AdminShortcut() {
  const router = useRouter();
  const buffer = useRef('');
  // Tracks the last keystroke so an idle period (> BUFFER_RESET_MS) clears the
  // buffer. Without this, typing "a" then waiting 30s then typing "dmin" would
  // still trigger the admin redirect.
  const lastKeyAt = useRef(0);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Non-printable keys (Shift, ArrowUp, etc.) wipe the buffer immediately.
      if (typeof e.key !== 'string' || e.key.length !== 1) {
        buffer.current = '';
        return;
      }

      const now = Date.now();
      if (now - lastKeyAt.current > BUFFER_RESET_MS) {
        buffer.current = '';
      }
      lastKeyAt.current = now;

      buffer.current += e.key.toLowerCase();

      if (buffer.current === 'admin') {
        if (e.key === 'Enter' || buffer.current.length > 5) {
          // Accept either an explicit Enter or any keystroke that completed the
          // sequence (so a fast typist isn't penalised for not pressing Enter).
          buffer.current = '';
          router.push('/admin');
          return;
        }
      }
      if (!'admin'.startsWith(buffer.current)) {
        buffer.current = '';
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return null;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminShortcut() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Détecte Ctrl + Shift + A (ou Cmd + Shift + A sur macOS)
      const isModifierActive = e.ctrlKey || e.metaKey;
      const isShiftActive = e.shiftKey;
      const isAKey = e.key === 'A' || e.key === 'a' || e.code === 'KeyA';

      if (isModifierActive && isShiftActive && isAKey) {
        e.preventDefault();
        router.push('/admin');
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return null;
}

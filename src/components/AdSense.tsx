'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

const ADSENSE_CLIENT_ID = 'ca-pub-8325042872748312';

export default function AdSense() {
  const { user } = useAuthStore();

  const isSubscriber =
    user?.role === 'admin' ||
    ((user?.subscription?.plan === 'standard' || user?.subscription?.plan === 'premium') &&
      user?.subscription?.status === 'active');

  useEffect(() => {
    if (isSubscriber) {
      const existingScript = document.querySelector(`script[src*="${ADSENSE_CLIENT_ID}"]`);
      if (existingScript) existingScript.remove();
      const adContainers = document.querySelectorAll('.adsbygoogle, ins.adsbygoogle');
      adContainers.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
      return;
    }

    const loadAds = () => {
      if (document.querySelector(`script[src*="${ADSENSE_CLIENT_ID}"]`)) return;
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);

      window.removeEventListener('scroll', loadAds);
      window.removeEventListener('mousemove', loadAds);
      window.removeEventListener('touchstart', loadAds);
    };

    window.addEventListener('scroll', loadAds, { once: true, passive: true });
    window.addEventListener('mousemove', loadAds, { once: true, passive: true });
    window.addEventListener('touchstart', loadAds, { once: true, passive: true });

    // Fallback if no interaction after 8 seconds
    const fallbackTimer = setTimeout(loadAds, 8000);

    return () => {
      window.removeEventListener('scroll', loadAds);
      window.removeEventListener('mousemove', loadAds);
      window.removeEventListener('touchstart', loadAds);
      clearTimeout(fallbackTimer);
    };
  }, [isSubscriber]);

  return null;
}

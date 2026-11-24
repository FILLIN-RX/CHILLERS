'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSubscriptionStore, isUserSubscriber } from '@/stores/useSubscriptionStore';

const ADSENSE_CLIENT_ID = 'ca-pub-8325042872748312';

export default function AdSense() {
  const { user } = useAuthStore();
  const globalSubscriptionEnabled = useSubscriptionStore((s) => s.globalSubscriptionEnabled);

  const isSubscriber = isUserSubscriber(user, globalSubscriptionEnabled);

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
    };

    // Don't fetch a large third-party bundle during the user's first tap.
    window.addEventListener('scroll', loadAds, { once: true, passive: true });

    // Keep ad code off the initial critical path; load only once the browser is
    // idle, or after the visitor has had time to use the page.
    let idleId: number | undefined;
    let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
    if ("requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(loadAds, { timeout: 12000 });
    } else {
      fallbackTimer = setTimeout(loadAds, 12000);
    }

    return () => {
      window.removeEventListener('scroll', loadAds);
      if (idleId !== undefined) window.cancelIdleCallback?.(idleId);
      if (fallbackTimer) clearTimeout(fallbackTimer);
    };
  }, [isSubscriber]);

  return null;
}

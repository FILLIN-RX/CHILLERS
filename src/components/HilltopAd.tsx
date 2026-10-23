'use client';

import { useEffect, useRef } from 'react';

const HILLTOP_SCRIPT_URL =
  'https://massivesalad.com/bSX_VrsLd.GFlW0vYsWDcU/tegmW9ruuZyUQlskmPFThcG1-NqDEQw2YO/TkMqtRNoz/Uq0rNtDfYb5XNpwN';

type HilltopAdProps = {
  className?: string;
  label?: string;
  settings?: Record<string, unknown>;
};

/** Client-side HilltopAds slot. Place one instance at each intended ad position. */
export default function HilltopAd({
  className,
  label = 'Publicité',
  settings,
}: HilltopAdProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;

    const loadAd = () => {
      if (startedRef.current || !slotRef.current) return;
      startedRef.current = true;

      const script = document.createElement('script') as HTMLScriptElement & {
        settings?: Record<string, unknown>;
      };
      script.settings = settings ?? {};
      script.src = HILLTOP_SCRIPT_URL;
      script.async = true;
      script.referrerPolicy = 'no-referrer-when-downgrade';
      slotRef.current.appendChild(script);
    };

    if (!('IntersectionObserver' in window)) {
      loadAd();
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          loadAd();
          observer.disconnect();
        }
      },
      { rootMargin: '200px 0px' },
    );

    observer.observe(slot);
    return () => observer.disconnect();
  }, [settings]);

  return (
    <div
      ref={slotRef}
      className={['hilltop-ad-slot', className].filter(Boolean).join(' ')}
      aria-label={label}
      data-ad-provider="hilltopads"
      style={{ minHeight: 64 }}
    />
  );
}

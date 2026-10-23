'use client';

import { useEffect, useRef } from 'react';

const HILLTOP_ZONES = {
  primary:
    'https://massivesalad.com/bSX_VrsLd.GFlW0vYsWDcU/tegmW9ruuZyUQlskmPFThcG1-NqDEQw2YO/TkMqtRNoz/Uq0rNtDfYb5XNpwN',
  secondary:
    'https://massivesalad.com/b.XMVdszd/GklF0/Y_WZcu/mevmd9quDZjUQlkkQPoT/cE1ANTDiQZ3NOZTDcotuNbzHUy0KNtD/gzwdMvQQ',
  tertiary:
    'https://massivesalad.com/bDXGVHs.d/Gnls0qYiWEcw/feVmQ9BuTZnUrlIkbPbT/cn1/NtDEQX4/MvjaUatbNJzHUi0WNyD_gLyUOEQF',
} as const;

export type HilltopZone = keyof typeof HILLTOP_ZONES;
export const HILLTOP_ZONE_ORDER: readonly HilltopZone[] = [
  'primary',
  'secondary',
  'tertiary',
];

export function getHilltopZoneForSlot(slot: number): HilltopZone {
  return HILLTOP_ZONE_ORDER[(Math.max(1, slot) - 1) % HILLTOP_ZONE_ORDER.length];
}

type HilltopAdProps = {
  className?: string;
  label?: string;
  settings?: Record<string, unknown>;
  zone?: HilltopZone;
};

/** Client-side HilltopAds slot. Place one instance at each intended ad position. */
export default function HilltopAd({
  className,
  label = 'Publicité',
  settings,
  zone = 'primary',
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
      script.src = HILLTOP_ZONES[zone];
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
  }, [settings, zone]);

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

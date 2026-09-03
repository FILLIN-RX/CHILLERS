'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';

const ADSENSE_CLIENT_ID = 'ca-pub-8325042872748312';

export default function AdSense() {
  const { user } = useAuthStore();

  // Les utilisateurs avec abonnement actif (Standard ou Premium) ou Administrateurs sont exemptés de publicités
  const isSubscriber =
    user?.role === 'admin' ||
    ((user?.subscription?.plan === 'standard' || user?.subscription?.plan === 'premium') &&
      user?.subscription?.status === 'active');

  useEffect(() => {
    // Si l'utilisateur est abonné, bloquer et nettoyer tout script Adsense existant
    if (isSubscriber) {
      const existingScript = document.querySelector(`script[src*="${ADSENSE_CLIENT_ID}"]`);
      if (existingScript) {
        existingScript.remove();
      }
      // Masquer les conteneurs d'annonces injectés
      const adContainers = document.querySelectorAll('.adsbygoogle, ins.adsbygoogle');
      adContainers.forEach((el) => {
        (el as HTMLElement).style.display = 'none';
      });
      return;
    }

    // Sinon, injecter le script Google AdSense s'il n'est pas déjà présent
    const existing = document.querySelector(`script[src*="${ADSENSE_CLIENT_ID}"]`);
    if (!existing) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }
  }, [isSubscriber]);

  return null;
}

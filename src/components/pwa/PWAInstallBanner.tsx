"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { IconX, IconDownload, IconShare, IconPlus, IconDeviceMobile } from "@tabler/icons-react";

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    // 1. Ne rien afficher si l'app est déjà en mode PWA / Standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // 2. Vérifier si l'utilisateur a déjà fermé la bannière récemment (7 jours)
    const dismissedUntil = localStorage.getItem("chillers-pwa-dismissed");
    if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
      return;
    }

    // 3. Détecter iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);
    setIsIosDevice(isIos);

    if (isIos) {
      // Sur iOS Safari, afficher la bannière après 3 secondes
      const timer = setTimeout(() => setShowBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // 4. Sur Android / Chrome : écouter l'événement standard beforeinstallprompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (isIosDevice) {
      setShowIosGuide(true);
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIosGuide(false);
    // Masquer pour 7 jours
    localStorage.setItem("chillers-pwa-dismissed", String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  };

  if (!showBanner) return null;

  return (
    <>
      {/* BANNIÈRE FLOTTANTE EN BAS D'ÉCRAN */}
      <div className="fixed bottom-4 left-4 right-4 z-[90] max-w-md mx-auto animate-slide-up">
        <div className="relative flex items-center gap-3 p-3.5 rounded-2xl bg-[#141414]/95 border border-white/10 shadow-2xl backdrop-blur-xl">
          <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-black border border-white/10">
            <Image
              src="/android-chrome-192x192.png"
              alt="CHILLERS App"
              fill
              sizes="44px"
              className="object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-white truncate">Installer l'application</h3>
            <p className="text-xs text-white/60 truncate">Streaming fluide, hors-ligne et sans pub</p>
          </div>

          <button
            onClick={handleInstallClick}
            className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-black hover:bg-zinc-200 active:scale-95 transition-all cursor-pointer shadow-md"
          >
            <IconDownload className="w-3.5 h-3.5" />
            Installer
          </button>

          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-white/40 hover:text-white transition-colors"
            aria-label="Fermer"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MODALE GUIDE D'INSTALLATION SPÉCIALE IPHONE / IOS */}
      {showIosGuide && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowIosGuide(false);
          }}
        >
          <div className="relative w-full max-w-sm rounded-3xl bg-[#18181b] border border-white/10 p-6 text-center shadow-2xl animate-scale-up">
            <button
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 text-white/70 hover:text-white"
            >
              <IconX className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-brand-primary/10 border border-brand-primary/25 text-brand-primary flex items-center justify-center mx-auto mb-4">
              <IconDeviceMobile className="w-7 h-7" />
            </div>

            <h3 className="text-lg font-black text-white mb-1">Installer sur iPhone</h3>
            <p className="text-xs text-white/60 mb-5">
              Profitez du plein écran et de vos téléchargements hors-ligne :
            </p>

            <div className="space-y-3 text-left mb-6">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="w-6 h-6 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <p className="text-xs text-white/80">
                  Appuyez sur le bouton <span className="font-bold text-white inline-flex items-center gap-1 mx-1"><IconShare className="w-3.5 h-3.5 text-blue-400" /> Partager</span> dans Safari
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="w-6 h-6 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <p className="text-xs text-white/80">
                  Faites défiler et choisissez <span className="font-bold text-white inline-flex items-center gap-1 mx-1"><IconPlus className="w-3.5 h-3.5" /> Sur l'écran d'accueil</span>
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                <span className="w-6 h-6 rounded-full bg-white/10 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <p className="text-xs text-white/80">
                  Appuyez sur <span className="font-bold text-white">Ajouter</span> en haut à droite. C'est tout !
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowIosGuide(false)}
              className="w-full py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-colors"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </>
  );
}

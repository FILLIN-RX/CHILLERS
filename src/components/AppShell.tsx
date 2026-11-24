"use client";

import React, { useState, useEffect, Suspense, useCallback, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowsOutSimple, X } from "@phosphor-icons/react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import NetworkStatusBanner from "@/components/NetworkStatusBanner";
import { useSplashReady } from "@/hooks/useSplashReady";
import { useDownloadToastEmitter } from "@/hooks/useDownloadToast";
import { MiniPlayerContext, type MiniPlayerSession } from "@/components/providers/MiniPlayerContext";

const DownloadFloatingBar = dynamic(
  () => import("@/features/downloads/DownloadFloatingBar"),
  { ssr: false },
);

const DownloadSuccessToast = dynamic(
  () => import("@/features/downloads/DownloadSuccessToast"),
  { ssr: false },
);

const DonationModal = dynamic(() => import("@/components/DonationModal"), {
  ssr: false,
});

const SupportIntroModal = dynamic(
  () => import("@/components/SupportIntroModal"),
  { ssr: false },
);

const CompactVideoPlayer = dynamic(() => import("@/components/VideoPlayer"), {
  ssr: false,
});

interface AppShellProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
}

export default function AppShell({ children, showBottomNav }: AppShellProps) {
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const router = useRouter();
  const openSearch = () => router.push("/search");

  // Fire window events whenever a download task transitions to "done"
  useDownloadToastEmitter();
  const pathname = usePathname();
  const [miniPlayerSession, setMiniPlayerSession] = useState<MiniPlayerSession | null>(null);
  const registerMiniPlayer = useCallback((session: MiniPlayerSession) => {
    setMiniPlayerSession((previous) => previous?.key === session.key ? previous : session);
  }, []);
  const closeMiniPlayer = useCallback(() => setMiniPlayerSession(null), []);
  const miniPlayerContext = useMemo(
    () => ({ setSession: registerMiniPlayer, close: closeMiniPlayer }),
    [registerMiniPlayer, closeMiniPlayer],
  );

  // Fallback : garantit que le splash disparaît sur les pages sans fetch home.
  // Les pages détail servent leurs données via RSC (SSR) : le contenu est déjà
  // utilisable à l'hydratation, inutile d'attendre 1.5s — 400ms suffisent.
  useSplashReady(400);

  // Fullscreen player routes: no page chrome, just the player with its controls (for raw live embed & direct live matches).
  const isPlayerRoute =
    pathname?.startsWith("/live/lb/") ||
    pathname?.startsWith("/live/sp/") ||
    (pathname?.startsWith("/live/") && pathname !== "/live");
  const isPlaybackPage = pathname?.startsWith("/watch/") || /\/season\/\d+/.test(pathname || "");

  const shouldShowBottomNav =
    typeof showBottomNav === "boolean"
      ? showBottomNav
      : !pathname?.startsWith("/watch/") && !isPlayerRoute;

  // Never let the donation overlay pop on live pages: it blocks the tab/multi
  // switching and video controls while watching.
  const isLivePath = pathname?.startsWith("/live");

  // Préchauffe la recherche pendant les temps morts : route + chunk JS déjà en
  // cache → l'ouverture depuis le Header/BottomNav est quasi instantanée.
  useEffect(() => {
    let idleId: number | undefined;
    const warm = () => {
      router.prefetch("/search");
      void import("@/components/SearchOverlay");
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (w.requestIdleCallback) {
      idleId = w.requestIdleCallback(warm, { timeout: 2500 });
      return () => {
        if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
      };
    }
    const t = setTimeout(warm, 1200);
    return () => clearTimeout(t);
  }, [router]);

  useEffect(() => {
    const handleSearch = () => router.push("/search");
    // Suppress donation popup entirely on live pages (both auto and manual triggers)
    const handleDonation = () => {
      if (isLivePath) return;
      setIsDonationOpen(true);
    };

    window.addEventListener("open-search", handleSearch);
    window.addEventListener("open-donation", handleDonation);

    // Auto-pop intro de soutien (une fois par session) : Fermer / Soutenir
    try {
      const alreadyShown = sessionStorage.getItem("chillers_donation_shown");
      if (!alreadyShown && !pathname?.startsWith("/admin") && !isLivePath) {
        const timer = setTimeout(() => {
          setIsIntroOpen(true);
          sessionStorage.setItem("chillers_donation_shown", "true");
        }, 1800);
        return () => {
          clearTimeout(timer);
          window.removeEventListener("open-search", handleSearch);
          window.removeEventListener("open-donation", handleDonation);
        };
      }
    } catch {}

    return () => {
      window.removeEventListener("open-search", handleSearch);
      window.removeEventListener("open-donation", handleDonation);
    };
  }, [pathname, isLivePath, router]);

  const isAuthPage = pathname === "/login" || pathname === "/register";
  // Pages de paiement focus (don / abonnement) : plein écran, sans footer.
  const isPaymentPage = pathname === "/support" || pathname === "/subscribe";

  return (
    <MiniPlayerContext.Provider value={miniPlayerContext}>
    <>
      <SupportIntroModal
        isOpen={isIntroOpen}
        onClose={() => setIsIntroOpen(false)}
        onSupport={() => {
          setIsIntroOpen(false);
          setIsDonationOpen(true);
        }}
      />
      <DonationModal
        isOpen={isDonationOpen}
        onClose={() => setIsDonationOpen(false)}
      />
      {/* Suspense obligatoire : Header lit useSearchParams() — sans frontière,
          la moindre page statique (?genre) échouerait au prerender. */}
      <Suspense>
        {!isAuthPage && !isPlayerRoute && <Header onSearchClick={openSearch} />}
      </Suspense>
      <main className="flex-1 flex flex-col">{children}</main>
      {miniPlayerSession && !isPlaybackPage && !isAuthPage && (
        <aside
          aria-label={`Mini lecteur : ${miniPlayerSession.item.title}`}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 z-[130] w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-white/15 bg-zinc-950 shadow-[0_16px_56px_rgba(0,0,0,0.65)] sm:bottom-5 sm:right-5"
        >
          <div className="flex h-10 items-center gap-2 border-b border-white/10 bg-zinc-900/95 px-3">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
              {miniPlayerSession.item.title}
            </span>
            {miniPlayerSession.episode && (
              <span className="shrink-0 text-[10px] text-zinc-400">
                S{miniPlayerSession.episode.season} · E{miniPlayerSession.episode.number}
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                const { item, episode } = miniPlayerSession;
                const params = new URLSearchParams({ type: item.type });
                if (episode?.season) params.set("season", String(episode.season));
                if (episode?.number) params.set("episode", String(episode.number));
                router.push(`/watch/${item.id}?${params.toString()}`);
              }}
              aria-label="Agrandir le lecteur"
              title="Agrandir le lecteur"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <ArrowsOutSimple size={16} />
            </button>
            <button
              type="button"
              onClick={closeMiniPlayer}
              aria-label="Fermer le mini lecteur"
              title="Fermer le mini lecteur"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-300 hover:bg-white/10 hover:text-white"
            >
              <X size={17} />
            </button>
          </div>
          <CompactVideoPlayer
            key={miniPlayerSession.key}
            item={miniPlayerSession.item}
            episode={miniPlayerSession.episode}
            audioVersion={miniPlayerSession.audioVersion}
            streamReferer={miniPlayerSession.streamReferer}
            compact
            onBack={closeMiniPlayer}
          />
        </aside>
      )}
      {!isAuthPage && !isPaymentPage && !pathname?.startsWith("/profile") && !isPlayerRoute && <Footer />}
      {!isPlayerRoute && <NetworkStatusBanner />}
      <Suspense>
        {!isPlayerRoute && <DownloadFloatingBar />}
      </Suspense>
      <Suspense>
        <DownloadSuccessToast />
      </Suspense>
      {shouldShowBottomNav && !isAuthPage && !isPlayerRoute && <BottomNav onSearchClick={openSearch} />}
    </>
    </MiniPlayerContext.Provider>
  );
}

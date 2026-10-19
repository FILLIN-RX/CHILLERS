"use client";

import React, { useState, useEffect, Suspense } from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import NetworkStatusBanner from "@/components/NetworkStatusBanner";
import { useSplashReady } from "@/hooks/useSplashReady";
import { useDownloadToastEmitter } from "@/hooks/useDownloadToast";

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

  // Fallback : garantit que le splash disparaît sur les pages sans fetch home.
  // Les pages détail servent leurs données via RSC (SSR) : le contenu est déjà
  // utilisable à l'hydratation, inutile d'attendre 1.5s — 400ms suffisent.
  useSplashReady(400);

  // Fullscreen player routes: no page chrome, just the player with its controls (for raw live embed & direct live matches).
  const isPlayerRoute =
    pathname?.startsWith("/live/lb/") ||
    pathname?.startsWith("/live/sp/") ||
    (pathname?.startsWith("/live/") && pathname !== "/live");

  const shouldShowBottomNav =
    typeof showBottomNav === "boolean"
      ? showBottomNav
      : !pathname?.startsWith("/watch/") && !isPlayerRoute;

  // Never let the donation overlay pop on live pages: it blocks the tab/multi
  // switching and video controls while watching.
  const isLivePath = pathname?.startsWith("/live");

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
  );
}

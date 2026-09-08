"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { WifiSlash, WifiHigh, DownloadSimple, X, ArrowRight } from "@phosphor-icons/react";
import { useNetworkStore } from "@/hooks/useOnlineStatus";

export default function NetworkStatusNotifier() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [showRestored, setShowRestored] = useState<boolean>(false);
  const [dismissedOffline, setDismissedOffline] = useState<boolean>(false);
  const [redirectToast, setRedirectToast] = useState<string | null>(null);

  const pathname = usePathname();
  const router = useRouter();
  const setStoreOnline = useNetworkStore((s) => s.setOnline);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Initial check
    const initialOnline = navigator.onLine;
    setIsOnline(initialOnline);
    setStoreOnline(initialOnline);

    const checkRealConnectivity = async () => {
      if (!navigator.onLine) {
        setIsOnline(false);
        setStoreOnline(false);
        return;
      }
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(`/favicon.ico?_ping=${Date.now()}`, {
          method: "HEAD",
          cache: "no-store",
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const online = res.ok || res.status < 500;
        setIsOnline(online);
        setStoreOnline(online);
      } catch {
        setIsOnline(false);
        setStoreOnline(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setStoreOnline(false);
      setDismissedOffline(false);
      setShowRestored(false);
    };

    const handleOnline = () => {
      checkRealConnectivity().then(() => {
        setIsOnline(true);
        setStoreOnline(true);
        setShowRestored(true);
        const timer = setTimeout(() => setShowRestored(false), 4000);
        return () => clearTimeout(timer);
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Dynamic periodic ping check every 20s
    const interval = setInterval(checkRealConnectivity, 20000);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, [setStoreOnline]);

  // YouTube Style Interceptor : intercept click on links when offline to redirect to /downloads
  useEffect(() => {
    if (isOnline || typeof window === "undefined") return;

    const handleAnchorClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      if (!href) return;

      // Permit downloads link or hashes or external anchor
      if (href.startsWith("/downloads") || href.startsWith("#") || href.startsWith("javascript:")) {
        return;
      }

      // If offline and trying to navigate to online-only page
      e.preventDefault();
      setRedirectToast("Vous êtes hors-ligne. Seuls vos contenus téléchargés sont accessibles.");
      router.push("/downloads");
      setTimeout(() => setRedirectToast(null), 4000);
    };

    document.addEventListener("click", handleAnchorClick, true);
    return () => {
      document.removeEventListener("click", handleAnchorClick, true);
    };
  }, [isOnline, router]);

  // Ne pas afficher la bannière si l'utilisateur est déjà sur la page /downloads
  const isDownloadsPage = pathname === "/downloads";

  return (
    <>
      {/* Toast de redirection hors-ligne style YouTube */}
      {redirectToast && (
        <div className="fixed top-4 left-4 right-4 z-[100] max-w-md mx-auto animate-slide-down">
          <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-zinc-900/95 border border-red-500/40 shadow-2xl backdrop-blur-xl text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-500/20 text-red-400 shrink-0">
                <WifiSlash className="w-4 h-4" />
              </div>
              <p className="text-xs font-semibold text-zinc-200 truncate">{redirectToast}</p>
            </div>
            <button
              onClick={() => setRedirectToast(null)}
              className="p-1 text-zinc-400 hover:text-white transition-colors shrink-0"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Bannière Hors-Ligne Style YouTube */}
      {!isOnline && !dismissedOffline && !isDownloadsPage && (
        <div className="fixed bottom-4 left-4 right-4 z-[95] max-w-md mx-auto animate-slide-up">
          <div className="relative flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#141414]/95 border border-red-500/30 shadow-2xl backdrop-blur-xl text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 shrink-0">
                <WifiSlash className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">Mode Hors-Ligne</p>
                <p className="text-[11px] text-zinc-400 truncate">
                  Passez à vos téléchargements pour visionner vos vidéos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                href="/downloads"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-primary text-white text-xs font-bold hover:bg-brand-primary/90 transition-all shadow-md active:scale-95"
              >
                <DownloadSimple className="w-3.5 h-3.5" />
                <span>Mes fichiers</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
              <button
                onClick={() => setDismissedOffline(true)}
                className="p-1 text-zinc-400 hover:text-white transition-colors"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bannière Connexion Rétablie */}
      {showRestored && (
        <div className="fixed bottom-4 left-4 right-4 z-[95] max-w-md mx-auto animate-slide-up">
          <div className="relative flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-[#141414]/95 border border-emerald-500/30 shadow-2xl backdrop-blur-xl text-white">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shrink-0">
                <WifiHigh className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">Connexion rétablie</p>
                <p className="text-[11px] text-emerald-400 truncate">Vous êtes de nouveau en ligne</p>
              </div>
            </div>
            <button
              onClick={() => setShowRestored(false)}
              className="p-1 text-zinc-400 hover:text-white transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

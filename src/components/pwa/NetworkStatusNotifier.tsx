"use client";

import { useEffect, useRef, useState } from "react";
import { WifiSlash, WifiHigh } from "@phosphor-icons/react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * NetworkStatusNotifier — Top bar réseau style iOS/Android.
 *
 * - Hors-ligne  → barre jaune/amber en haut, slide depuis le top, safe-area respecté
 * - Connexion rétablie → passe en bleu, "Réseau rétabli", se ferme seule après 5s
 * - Aucun setInterval, aucun ping, aucun blocage de clics
 */
export default function NetworkStatusNotifier() {
  const { isOnline } = useOnlineStatus();

  // Tracks d'état pour contrôler l'affichage
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"offline" | "restored">("offline");
  const prevOnlineRef = useRef<boolean | null>(null);
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Premier rendu — initialiser sans animation
    if (prevOnlineRef.current === null) {
      prevOnlineRef.current = isOnline;
      if (!isOnline) {
        setMode("offline");
        setVisible(true);
      }
      return;
    }

    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!isOnline && wasOnline) {
      // Vient de perdre la connexion
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      setMode("offline");
      setVisible(true);
    }

    if (isOnline && !wasOnline) {
      // Connexion rétablie
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
      setMode("restored");
      setVisible(true);
      // Fermeture automatique après 5s
      autoCloseTimer.current = setTimeout(() => {
        setVisible(false);
      }, 5000);
    }
  }, [isOnline]);

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current);
  }, []);

  if (!visible) return null;

  const isRestored = mode === "restored";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
      className={[
        "fixed top-0 left-0 right-0 z-[200]",
        "transform transition-transform duration-300 ease-out",
        visible ? "translate-y-0" : "-translate-y-full",
        isRestored
          ? "bg-blue-600"
          : "bg-amber-500",
      ].join(" ")}
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2">
        {isRestored ? (
          <>
            <WifiHigh weight="bold" className="w-4 h-4 text-white shrink-0" />
            <span className="text-xs font-semibold text-white tracking-wide">
              Réseau rétabli
            </span>
          </>
        ) : (
          <>
            <WifiSlash weight="bold" className="w-4 h-4 text-white shrink-0" />
            <span className="text-xs font-semibold text-white tracking-wide">
              Pas de connexion internet
            </span>
          </>
        )}
      </div>
    </div>
  );
}

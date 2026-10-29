"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRinging } from "@phosphor-icons/react";
import { userService } from "@/services/user";
import { useAuthStore } from "@/stores/useAuthStore";

const decodeKey = (key: string) => {
  const padded = key + "=".repeat((4 - (key.length % 4)) % 4);
  return Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
};

const sameTeam = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Suit les deux équipes d'un match : active les notifications push de
 * l'appareil au premier clic et enregistre les noms dans `followedTeams`,
 * que le veilleur de buts compare aux scores LiveBall.
 */
export default function FollowMatchButton({
  home,
  away,
  iconOnly = false,
}: {
  home?: string;
  away?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const teamsKey = `${token ?? ""}|${home ?? ""}|${away ?? ""}`;
  // La clé évite d'afficher l'état « suivi » d'un autre match pendant le chargement.
  const [follow, setFollow] = useState<{ key: string; followed: boolean }>({ key: "", followed: false });
  const followed = follow.key === teamsKey && follow.followed;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    const teams = [home, away].filter((team): team is string => Boolean(team?.trim()));
    if (!token || !teams.length) return;
    void userService
      .getPushPreferences(token)
      .then((response) => {
        if (!active) return;
        const stored = response.data?.[0]?.followedTeams ?? [];
        setFollow({ key: teamsKey, followed: teams.every((team) => stored.some((name) => sameTeam(name, team))) });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [token, home, away, teamsKey]);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const toggle = useCallback(async () => {
    const teams = [home, away].filter((team): team is string => Boolean(team?.trim()));
    if (!token) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
      return;
    }
    if (!teams.length) return;
    setBusy(true);
    setNotice("");
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setNotice("Ce navigateur ne prend pas en charge les notifications.");
        return;
      }
      if (Notification.permission !== "granted") {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setNotice("Autorise les notifications dans le navigateur pour recevoir les buts.");
          return;
        }
      }
      const config = await userService.getPushConfig();
      const publicKey = config.data?.publicKey;
      if (!publicKey) {
        setNotice("Les alertes ne sont pas disponibles pour le moment.");
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeKey(publicKey),
        });
      }
      await userService.subscribePush(subscription.toJSON(), token);

      const current = await userService.getPushPreferences(token);
      const stored = current.data?.[0]?.followedTeams ?? [];
      const others = stored.filter((name) => !teams.some((team) => sameTeam(name, team)));
      const next = followed ? others : [...others, ...teams];
      await userService.updatePushPreferences(
        { endpoint: subscription.endpoint, followedTeams: next, preferences: { matches: true } },
        token,
      );
      setFollow({ key: teamsKey, followed: !followed });
      setNotice(followed ? "Alertes désactivées pour ce match." : `Alertes activées : buts de ${teams.join(" et ")}.`);
    } catch {
      setNotice("Impossible de modifier les alertes pour l'instant.");
    } finally {
      setBusy(false);
    }
  }, [away, followed, home, router, teamsKey, token]);

  const label = followed ? "Suivi" : "Suivre";

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={followed}
        aria-label={followed ? "Ne plus recevoir les buts de ce match" : "Recevoir une notification à chaque but de ce match"}
        title={followed ? "Ne plus recevoir les buts de ce match" : "Recevoir une notification à chaque but de ce match"}
        className={
          iconOnly
            ? `flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition-colors hover:bg-white/20 disabled:opacity-60 ${followed ? "text-brand-primary ring-1 ring-brand-primary/70" : ""}`
            : `inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full border px-6 py-2.5 text-xs font-black uppercase tracking-wider transition-colors disabled:opacity-60 ${
                followed
                  ? "border-brand-primary/60 bg-brand-primary/20 text-white hover:bg-brand-primary/30"
                  : "border-white/20 bg-white/10 text-white hover:bg-white/20"
              }`
        }
      >
        {followed ? <BellRinging className="h-4 w-4" weight="fill" /> : <Bell className="h-4 w-4" />}
        {!iconOnly && <span>{busy ? "…" : label}</span>}
      </button>
      {notice && (
        <p
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-full bg-black/85 px-4 py-2 text-center text-xs text-white backdrop-blur"
        >
          {notice}
        </p>
      )}
    </>
  );
}

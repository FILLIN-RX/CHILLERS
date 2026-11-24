"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Bell, BellRinging, SpinnerGap } from "@phosphor-icons/react";
import type { MovieOrShow } from "@/types/media";
import { userService } from "@/services/user";
import { useAuthStore } from "@/stores/useAuthStore";

function decodeVapidKey(key: string) {
  const padded = key + "=".repeat((4 - (key.length % 4)) % 4);
  return Uint8Array.from(atob(padded.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0));
}

export default function ReleaseReminderButton({ item }: { item: MovieOrShow }) {
  const token = useAuthStore((state) => state.token);
  const pathname = usePathname();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const { data: reminders = [], refetch } = useQuery({
    queryKey: ["release-reminders", token],
    queryFn: async () => (await userService.getReleaseReminders(token!)).data,
    enabled: Boolean(token),
    staleTime: 30_000,
  });
  const { data: pushConfig } = useQuery({
    queryKey: ["push-config"],
    queryFn: async () => (await userService.getPushConfig()).data,
    staleTime: 5 * 60_000,
  });
  const active = reminders.some((reminder) => reminder.tmdbId === item.id);

  const toggle = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!item.releaseDate || busy) return;
    if (!token) {
      setMessage("Connecte-toi pour enregistrer le rappel sur ton compte.");
      const returnTo = pathname || "/";
      router.push(`/login?redirect=${encodeURIComponent(returnTo)}`);
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      if (!active) {
        if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
          throw new Error("Les notifications push ne sont pas prises en charge par ce navigateur.");
        }
        if (Notification.permission === "denied") {
          throw new Error("Autorise les notifications CHILLERS dans les réglages du navigateur.");
        }
        if (!pushConfig?.publicKey) throw new Error("Les notifications ne sont pas configurées pour le moment.");
        const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
        if (permission !== "granted") throw new Error("Autorise les notifications pour recevoir le rappel.");

        await navigator.serviceWorker.register("/sw.js");
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: decodeVapidKey(pushConfig.publicKey),
          });
        }
        await userService.subscribePush(subscription.toJSON(), token);
        await userService.addReleaseReminder({
          tmdbId: item.id,
          title: item.title,
          releaseDate: item.releaseDate,
          posterUrl: item.posterUrl,
        }, token);
        await refetch();
        setMessage("Rappel activé");
      } else {
        await userService.removeReleaseReminder(item.id, token);
        await refetch();
        setMessage("Rappel annulé");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible de configurer le rappel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={active}
        aria-label={active ? `Annuler le rappel pour ${item.title}` : `Me notifier à la sortie de ${item.title}`}
        className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-lg backdrop-blur-xl transition-colors disabled:opacity-70 ${
          active
            ? "border-emerald-300/30 bg-emerald-950/80 text-emerald-100"
            : "border-white/20 bg-black/75 text-white hover:bg-black/90"
        }`}
      >
        {busy ? <SpinnerGap className="h-3.5 w-3.5 animate-spin" /> : active ? <BellRinging className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
        <span>{busy ? "Patiente…" : active ? "Rappel activé" : "Me notifier"}</span>
      </button>
      {message && <span className={`max-w-52 text-center text-[10px] leading-tight ${active ? "text-emerald-100" : "text-amber-100"}`} role="status">{message}</span>}
    </div>
  );
}

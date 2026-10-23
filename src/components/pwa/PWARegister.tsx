"use client";

import { useEffect } from "react";
import { userService } from "@/services/user";
import { useAuthStore } from "@/stores/useAuthStore";

/**
 * Enregistre automatiquement le Service Worker PWA dans le navigateur
 */
export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      let disposed = false;
      let registrationPromise: Promise<ServiceWorkerRegistration>;
      let pushPublicKey: string | null = null;
      void userService.getPushConfig().then((config) => { pushPublicKey = config.data?.publicKey || null; }).catch(() => {});
      const register = () => {
        if (!registrationPromise) {
          registrationPromise = navigator.serviceWorker.register("/sw.js").then((reg) => {
            console.log("[PWA] Service Worker actif:", reg.scope);
            return reg;
          });
          registrationPromise.catch((err) => console.warn("[PWA] Erreur Service Worker:", err));
        }
        return registrationPromise;
      };
      const syncGrantedSubscription = async () => {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        try {
          const config = await userService.getPushConfig();
          const publicKey = config.data?.publicKey;
          if (!publicKey || disposed) {
            console.warn('[Push] Abonnement impossible: le serveur ne publie pas sa clé VAPID.');
            return;
          }
          const registration = await register();
          let subscription = await registration.pushManager.getSubscription();
          if (!subscription) {
            const padding = "=".repeat((4 - publicKey.length % 4) % 4);
            const bytes = Uint8Array.from(atob((publicKey + padding).replace(/-/g, "+").replace(/_/g, "/")), c => c.charCodeAt(0));
            subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
          }
          const result = await userService.subscribePush(subscription.toJSON(), useAuthStore.getState().token || undefined);
          console.info('[Push] Navigateur abonné et enregistré par le backend.', { linkedAccount: Boolean(result.data?.linkedToAccount) });
        } catch (error) {
          console.warn("[Push] Synchronisation de l'abonnement impossible:", error);
        }
      };
      if (document.readyState === "complete") void register();
      else window.addEventListener("load", register, { once: true });
      void syncGrantedSubscription();

      // Ask at the first real visit interaction. requestPermission() must run
      // synchronously inside that gesture; network/SW work follows the prompt.
      const enableOnFirstAction = (event: Event) => {
        if (disposed || !("Notification" in window) || !("PushManager" in window)) return;
        if ((event.target as Element | null)?.closest?.("[data-push-permission-manual]")) return;
        if (Notification.permission !== "default") return;
        // Do not prompt for permission until the server is ready to subscribe this browser.
        if (!pushPublicKey) return;
        try {
          // Retry in a later browser tab/session when the prompt was dismissed,
          // but avoid nagging on every click during this same session.
          if (sessionStorage.getItem("chillers-push-permission-asked") === "1") return;
          sessionStorage.setItem("chillers-push-permission-asked", "1");
        } catch { /* Continue even if browser storage is unavailable. */ }
        removeActionListeners();
        console.info('[Push] Demande native de permission affichée après interaction.');
        void Notification.requestPermission().then(async (permission) => {
          console.info('[Push] Réponse du navigateur.', { permission });
          if (permission !== "granted" || disposed) return;
          await syncGrantedSubscription();
        }).catch((error) => console.warn("[Push] Demande d’autorisation interrompue:", error));
      };
      const actionEvents: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart"];
      function removeActionListeners() {
        actionEvents.forEach((type) => window.removeEventListener(type, enableOnFirstAction));
      }
      if ("Notification" in window && Notification.permission === "default") {
        actionEvents.forEach((type) => window.addEventListener(type, enableOnFirstAction, { once: true, passive: true }));
      }

      // Écouter les messages du Service Worker pour le background download
      const onWorkerMessage = (event: MessageEvent) => {
        if (!event.data) return;
        const { type, id } = event.data;
        if (type === "BG_FETCH_SUCCESS") {
          import("@/store/downloads").then(({ useDownloadsStore }) => {
            useDownloadsStore.getState().setStatus(id, "done");
          });
        } else if (type === "BG_FETCH_FAIL") {
          import("@/store/downloads").then(({ useDownloadsStore }) => {
            useDownloadsStore.getState().setStatus(id, "error", "Échec du téléchargement en arrière-plan");
          });
        }
      };
      navigator.serviceWorker.addEventListener("message", onWorkerMessage);
      return () => {
        disposed = true;
        removeActionListeners();
        window.removeEventListener("load", register);
        navigator.serviceWorker.removeEventListener("message", onWorkerMessage);
      };
    }
  }, []);

  return null;
}

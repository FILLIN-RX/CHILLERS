"use client";

import { useEffect } from "react";

/**
 * Enregistre automatiquement le Service Worker PWA dans le navigateur
 */
export default function PWARegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[PWA] Service Worker actif:", reg.scope);
          })
          .catch((err) => {
            console.warn("[PWA] Erreur Service Worker:", err);
          });
      });

      // Écouter les messages du Service Worker pour le background download
      navigator.serviceWorker.addEventListener("message", (event) => {
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
      });
    }
  }, []);

  return null;
}

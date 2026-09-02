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
    }
  }, []);

  return null;
}

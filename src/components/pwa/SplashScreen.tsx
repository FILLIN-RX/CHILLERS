"use client";

import { useEffect, useRef, useState } from "react";
import { useSplashStore } from "@/stores/useSplashStore";

/**
 * SplashScreen natif CHILLERS — comportement identique à une app mobile native.
 *
 * Architecture double-couche :
 *  1. Un div HTML statique (#__chillers_splash) est rendu par le serveur et s'affiche
 *     AVANT que React se charge — zéro flash de contenu vide.
 *  2. Ce composant React prend le relais : il attend que les données soient prêtes
 *     (via useSplashStore), puis anime la disparition et retire les deux éléments du DOM.
 */
export default function SplashScreen() {
  const ready = useSplashStore((s) => s.ready);
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track when mounted so we know hydration is complete
  useEffect(() => {
    setMounted(true);
    const staticSplash = document.getElementById("__chillers_splash");
    if (staticSplash) {
      staticSplash.style.transition = "opacity 0.5s ease";
    }
  }, []);

  /* Sécurité : disparaît au bout de 7s même si les données ne chargent jamais */
  useEffect(() => {
    if (!mounted) return;
    timerRef.current = setTimeout(() => {
      fadeOutSplash();
    }, 7000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [mounted]);

  /* Disparaît dès que les données sont prêtes */
  useEffect(() => {
    if (!ready || !mounted) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    fadeOutSplash();
  }, [ready, mounted]);

  function fadeOutSplash() {
    const staticSplash = document.getElementById("__chillers_splash");
    if (staticSplash) {
      staticSplash.style.opacity = "0";
      // Use CSS animation end event instead of arbitrary timeout
      const handleEnd = () => {
        staticSplash.removeEventListener("transitionend", handleEnd);
        staticSplash.remove();
      };
      staticSplash.addEventListener("transitionend", handleEnd);
      // Fallback removal if transitionend never fires
      setTimeout(() => {
        if (staticSplash.parentNode) staticSplash.remove();
      }, 1000);
    }
  }

  return null;
}

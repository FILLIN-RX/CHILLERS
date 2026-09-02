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
  const [phase, setPhase] = useState<"visible" | "fading" | "gone">("visible");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Masquer le splash pré-React SSR dès que React prend la main
  useEffect(() => {
    const staticSplash = document.getElementById("__chillers_splash");
    if (staticSplash) {
      // Garder le div visible — on le cachera via notre propre fondu
      staticSplash.style.transition = "opacity 0.5s ease";
    }
  }, []);

  /* Sécurité : disparaît au bout de 7s même si les données ne chargent jamais */
  useEffect(() => {
    timerRef.current = setTimeout(() => {
      triggerFade();
    }, 7000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Disparaît dès que les données sont prêtes */
  useEffect(() => {
    if (!ready) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    triggerFade();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  function triggerFade() {
    // Animer le div statique pré-React
    const staticSplash = document.getElementById("__chillers_splash");
    if (staticSplash) {
      staticSplash.style.opacity = "0";
      setTimeout(() => staticSplash.remove(), 520);
    }
    setPhase("fading");
    setTimeout(() => setPhase("gone"), 520);
  }

  if (phase === "gone") return null;

  // Ce composant React est transparent : toute la UI du splash vient du div statique.
  // On ne rend rien de visible ici, mais on garde le composant monté pour gérer
  // la logique de disparition.
  return null;
}

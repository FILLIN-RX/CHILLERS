"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

type LiquidGlassVariant = "brand" | "sport" | "page";

interface LiquidGlassIndicatorProps {
  /** Conteneur (nav) dans lequel chercher l'onglet actif. */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Change de valeur quand l'onglet actif change → re-mesure. */
  activeKey: string;
  variant?: LiquidGlassVariant;
  /** Marge horizontale appliquée à la pastille (négatif = déborde de l'onglet). */
  insetX?: number;
  /** Marge verticale appliquée à la pastille. */
  insetY?: number;
  className?: string;
}

interface PillRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const ACTIVE_SELECTOR = '[data-liquid-active="true"]';

/**
 * Pastille « liquid glass » qui glisse sous l'onglet actif d'une top bar.
 * La position est mesurée sur l'onglet marqué `data-liquid-active="true"`,
 * puis animée par ressort (léger rebond = effet liquide).
 */
export default function LiquidGlassIndicator({
  containerRef,
  activeKey,
  variant = "brand",
  insetX = 0,
  insetY = 0,
  className = "",
}: LiquidGlassIndicatorProps) {
  const [rect, setRect] = useState<PillRect | null>(null);
  const reduceMotion = useReducedMotion();
  const frameRef = useRef<number | null>(null);

  const measure = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      setRect(null);
      return;
    }

    const box = container.getBoundingClientRect();
    const active = container.querySelector<HTMLElement>(ACTIVE_SELECTOR);
    if (!active || box.width === 0 || box.height === 0) {
      setRect(null);
      return;
    }

    const tab = active.getBoundingClientRect();
    if (tab.width === 0 || tab.height === 0) {
      setRect(null);
      return;
    }

    setRect({
      x: tab.left - box.left + insetX,
      y: tab.top - box.top + insetY,
      width: Math.max(0, tab.width - insetX * 2),
      height: Math.max(0, tab.height - insetY * 2),
    });
  }, [containerRef, insetX, insetY]);

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      measure();
    });
  }, [measure]);

  useLayoutEffect(() => {
    scheduleMeasure();

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);
    container.querySelectorAll<HTMLElement>("a, button").forEach((item) => {
      observer.observe(item);
    });

    window.addEventListener("resize", scheduleMeasure);
    document.fonts?.ready.then(scheduleMeasure).catch(() => {});

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [containerRef, activeKey, scheduleMeasure]);

  if (!rect) return null;

  return (
    <motion.span
      aria-hidden
      data-liquid-glass=""
      className={`liquid-glass-tab pointer-events-none absolute left-0 top-0 z-0 ${
        variant === "sport"
          ? "liquid-glass-tab-sport"
          : variant === "page"
            ? "liquid-glass-tab-page"
            : "liquid-glass-tab-brand"
      } ${className}`}
      initial={false}
      animate={{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }}
      transition={
        reduceMotion
          ? { duration: 0 }
          : {
              x: { type: "spring", bounce: 0.12, duration: 0.5 },
              y: { type: "spring", bounce: 0.12, duration: 0.5 },
              width: { type: "spring", bounce: 0.2, duration: 0.55 },
              height: { type: "spring", bounce: 0.2, duration: 0.55 },
            }
      }
    />
  );
}

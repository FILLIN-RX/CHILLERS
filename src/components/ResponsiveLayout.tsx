"use client";

import { useHydrated } from "@/hooks/useHydrated";
import React from "react";

interface ResponsiveLayoutProps {
  mobile: React.ReactNode;
  desktop: React.ReactNode;
}

/**
 * Renders different content for mobile vs desktop WITHOUT causing hydration mismatches.
 * 
 * Returns nothing during SSR and initial hydration, then renders the correct layout
 * after hydration based on window.innerWidth.
 */
export default function ResponsiveLayout({ mobile, desktop }: ResponsiveLayoutProps) {
  const hydrated = useHydrated();
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Don't render anything until fully hydrated to avoid mismatch
  if (!hydrated) {
    return null;
  }

  return isMobile ? mobile : desktop;
}

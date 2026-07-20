"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import SearchOverlay from "@/components/SearchOverlay";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

interface AppShellProps {
  children: React.ReactNode;
  // P2-#26: callers can opt out (e.g. fullscreen player routes). When unset,
  // we auto-hide the BottomNav on /watch/* so the player owns the viewport.
  showBottomNav?: boolean;
}

export default function AppShell({ children, showBottomNav }: AppShellProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const pathname = usePathname();

  // P2-#26: the watch page renders its own fullscreen video overlay; the
  // global mobile bottom nav would compete for the viewport. Treat any route
  // starting with /watch/ as "no bottom nav" unless the caller passes an
  // explicit `showBottomNav` value.
  const shouldShowBottomNav =
    typeof showBottomNav === "boolean"
      ? showBottomNav
      : !pathname?.startsWith("/watch/");

  useEffect(() => {
    // External hook: any descendant (or future footer / fullscreen-player-exit
    // button) can request to open the search by dispatching:
    //   window.dispatchEvent(new Event("open-search"))
    // The header's own search button uses the `onSearchClick` prop directly, so
    // this listener is the escape hatch for callers that don't have a direct
    // reference to AppShell's state.
    const handler = () => setIsSearchOpen(true);
    window.addEventListener("open-search", handler);
    return () => window.removeEventListener("open-search", handler);
  }, []);

  return (
    <>
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onOpenDetails={() => setIsSearchOpen(false)}
      />
      <Header onSearchClick={() => setIsSearchOpen(true)} />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
      {/* BottomNav: opt-out via `showBottomNav={false}` (P2-#26). The watch */}
      {/* page hides it so the player can take over the full viewport. */}
      {shouldShowBottomNav && <BottomNav onSearchClick={() => setIsSearchOpen(true)} />}
    </>
  );
}

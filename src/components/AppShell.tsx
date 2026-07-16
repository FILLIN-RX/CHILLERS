"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import SearchOverlay from "@/components/SearchOverlay";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
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
      {/* Global mobile bottom nav. Auto-hides when the user enters */}
      {/* native fullscreen (e.g. on the watch page), so the player */}
      {/* can take over the whole screen. */}
      <BottomNav onSearchClick={() => setIsSearchOpen(true)} />
    </>
  );
}

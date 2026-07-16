"use client";

import React, { useState, useEffect } from "react";
import Header from "@/components/Header";
import SearchOverlay from "@/components/SearchOverlay";
import Footer from "@/components/Footer";

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
    </>
  );
}

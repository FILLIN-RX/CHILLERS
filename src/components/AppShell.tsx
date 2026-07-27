"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { MantineProvider, createTheme } from "@mantine/core";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";

const theme = createTheme({
  primaryColor: "pink",
  colors: {
    pink: [
      "#f0bdd0", "#e88fb3", "#df6196", "#d73379", "#d70466",
      "#b5034f", "#90023c", "#6b0129", "#47011b", "#23000d",
    ],
  },
  fontFamily: "var(--font-geist-sans), Arial, sans-serif",
  defaultRadius: "md",
  components: {
    Autocomplete: {
      defaultProps: {
        size: "lg",
      },
    },
  },
});

const SearchOverlay = dynamic(() => import("@/components/SearchOverlay"), {
  ssr: false,
});

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
    <MantineProvider theme={theme} forceColorScheme="dark">
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onOpenDetails={() => setIsSearchOpen(false)}
      />
      <Header onSearchClick={() => setIsSearchOpen(true)} />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
      {shouldShowBottomNav && <BottomNav onSearchClick={() => setIsSearchOpen(true)} />}
    </MantineProvider>
  );
}

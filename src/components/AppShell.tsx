"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { MantineProvider, createTheme } from "@mantine/core";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BottomNav from "@/components/BottomNav";
import NetworkStatusBanner from "@/components/NetworkStatusBanner";

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

const DonationModal = dynamic(() => import("@/components/DonationModal"), {
  ssr: false,
});

interface AppShellProps {
  children: React.ReactNode;
  showBottomNav?: boolean;
}

export default function AppShell({ children, showBottomNav }: AppShellProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isDonationOpen, setIsDonationOpen] = useState(false);
  const pathname = usePathname();

  const shouldShowBottomNav =
    typeof showBottomNav === "boolean"
      ? showBottomNav
      : !pathname?.startsWith("/watch/");

  useEffect(() => {
    const handleSearch = () => setIsSearchOpen(true);
    const handleDonation = () => setIsDonationOpen(true);

    window.addEventListener("open-search", handleSearch);
    window.addEventListener("open-donation", handleDonation);

    return () => {
      window.removeEventListener("open-search", handleSearch);
      window.removeEventListener("open-donation", handleDonation);
    };
  }, []);

  return (
    <MantineProvider theme={theme} forceColorScheme="dark">
      <SearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onOpenDetails={() => setIsSearchOpen(false)}
      />
      <DonationModal
        isOpen={isDonationOpen}
        onClose={() => setIsDonationOpen(false)}
      />
      <Header onSearchClick={() => setIsSearchOpen(true)} />
      <main className="flex-1 flex flex-col">{children}</main>
      <Footer />
      <NetworkStatusBanner />
      {shouldShowBottomNav && <BottomNav onSearchClick={() => setIsSearchOpen(true)} />}
    </MantineProvider>
  );
}

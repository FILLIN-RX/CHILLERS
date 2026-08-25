"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { IconSearch, IconHome, IconMovie, IconDeviceTv, IconSparkles, IconTower } from '@tabler/icons-react';
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getActiveNavTab } from "@/lib/navActive";

interface HeaderProps {
  onSearchClick: () => void;
}

export default function Header({ onSearchClick }: HeaderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { translate: _ } = useLanguage();

  const tabs = [
    { id: "home", label: _("nav.home"), href: "/", icon: IconHome },
    { id: "movies", label: _("nav.movies"), href: "/media/movies", icon: IconMovie },
    { id: "series", label: _("nav.series"), href: "/media/series", icon: IconDeviceTv },
    { id: "anime", label: _("nav.anime"), href: "/media/anime", icon: IconSparkles },
    { id: "live", label: _("nav.live"), href: "/live", icon: IconTower },
  ];

  // Single source of truth shared with <BottomNav> so the two indicators
  // never disagree (see src/lib/navActive.ts).
  const activeTab = getActiveNavTab(pathname, searchParams?.get("type"));

  const isDetailPage = /^\/media\/(?!movies$|series$|anime$)(.+)$/.test(pathname) || pathname.startsWith("/tv/") || pathname.startsWith("/watch/");
  const isListingPage = pathname.startsWith("/media/movies") || pathname.startsWith("/media/series") || pathname.startsWith("/media/anime");

  const [isScrolled, setIsScrolled] = useState(false);
  const [hideMobile, setHideMobile] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 20;
      setIsScrolled(scrolled);
      if (isListingPage) {
        setHideMobile(scrolled);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isListingPage]);

  return (
    <header className={`fixed top-0 left-0 w-full z-40 transition-all duration-500 ${
      isDetailPage ? "max-sm:hidden" : ""
    } ${
      hideMobile ? "-translate-y-full sm:translate-y-0" : ""
    } ${
      isScrolled
        ? "bg-zinc-900 shadow-lg border-b border-white/10"
        : "bg-gradient-to-b from-black/90 via-black/50 to-transparent"
    }`}>
      <div className="flex items-center justify-between px-4 sm:px-8 md:px-12 lg:px-[4%] py-3 sm:py-4">

        <div className="flex items-center gap-6 sm:gap-8">
          <Link href="/" className="group flex items-center focus:outline-none shrink-0">
            <Image
              src="/android-chrome-512x512.png"
              alt="Chillers Logo"
              width={40}
              height={40}
              className="h-7 sm:h-9 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              priority
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`relative px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none rounded ${
                  activeTab === tab.id
                    ? "text-white font-bold"
                    : "text-zinc-300 hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            ))}
            <Link
              href="/categories"
              className={`relative px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none rounded ${
                activeTab === "categories"
                  ? "text-white font-bold"
                  : "text-zinc-300 hover:text-white"
              }`}
            >
              {_("nav.categories")}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => window.dispatchEvent(new Event("open-donation"))}
            aria-label="Faire un don"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-red-600/90 to-orange-500/90 hover:from-red-600 hover:to-orange-500 text-white text-xs font-bold shadow-md shadow-red-500/20 hover:scale-105 active:scale-95 transition-all"
          >
            <span>💖</span>
            <span className="hidden sm:inline">Faire un don</span>
          </button>

          <button
            onClick={onSearchClick}
            aria-label={_("nav.search")}
            className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full hover:bg-zinc-800 hover:text-white transition-colors focus:outline-none text-zinc-300"
          >
            <IconSearch className="h-5 w-5" />
          </button>

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

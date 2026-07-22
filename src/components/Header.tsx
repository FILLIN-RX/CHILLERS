"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MagnifyingGlassIcon,
  HomeIcon,
  FilmIcon,
  TvIcon,
  SparklesIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { getActiveNavTab } from "@/lib/navActive";

interface HeaderProps {
  onSearchClick: () => void;
}

export default function Header({ onSearchClick }: HeaderProps) {
  const pathname = usePathname();
  const { translate: _ } = useLanguage();

  const tabs = [
    { id: "home", label: _("nav.home"), href: "/", icon: HomeIcon },
    { id: "movies", label: _("nav.movies"), href: "/media/movies", icon: FilmIcon },
    { id: "series", label: _("nav.series"), href: "/media/series", icon: TvIcon },
    { id: "anime", label: _("nav.anime"), href: "/media/anime", icon: SparklesIcon },
  ];

  // Single source of truth shared with <BottomNav> so the two indicators
  // never disagree (see src/lib/navActive.ts).
  const activeTab = getActiveNavTab(pathname);

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
        ? "bg-zinc-900/95 shadow-lg border-b border-white/10"
        : "bg-gradient-to-b from-black/90 via-black/40 to-transparent"
    }`}>
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-3 sm:px-8 md:px-12 lg:px-[4%] py-3 sm:py-4">

        <div className="flex items-center gap-6 sm:gap-8">
          <Link href="/" className="group flex items-center focus:outline-none">
            <Image
              src="/android-chrome-512x512.png"
              alt="Chillers Logo"
              width={40}
              height={40}
              className="h-8 sm:h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              priority
            />
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.id}
                  href={tab.href}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  className={`relative flex items-center gap-1.5 py-1 text-sm font-medium transition-colors focus:outline-none ${
                    activeTab === tab.id
                      ? "text-white"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" focusable="false" />
                  {tab.label}
                  {activeTab === tab.id && (
                    <span className="absolute bottom-0 left-0 h-[2px] w-full bg-brand-primary rounded-full" />
                  )}
                </Link>
              );
            })}
            <Link
              href="/categories"
              className={`relative flex items-center gap-1.5 py-1 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary rounded ${
                activeTab === "categories"
                  ? "text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              <Squares2X2Icon className="h-4 w-4" aria-hidden="true" focusable="false" />
              {_("nav.categories")}
              {activeTab === "categories" && (
                <span className="absolute bottom-0 left-0 h-[2px] w-full bg-brand-primary rounded-full" />
              )}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4 text-zinc-400 bg-black/60 sm:bg-transparent rounded-full px-3 py-1.5 sm:px-0 sm:py-0">
          <button
            onClick={onSearchClick}
            aria-label={_("nav.search")}
            className="p-2 rounded-full hover:bg-zinc-800 hover:text-white transition-colors focus:outline-none"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

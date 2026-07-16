"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface HeaderProps {
  onSearchClick: () => void;
}

export default function Header({ onSearchClick }: HeaderProps) {
  const pathname = usePathname();
  const { translate: _ } = useLanguage();

  const tabs = [
    { id: "home", label: _("nav.home"), href: "/" },
    { id: "movies", label: _("nav.movies"), href: "/media/movies" },
    { id: "series", label: _("nav.series"), href: "/media/series" },
    { id: "anime", label: "Anime", href: "/media/anime" },
  ];

  const activeTab = (() => {
    if (pathname === "/" || pathname.startsWith("/?")) return "home";
    if (pathname.startsWith("/media/movies")) return "movies";
    if (pathname.startsWith("/media/series")) return "series";
    if (pathname.startsWith("/media/anime")) return "anime";
    if (pathname.startsWith("/categories")) return "categories";
    if (pathname.startsWith("/tv")) return "series";
    if (pathname.startsWith("/watch")) return "home";
    return "home";
  })();

  const isDetailPage = /^\/media\/(?!movies$|series$|anime$)/.test(pathname) || pathname.startsWith("/tv/") || pathname.startsWith("/watch/");

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 w-full z-45 transition-all duration-500 ${
      isDetailPage ? "hidden sm:block" : ""
    } ${
      isScrolled 
        ? "glass-nav shadow-lg" 
        : "bg-gradient-to-b from-black/90 via-black/40 to-transparent border-transparent"
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
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                className={`relative py-1 text-sm font-medium transition-colors focus:outline-none ${
                  activeTab === tab.id 
                    ? "text-white" 
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 h-[2px] w-full bg-brand-primary rounded-full" />
                )}
              </Link>
            ))}
            <Link
              href="/categories"
              className={`relative py-1 text-sm font-medium transition-colors focus:outline-none ${
                activeTab === "categories" 
                  ? "text-white" 
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {_("nav.categories")}
              {activeTab === "categories" && (
                <span className="absolute bottom-0 left-0 h-[2px] w-full bg-brand-primary rounded-full" />
              )}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4 text-zinc-400">
          <button
            onClick={onSearchClick}
            aria-label={_("nav.search")}
            className="p-2 rounded-full hover:bg-zinc-900 hover:border-zinc-800 hover:text-white transition-colors focus:outline-none border border-transparent"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>

          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}

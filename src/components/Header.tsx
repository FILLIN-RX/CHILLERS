"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MagnifyingGlassIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

interface HeaderProps {
  onSearchClick: () => void;
}

export default function Header({ onSearchClick }: HeaderProps) {
  const pathname = usePathname();

  const tabs = [
    { id: "home", label: "Home", href: "/" },
    { id: "movies", label: "Movies", href: "/media/movies" },
    { id: "series", label: "Series", href: "/media/series" },
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
      isScrolled 
        ? "glass-nav shadow-lg" 
        : "bg-gradient-to-b from-black/90 via-black/40 to-transparent border-transparent"
    }`}>
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-3 sm:px-8 md:px-12 lg:px-[4%] py-3 sm:py-4">
        
        <div className="flex items-center gap-6 sm:gap-8">
          <Link href="/" className="group flex items-center focus:outline-none">
            <img 
              src="/android-chrome-512x512.png" 
              alt="Chillers Logo" 
              className="h-8 sm:h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
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
              Categories
              {activeTab === "categories" && (
                <span className="absolute bottom-0 left-0 h-[2px] w-full bg-brand-primary rounded-full" />
              )}
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4 text-zinc-400">
          <button
            onClick={onSearchClick}
            className="p-2 rounded-full hover:bg-zinc-900 hover:border-zinc-800 hover:text-white transition-colors focus:outline-none border border-transparent"
            title="Search"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>

          <div className="relative group hidden sm:block">
            <button className="flex items-center gap-1.5 p-2 rounded-full transition-colors focus:outline-none border border-transparent hover:bg-zinc-900 hover:border-zinc-800 hover:text-white">
              <GlobeAltIcon className="h-5 w-5" />
              <span className="text-xs font-semibold">EN</span>
            </button>
            <div className="absolute right-0 top-full mt-2 w-32 origin-top-right rounded-xl p-1 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-200 shadow-2xl z-50 border bg-zinc-950 border-zinc-800">
              <button className="w-full text-left px-3 py-1.5 text-xs rounded-lg font-medium hover:bg-zinc-900 text-white">English</button>
              <button className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-zinc-900 text-zinc-400">Français</button>
              <button className="w-full text-left px-3 py-1.5 text-xs rounded-lg hover:bg-zinc-900 text-zinc-400">Español</button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

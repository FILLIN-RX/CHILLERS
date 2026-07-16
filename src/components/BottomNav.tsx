"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  FilmIcon,
  TvIcon,
  MagnifyingGlassIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  FilmIcon as FilmIconSolid,
  TvIcon as TvIconSolid,
  Squares2X2Icon as Squares2X2IconSolid,
} from "@heroicons/react/24/solid";
import { useLanguage } from "@/i18n/LanguageContext";

interface BottomNavProps {
  onSearchClick: () => void;
}

export default function BottomNav({ onSearchClick }: BottomNavProps) {
  const pathname = usePathname();
  const { translate: _ } = useLanguage();
  const [isFullscreen, setIsFullscreen] = useState(false);

  const items = [
    { id: "home", label: _("bottomNav.home"), icon: HomeIcon, activeIcon: HomeIconSolid, href: "/" },
    { id: "movies", label: _("bottomNav.movies"), icon: FilmIcon, activeIcon: FilmIconSolid, href: "/media/movies" },
    { id: "series", label: _("bottomNav.series"), icon: TvIcon, activeIcon: TvIconSolid, href: "/media/series" },
    { id: "categories", label: _("bottomNav.categories"), icon: Squares2X2Icon, activeIcon: Squares2X2IconSolid, href: "/categories" },
    { id: "search", label: _("bottomNav.search"), icon: MagnifyingGlassIcon, activeIcon: MagnifyingGlassIcon },
  ] as const;

  useEffect(() => {
    const update = () => setIsFullscreen(!!document.fullscreenElement);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  const activeTab: string = (() => {
    if (pathname === "/") return "home";
    if (pathname.startsWith("/media/movies")) return "movies";
    if (pathname.startsWith("/media/series") || pathname.startsWith("/media/anime") || pathname.startsWith("/tv")) return "series";
    if (pathname.startsWith("/categories")) return "categories";
    if (pathname.startsWith("/watch") || pathname.startsWith("/media/")) return "home";
    return "home";
  })();

  if (isFullscreen) return null;

  return (
    <nav
      className="fixed bottom-0 left-0 w-full z-50 md:hidden border-t border-zinc-800/60"
      style={{ background: "var(--glass-nav-bg)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }}
    >
      <div className="flex items-center justify-around py-2 px-1 pb-[max(8px,env(safe-area-inset-bottom))]">
        {items.map((item) => {
          const Icon = activeTab === item.id ? item.activeIcon : item.icon;
          const isActive = activeTab === item.id;

          if (item.id === "search") {
            return (
              <button
                key={item.id}
                onClick={onSearchClick}
                aria-label={_("bottomNav.search")}
                className={`relative flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[52px] rounded-xl transition-all duration-200 focus:outline-none active:scale-90 ${
                  isActive ? "text-brand-primary" : "text-zinc-500"
                }`}
              >
                {isActive && (
                  <span className="absolute top-0.5 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-brand-primary/60" />
                )}
                <Icon className="h-6 w-6" />
                <span className={`text-[10px] font-semibold leading-none ${isActive ? "text-brand-primary" : "text-zinc-500"}`}>
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href!}
              aria-label={item.label}
              className={`relative flex flex-col items-center gap-0.5 py-1.5 px-2 min-w-[52px] rounded-xl transition-all duration-200 focus:outline-none active:scale-90 ${
                isActive ? "text-brand-primary" : "text-zinc-500"
              }`}
            >
              {isActive && (
                <span className="absolute top-0.5 left-1/2 -translate-x-1/2 h-1 w-5 rounded-full bg-brand-primary/60" />
              )}
              <Icon className="h-6 w-6" />
              <span className={`text-[10px] font-semibold leading-none ${isActive ? "text-brand-primary" : "text-zinc-500"}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

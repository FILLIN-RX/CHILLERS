"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  HomeIcon,
  FilmIcon,
  TvIcon,
  MagnifyingGlassIcon,
  HeartIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import {
  HomeIcon as HomeIconSolid,
  FilmIcon as FilmIconSolid,
  TvIcon as TvIconSolid,
  HeartIcon as HeartIconSolid,
  Squares2X2Icon as Squares2X2IconSolid,
} from "@heroicons/react/24/solid";

interface BottomNavProps {
  onSearchClick: () => void;
}

const items = [
  { id: "home", label: "Home", icon: HomeIcon, activeIcon: HomeIconSolid, href: "/" },
  { id: "movies", label: "Movies", icon: FilmIcon, activeIcon: FilmIconSolid, href: "/media/movies" },
  { id: "series", label: "Series", icon: TvIcon, activeIcon: TvIconSolid, href: "/media/series" },
  { id: "categories", label: "Categories", icon: Squares2X2Icon, activeIcon: Squares2X2IconSolid, href: "/categories" },
  { id: "search", label: "Search", icon: MagnifyingGlassIcon, activeIcon: MagnifyingGlassIcon },
  { id: "favorites", label: "Favorites", icon: HeartIcon, activeIcon: HeartIconSolid },
] as const;

export default function BottomNav({ onSearchClick }: BottomNavProps) {
  const pathname = usePathname();
  // Hide the nav while the user is in native fullscreen (any element).
  // This keeps the player fully immersive on /watch, /media, /tv, etc.
  // without disabling navigation on the rest of the app.
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const update = () => setIsFullscreen(!!document.fullscreenElement);
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, []);

  // Active tab derived from the route — works on every page, not just home.
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
                aria-label="Ouvrir la recherche"
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

          if (item.id === "favorites") {
            // Favorites has no dedicated route yet — keep the button as a
            // placeholder so the layout is consistent. Once /favorites
            // exists, swap this for a Link.
            return (
              <button
                key={item.id}
                onClick={() => {
                  // Trigger the same search overlay as a soft fallback
                  onSearchClick();
                }}
                aria-label="Favoris"
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

"use client";

import React from "react";
import { HomeIcon, FilmIcon, TvIcon, MagnifyingGlassIcon, HeartIcon } from "@heroicons/react/24/outline";
import { HomeIcon as HomeIconSolid, FilmIcon as FilmIconSolid, TvIcon as TvIconSolid, HeartIcon as HeartIconSolid } from "@heroicons/react/24/solid";

interface BottomNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSearchClick: () => void;
}

export default function BottomNav({ activeTab, setActiveTab, onSearchClick }: BottomNavProps) {
  const items = [
    { id: "home", label: "Home", icon: HomeIcon, activeIcon: HomeIconSolid },
    { id: "movies", label: "Movies", icon: FilmIcon, activeIcon: FilmIconSolid },
    { id: "series", label: "Series", icon: TvIcon, activeIcon: TvIconSolid },
    { id: "search", label: "Search", icon: MagnifyingGlassIcon, activeIcon: MagnifyingGlassIcon },
    { id: "favorites", label: "Favorites", icon: HeartIcon, activeIcon: HeartIconSolid },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 md:hidden glass-nav border-t border-brand-border">
      <div className="flex items-center justify-around py-2 px-2">
        {items.map((item) => {
          const Icon = activeTab === item.id ? item.activeIcon : item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "search") {
                  onSearchClick();
                } else {
                  setActiveTab(item.id);
                }
              }}
              className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-colors ${
                isActive ? "text-brand-primary" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

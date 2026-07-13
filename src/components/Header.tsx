"use client";

import React, { useState, useEffect } from "react";
import { MagnifyingGlassIcon, GlobeAltIcon } from "@heroicons/react/24/outline";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSearchClick: () => void;
}

export default function Header({
  activeTab,
  setActiveTab,
  onSearchClick,
}: HeaderProps) {
  const tabs = [
    { id: "home", label: "Home" },
    { id: "movies", label: "Movies" },
    { id: "series", label: "Series" },
    { id: "anime", label: "Anime" },
    { id: "trending", label: "Trending" },
    { id: "categories", label: "Categories" }
  ];

  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    handleScroll(); // run once on mount
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 w-full z-45 transition-all duration-500 ${
      isScrolled 
        ? "glass-nav shadow-lg" 
        : "bg-gradient-to-b from-black/90 via-black/40 to-transparent border-transparent"
    }`}>
      <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 sm:px-8 md:px-12 lg:px-[4%] py-4">
        
        {/* Left Side: Brand Logo */}
        <div className="flex items-center gap-8">
          <button 
            onClick={() => setActiveTab("home")}
            className="group flex items-center focus:outline-none"
          >
            <img 
              src="/android-chrome-512x512.png" 
              alt="Chillers Logo" 
              className="h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
            />
          </button>
          
          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
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
              </button>
            ))}
          </nav>
        </div>

        {/* Right Side: Options Icons */}
        <div className="flex items-center gap-4 text-zinc-400">
          {/* Search Trigger Icon */}
          <button
            onClick={onSearchClick}
            className="p-2 rounded-full hover:bg-zinc-900 hover:border-zinc-800 hover:text-white transition-colors focus:outline-none border border-transparent"
            title="Search"
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>

          {/* Language Selector */}
          <div className="relative group hidden sm:block">
            <button className="flex items-center gap-1.5 p-2 rounded-full transition-colors focus:outline-none border border-transparent hover:bg-zinc-900 hover:border-zinc-800 hover:text-white">
              <GlobeAltIcon className="h-5 w-5" />
              <span className="text-xs font-semibold">EN</span>
            </button>
            {/* Language dropdown */}
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

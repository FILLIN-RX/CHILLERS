"use client";

import { useLanguage } from "@/i18n/LanguageContext";
import { languages, type Language } from "@/i18n";
import { GlobeHemisphereWest } from "@phosphor-icons/react";
import { useState, useRef, useEffect } from "react";
import LiquidGlassIndicator from "@/components/ui/LiquidGlassIndicator";

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  function handleSelect(code: Language) {
    setLang(code);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative hidden lg:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Changer de langue"
        aria-haspopup="listbox"
        aria-expanded={open}
        className="liquid-glass-surface flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90 transition-transform duration-150 hover:brightness-110 active:scale-95"
      >
        <GlobeHemisphereWest className="h-4 w-4" />
        <span>{lang}</span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[160px]">
          <div className="liquid-glass-surface liquid-glass-surface-panel rounded-2xl p-1.5">
            <div ref={listRef} role="listbox" aria-label="Langue" className="relative">
              <LiquidGlassIndicator
                containerRef={listRef}
                activeKey={lang}
                variant="brand"
                insetX={2}
                insetY={2}
              />
              {languages.map((l) => {
                const active = lang === l.code;
                return (
                  <button
                    key={l.code}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-liquid-active={active}
                    onClick={() => handleSelect(l.code)}
                    className={`relative z-10 flex w-full cursor-pointer items-center justify-between gap-2 rounded-full px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "font-semibold text-white"
                        : "text-zinc-300 hover:text-white"
                    }`}
                  >
                    <span>{l.label}</span>
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest ${
                        active ? "text-brand-primary" : "text-transparent"
                      }`}
                    >
                      {l.code}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

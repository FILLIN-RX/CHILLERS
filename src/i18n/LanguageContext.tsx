"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { type Language, defaultLanguage, t, translations } from "./index";
import { clearTmdbCache } from "@/app/api";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  translate: (path: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

function getBrowserLanguage(): Language {
  if (typeof window === "undefined") return defaultLanguage;
  const stored = localStorage.getItem("chillers-lang") as Language | null;
  if (stored && (stored === "fr" || stored === "en")) return stored;
  const browser = navigator.language?.slice(0, 2);
  if (browser === "en") return "en";
  return defaultLanguage;
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(defaultLanguage);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setLangState(getBrowserLanguage());
    setMounted(true);
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("chillers-lang", newLang);
    } catch {
      /* noop */
    }
    clearTmdbCache();
  }, []);

  const translate = useCallback(
    (path: string, params?: Record<string, string | number>) =>
      t(lang, path, params),
    [lang],
  );

  if (!mounted) {
    const fallbackT = (path: string, params?: Record<string, string | number>) =>
      t(defaultLanguage, path, params);
    return (
      <LanguageContext.Provider value={{ lang: defaultLanguage, setLang, translate: fallbackT }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, translate }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}

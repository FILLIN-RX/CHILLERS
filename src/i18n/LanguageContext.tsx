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

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return defaultLanguage;
  const stored = localStorage.getItem("chillers-lang") as Language | null;
  if (stored && (stored === "fr" || stored === "en")) return stored;
  const browser = navigator.language?.slice(0, 2);
  if (browser === "en") return "en";
  return defaultLanguage;
}

interface LanguageProviderProps {
  children: ReactNode;
  // P2-#30: server passes the language resolved from the `chillers-lang`
  // cookie. This is the language the layout was rendered with, so the first
  // client paint already matches — no flash on hydration.
  initialLang?: Language;
}

export function LanguageProvider({ children, initialLang }: LanguageProviderProps) {
  // Seed state with whatever the server resolved. If the client also has a
  // localStorage value that's *different*, we still want the server value on
  // first render to avoid a hydration mismatch — then `useEffect` below
  // upgrades to the client value.
  const [lang, setLangState] = useState<Language>(initialLang ?? defaultLanguage);

  useEffect(() => {
    // After hydration, prefer localStorage / navigator.language over whatever
    // the cookie said. This is the "step up" step: it may still cause a
    // one-frame switch, but only for users whose cookie and localStorage
    // disagree (rare; first-visit users see no flash at all).
    const clientLang = readStoredLanguage();
    if (clientLang !== lang) {
      setLangState(clientLang);
    }
    // We only want this to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((newLang: Language) => {
    setLangState(newLang);
    try {
      localStorage.setItem("chillers-lang", newLang);
      // Mirror to cookie so the next request from this browser also renders
      // in the chosen language. We set it via document.cookie (rather than
      // waiting for a full server round-trip) so the switch is immediate.
      const oneYear = 60 * 60 * 24 * 365;
      document.cookie = `chillers-lang=${newLang}; path=/; max-age=${oneYear}; samesite=lax`;
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

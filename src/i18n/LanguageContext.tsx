"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { type Language, defaultLanguage, t } from "./index";
import { clearTmdbCache } from "@/services/media";

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
  // Cookie (miroir écrit par setLang) : couvre les utilisateurs dont le
  // localStorage a été vidé ou qui viennent d'un autre appareil.
  const cookie = document.cookie.match(/(?:^|;\s*)chillers-lang=(fr|en)(?:;|$)/);
  if (cookie?.[1]) return cookie[1] as Language;
  const browser = navigator.language?.slice(0, 2);
  if (browser === "en") return "en";
  return defaultLanguage;
}

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  // Le layout racine est statique (lang="fr" côté serveur). On hydrate avec la
  // même valeur pour éviter tout mismatch, puis on monte vers la langue réelle
  // (localStorage → cookie → navigator.language) juste après l'hydration.
  const [lang, setLangState] = useState<Language>(defaultLanguage);

  useEffect(() => {
    const clientLang = readStoredLanguage();
    if (clientLang !== lang) {
      setLangState(clientLang);
    }
    // We only want this to run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Garde <html lang> en phase avec la langue active (utile pour les lecteurs
  // d'écran et le SEO client-side).
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

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

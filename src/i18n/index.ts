"use client";

import fr from "./translations/fr.json";
import en from "./translations/en.json";

export type Language = "fr" | "en";

export const languages: { code: Language; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
];

export const defaultLanguage: Language = "fr";

export const translations: Record<Language, Record<string, any>> = {
  fr,
  en,
};

export function t(lang: Language, path: string, params?: Record<string, string | number>): string {
  const keys = path.split(".");
  let value: any = translations[lang];

  for (const key of keys) {
    if (value == null) return path;
    value = value[key];
  }

  if (typeof value !== "string") return path;

  if (params) {
    return Object.entries(params).reduce(
      (str, [k, v]) => str.replace(`{${k}}`, String(v)),
      value
    );
  }

  return value;
}

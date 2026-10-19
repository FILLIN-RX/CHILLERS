export type OhaCategory = "general" | "sport" | "cine" | "kids" | "musique";

export interface OhaEpgEntry {
  title: string;
  /** ISO 8601 UTC */
  start: string;
  /** ISO 8601 UTC */
  end: string;
}

export interface OhaChannel {
  /** Identifiant oha.to de la chaîne (utilisable avec /api/live/oha/resolve) */
  id: string;
  /** Autres identifiants (sources alternatives de la même chaîne) : repli si le primary 404/403 */
  altIds?: string[];
  /** Nom d'affichage curaté */
  name: string;
  category: OhaCategory;
  /** Identifiant IPTV-org (servant de clé pour le logo) */
  tvg?: string;
  logo?: string | null;
  /** Programme en cours puis suivant (souvent absent) */
  epgNow?: OhaEpgEntry;
  epgNext?: OhaEpgEntry;
}

export const OHA_CATEGORY_ORDER: readonly OhaCategory[] = [
  "general",
  "sport",
  "cine",
  "kids",
  "musique",
];

export const OHA_CATEGORY_LABELS: Record<OhaCategory, { fr: string; en: string }> = {
  general: { fr: "Généralistes", en: "General" },
  sport: { fr: "Foot & Sport", en: "Sport" },
  cine: { fr: "Cinéma & Séries", en: "Movies & Series" },
  kids: { fr: "Dessins animés", en: "Kids" },
  musique: { fr: "Musique", en: "Music" },
};

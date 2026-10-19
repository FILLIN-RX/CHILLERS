export type LiveChannelType = "hls" | "youtube" | "dailymotion";

/** Programme TV (EPG) : à l'antenne puis suivant. */
export interface LiveEpgEntry {
  title: string;
  /** ISO 8601 UTC */
  start?: string;
  /** ISO 8601 UTC */
  end?: string;
}

export interface LiveChannel {
  _id: string;
  name: string;
  slug: string;
  logo?: string;
  banner?: string;
  categories: string[];
  country?: string;
  language?: string;
  type: LiveChannelType;
  streamUrl?: string;
  ytVideoId?: string;
  referer?: string;
  userAgent?: string;
  enabled: boolean;
  order: number;
  lastChecked?: string;
  isOnline: boolean;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  /** Force le lecteur à passer le flux par /api/live/proxy (CORS/anti-leech). */
  proxy?: boolean;
  /** Programme en cours puis suivant (catalogue oha / EPG). */
  epgNow?: LiveEpgEntry;
  epgNext?: LiveEpgEntry;
}

export interface LiveChannelInput {
  name?: string;
  logo?: string;
  categories?: string[];
  country?: string;
  language?: string;
  type?: LiveChannelType;
  streamUrl?: string;
  ytVideoId?: string;
  referer?: string;
  userAgent?: string;
  enabled?: boolean;
  order?: number;
}

export const LIVE_CATEGORY_LABELS: Record<string, { fr: string; en: string }> = {
  news: { fr: "Info", en: "News" },
  politics: { fr: "Politique", en: "Politics" },
  business: { fr: "Économie", en: "Business" },
  general: { fr: "Généraliste", en: "General" },
  documentary: { fr: "Documentaire", en: "Documentary" },
  sports: { fr: "Sports", en: "Sports" },
  music: { fr: "Musique", en: "Music" },
  kids: { fr: "Jeunesse", en: "Kids" },
  entertainment: { fr: "Divertissement", en: "Entertainment" },
};

export function liveCategoryLabel(category: string, lang: "fr" | "en"): string {
  const entry = LIVE_CATEGORY_LABELS[category];
  if (entry) return entry[lang];
  const pretty = category.charAt(0).toUpperCase() + category.slice(1);
  return pretty;
}

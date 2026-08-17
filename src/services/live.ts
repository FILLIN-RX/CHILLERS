// Public API of the Live TV module. All calls go through services/http.ts with robust fallbacks.
import { httpJson } from "./http";
import type { LiveChannel } from "@/types/live";

interface Envelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// ── Catalogue Curé de Secours (Sports Prioritaires) ──────────────────────────
export const FALLBACK_CHANNELS: LiveChannel[] = [
  // ── SPORT (En tête de liste) ──────────────────────────────────────────────
  {
    _id: "bein-sports-xtra",
    name: "beIN SPORTS XTRA",
    slug: "bein-sports-xtra",
    categories: ["sports"],
    country: "US",
    language: "fra",
    type: "hls",
    streamUrl: "https://bein-xtra-bein.amagi.tv/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/BeIN_Sports_logo.svg/512px-BeIN_Sports_logo.svg.png",
    enabled: true,
    order: 1,
    isOnline: true,
  },
  {
    _id: "bein-sports-xtra-en",
    name: "beIN SPORTS XTRA HD",
    slug: "bein-sports-xtra-hd",
    categories: ["sports"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://bein-xtra-samsungus.amagi.tv/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/BeIN_Sports_logo.svg/512px-BeIN_Sports_logo.svg.png",
    enabled: true,
    order: 2,
    isOnline: true,
  },
  {
    _id: "red-bull-tv",
    name: "Red Bull TV (Sports & Action)",
    slug: "red-bull-tv",
    categories: ["sports"],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Red_Bull_logo.svg/512px-Red_Bull_logo.svg.png",
    enabled: true,
    order: 3,
    isOnline: true,
  },
  {
    _id: "fight-network",
    name: "Fight Sports HD",
    slug: "fight-sports-hd",
    categories: ["sports"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://amg01644-anthem-fntv-samsungus-o2tce.amagi.tv/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Fight_Network_logo.svg/512px-Fight_Network_logo.svg.png",
    enabled: true,
    order: 4,
    isOnline: true,
  },
  {
    _id: "world-poker-tour",
    name: "World Poker Tour",
    slug: "world-poker-tour",
    categories: ["sports", "entertainment"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://amg00778-amg00778c1-wpt-samsungus-1863.playout.now3.amagi.tv/playlist/amg00778-worldpokertour-wpt-samsungus/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/9/91/World_Poker_Tour_logo.svg/512px-World_Poker_Tour_logo.svg.png",
    enabled: true,
    order: 5,
    isOnline: true,
  },
  // ── France & Généraliste ──────────────────────────────────────────────────
  {
    _id: "france-24-francais",
    name: "France 24 Français",
    slug: "france-24-francais",
    categories: ["news"],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "https://static.france24.com/live/F24_FR_LO_HLS/live_web.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/France_24_logo.svg/512px-France_24_logo.svg.png",
    enabled: true,
    order: 6,
    isOnline: true,
  },
  {
    _id: "tv5monde-europe",
    name: "TV5MONDE Europe",
    slug: "tv5monde-europe",
    categories: ["general", "entertainment"],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "https://ott.tv5monde.com/Content/HLS/Live/channel(fbs)/variant.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/TV5MONDE_logo.svg/512px-TV5MONDE_logo.svg.png",
    enabled: true,
    order: 7,
    isOnline: true,
  },
  {
    _id: "euronews-francais",
    name: "Euronews Français",
    slug: "euronews-francais",
    categories: ["news"],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "https://2f6c5bf4.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmxheHhUVi1ldV9FdXJvbmV3c0ZyYW5jYWlzX0hMUw/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Euronews_2016_logo.svg/512px-Euronews_2016_logo.svg.png",
    enabled: true,
    order: 8,
    isOnline: true,
  },
  {
    _id: "lcp-assemblee-nationale",
    name: "LCP Assemblée Nationale",
    slug: "lcp-assemblee-nationale",
    categories: ["politics", "news"],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "https://stream.lcp.fr/lcp-direct/live/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d6/LCP_logo.svg/500px-LCP_logo.svg.png",
    enabled: true,
    order: 9,
    isOnline: true,
  },
  {
    _id: "public-senat",
    name: "Public Sénat",
    slug: "public-senat",
    categories: ["politics", "news"],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "https://fms-publicsenat.yacast.fr/senat-public/live.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/fr/thumb/5/52/Logo_Public_S%C3%A9nat_2019.svg/512px-Logo_Public_S%C3%A9nat_2019.svg.png",
    enabled: true,
    order: 10,
    isOnline: true,
  },
  // ── International ─────────────────────────────────────────────────────────
  {
    _id: "sky-news",
    name: "Sky News HD",
    slug: "sky-news",
    categories: ["news"],
    country: "UK",
    language: "eng",
    type: "hls",
    streamUrl: "https://jmp2.uk/plu-55b285cd2665de274553d66f.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d2/Sky_News_logo_2018.svg/512px-Sky_News_logo_2018.svg.png",
    enabled: true,
    order: 11,
    isOnline: true,
  },
  {
    _id: "bloomberg-originals",
    name: "Bloomberg TV Originals",
    slug: "bloomberg-originals",
    categories: ["business", "news"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://86fdc85a.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/TEctZ2JfQmxvb21iZXJnT3JpZ2luYWxzX0hMUw/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Bloomberg_Television_logo.svg/512px-Bloomberg_Television_logo.svg.png",
    enabled: true,
    order: 12,
    isOnline: true,
  },
  {
    _id: "dw-english",
    name: "DW English HD",
    slug: "dw-english",
    categories: ["news"],
    country: "DE",
    language: "eng",
    type: "hls",
    streamUrl: "https://amg01644-amg01644c1-amgplt0343.playout.now3.amagi.tv/ts-eu-w1-n2/playlist/amg01644-amg01644c1-amgplt0343/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_logo.svg/512px-Deutsche_Welle_logo.svg.png",
    enabled: true,
    order: 13,
    isOnline: true,
  },
  {
    _id: "nhk-world-japan",
    name: "NHK World Japan",
    slug: "nhk-world-japan",
    categories: ["news", "general"],
    country: "JP",
    language: "eng",
    type: "hls",
    streamUrl: "https://masterpl.hls.nhkworld.jp/hls/w/live/smarttv.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cb/NHK_World_Japan_2020.svg/512px-NHK_World_Japan_2020.svg.png",
    enabled: true,
    order: 14,
    isOnline: true,
  },
  {
    _id: "al-jazeera-english",
    name: "Al Jazeera English",
    slug: "al-jazeera-english",
    categories: ["news"],
    country: "QA",
    language: "eng",
    type: "hls",
    streamUrl: "https://live-hls-web-aje.getaj.net/AJE.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/f/f2/Al_Jazeera_English_logo.svg/512px-Al_Jazeera_English_logo.svg.png",
    enabled: true,
    order: 15,
    isOnline: true,
  },
];

export async function getLiveChannels(params?: {
  category?: string;
  country?: string;
}): Promise<LiveChannel[]> {
  try {
    const res = await httpJson<Envelope<LiveChannel[]>>("/live/channels", {
      query: params,
      timeoutMs: 4000,
    });
    if (res?.data && res.data.length > 0) {
      // Trier avec priorité sport
      return sortChannelsWithSportsFirst(res.data, params?.category);
    }
  } catch {
    // Fallback immédiat sans bloquer l'UI
  }

  // Filtrer la liste de secours
  let list = [...FALLBACK_CHANNELS];
  if (params?.category && params.category !== "all") {
    list = list.filter((c) => c.categories.includes(params.category!));
  }
  if (params?.country) {
    list = list.filter((c) => c.country === params.country);
  }
  return sortChannelsWithSportsFirst(list, params?.category);
}

export async function getLiveChannel(slug: string): Promise<LiveChannel | null> {
  try {
    const res = await httpJson<Envelope<LiveChannel>>(`/live/channels/${slug}`, {
      timeoutMs: 4000,
    });
    if (res?.data) return res.data;
  } catch {
    // Fallback
  }
  return FALLBACK_CHANNELS.find((c) => c.slug === slug) ?? null;
}

export async function getLiveCategories(): Promise<string[]> {
  try {
    const res = await httpJson<Envelope<string[]>>("/live/channels/categories", {
      timeoutMs: 3000,
    });
    if (res?.data && res.data.length > 0) {
      // Assurer que 'sports' est au début
      const cats = res.data.filter((c) => c !== "sports");
      return ["sports", ...cats];
    }
  } catch {
    // Fallback
  }
  return ["sports", "news", "general", "politics", "business", "entertainment"];
}

function sortChannelsWithSportsFirst(list: LiveChannel[], selectedCategory?: string): LiveChannel[] {
  if (selectedCategory && selectedCategory !== "all") return list;
  return [...list].sort((a, b) => {
    const aIsSport = a.categories?.includes("sports") ? 0 : 1;
    const bIsSport = b.categories?.includes("sports") ? 0 : 1;
    if (aIsSport !== bIsSport) return aIsSport - bIsSport;
    return (a.order ?? 99) - (b.order ?? 99);
  });
}

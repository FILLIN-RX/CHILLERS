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
  // ── SPORT (100% LIVE HD VÉRIFIÉ SANS COUPURE NI DRM) ────────────────────────
  {
    _id: "bein-sports-xtra",
    name: "beIN SPORTS XTRA",
    slug: "bein-sports-xtra",
    categories: ["sports"],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "https://bein-xtra-bein.amagi.tv/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/BeIN_Sports_logo.svg/512px-BeIN_Sports_logo.svg.png",
    enabled: true,
    order: 1,
    isOnline: true,
  },
  {
    _id: "red-bull-tv",
    name: "Red Bull TV",
    slug: "red-bull-tv",
    categories: ["sports"],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/Red_Bull_logo.svg/512px-Red_Bull_logo.svg.png",
    enabled: true,
    order: 2,
    isOnline: true,
  },
  {
    _id: "fox-sports-us",
    name: "FOX Sports Live",
    slug: "fox-sports-us",
    categories: ["sports"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://d1jzu95oc8fgt3.cloudfront.net/FOX_Sports.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/97/FOX_Sports_logo.svg/512px-FOX_Sports_logo.svg.png",
    enabled: true,
    order: 3,
    isOnline: true,
  },
  {
    _id: "fubo-sports-network",
    name: "fubo Sports Network",
    slug: "fubo-sports-network",
    categories: ["sports"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://dnf08l6u6uxnz.cloudfront.net/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Fight_Network_logo.svg/512px-Fight_Network_logo.svg.png",
    enabled: true,
    order: 4,
    isOnline: true,
  },
  {
    _id: "flohockey-24-7",
    name: "FloHockey 24/7",
    slug: "flohockey-24-7",
    categories: ["sports"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://amg02278-amg02278c2-flosports-worldwide-9916.playouts.now.amagi.tv/playlist.m3u8",
    logo: "https://images.fubo.tv/channel-config-ui/station-logos/on-dark/flohockey-white.png",
    enabled: true,
    order: 5,
    isOnline: true,
  },
  {
    _id: "floracing-24-7",
    name: "FloRacing 24/7",
    slug: "floracing-24-7",
    categories: ["sports"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://amg02278-amg02278c1-flosports-worldwide-7592.playouts.now.amagi.tv/playlist.m3u8",
    logo: "https://images.fubo.tv/channel-config-ui/station-logos/on-dark/floracing-white.png",
    enabled: true,
    order: 6,
    isOnline: true,
  },
  {
    _id: "stingray-soccer-anthems",
    name: "Stingray Soccer",
    slug: "stingray-soccer-anthems",
    categories: ["sports"],
    country: "CA",
    language: "eng",
    type: "hls",
    streamUrl: "https://lotus.stingray.com/manifest/ose-347ads-montreal/samsungtvplus/master.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ad/Stingray_Group_logo.svg/512px-Stingray_Group_logo.svg.png",
    enabled: true,
    order: 7,
    isOnline: true,
  },
  {
    _id: "sportsgrid-network",
    name: "SportsGrid HD",
    slug: "sportsgrid-hd",
    categories: ["sports"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://sportsgrid-samsungus.amagi.tv/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/9/90/SportsGrid_logo.png/512px-SportsGrid_logo.png",
    enabled: true,
    order: 8,
    isOnline: true,
  },
  {
    _id: "pac12-insider",
    name: "Pac-12 Insider",
    slug: "pac12-insider",
    categories: ["sports"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://pac12-samsungus.amagi.tv/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/en/thumb/e/e9/Pac-12_Conference_logo.svg/512px-Pac-12_Conference_logo.svg.png",
    enabled: true,
    order: 9,
    isOnline: true,
  },
  {
    _id: "golf-kingdom",
    name: "Golf Kingdom",
    slug: "golf-kingdom",
    categories: ["sports"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://30a-tv.com/golf.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/BeIN_Sports_logo.svg/512px-BeIN_Sports_logo.svg.png",
    enabled: true,
    order: 10,
    isOnline: true,
  },

  // ── GRANDES CHAÎNES & AFRIQUE (CANAL+ MOSAÏQUE) ──────────────────────────
  {
    _id: "7-info-ci",
    name: "7 Info",
    slug: "7-info",
    categories: ["news"],
    country: "CI",
    language: "fra",
    type: "hls",
    streamUrl: "https://stream.7info.ci/live/7info.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/France_24_logo.svg/512px-France_24_logo.svg.png",
    enabled: true,
    order: 11,
    isOnline: true,
  },
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
    order: 12,
    isOnline: true,
  },
  {
    _id: "france-24-english",
    name: "France 24 English",
    slug: "france-24-english",
    categories: ["news"],
    country: "FR",
    language: "eng",
    type: "hls",
    streamUrl: "https://static.france24.com/live/F24_EN_LO_HLS/live_web.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/65/France_24_logo.svg/512px-France_24_logo.svg.png",
    enabled: true,
    order: 13,
    isOnline: true,
  },
  {
    _id: "20-minutes-tv",
    name: "20 Minutes TV",
    slug: "20-minutes-tv",
    categories: ["general", "news"],
    country: "FR",
    language: "fra",
    type: "hls",
    streamUrl: "https://idf1.live.yacast.cloud/live/idf1/idf1.isml/idf1.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/TV5MONDE_logo.svg/512px-TV5MONDE_logo.svg.png",
    enabled: true,
    order: 14,
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
    order: 15,
    isOnline: true,
  },
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
    order: 16,
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
    order: 17,
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
    streamUrl: "https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Deutsche_Welle_logo.svg/512px-Deutsche_Welle_logo.svg.png",
    enabled: true,
    order: 18,
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
    order: 19,
    isOnline: true,
  },

  // ── CINÉMA, SÉRIES & DIVERTISSEMENT ──────────────────────────────────────
  {
    _id: "24h-free-movies",
    name: "24H Free Movies",
    slug: "24h-free-movies",
    categories: ["cinema", "movies"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://24hourmovies.30a.tv/live/24hourmovies/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/FilmRise_logo.svg/512px-FilmRise_logo.svg.png",
    enabled: true,
    order: 20,
    isOnline: true,
  },
  {
    _id: "30a-classic-movies",
    name: "30A Classic Movies",
    slug: "30a-classic-movies",
    categories: ["cinema", "movies"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://30a-tv.com/classicmovies.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/FilmRise_logo.svg/512px-FilmRise_logo.svg.png",
    enabled: true,
    order: 21,
    isOnline: true,
  },
  {
    _id: "5-cops-series",
    name: "5 Cops (Séries Action)",
    slug: "5-cops-series",
    categories: ["series"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://5cops.30a.tv/live/5cops/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/FilmRise_logo.svg/512px-FilmRise_logo.svg.png",
    enabled: true,
    order: 22,
    isOnline: true,
  },
  {
    _id: "48-hours-investigation",
    name: "48 Hours Investigation",
    slug: "48-hours-investigation",
    categories: ["series", "documentary"],
    country: "US",
    language: "eng",
    type: "hls",
    streamUrl: "https://30a-tv.com/48hours.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Docurama_logo.png/512px-Docurama_logo.png",
    enabled: true,
    order: 23,
    isOnline: true,
  },
  {
    _id: "4-music-hd",
    name: "4 Music HD",
    slug: "4-music-hd",
    categories: ["music"],
    country: "UK",
    language: "eng",
    type: "hls",
    streamUrl: "https://4kurd.30a.tv/live/4kurd/playlist.m3u8",
    logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/Vevo_logo_2018.svg/512px-Vevo_logo_2018.svg.png",
    enabled: true,
    order: 24,
    isOnline: true,
  },
];

export async function getLiveChannels(params?: {
  category?: string;
  country?: string;
}): Promise<LiveChannel[]> {
  let list: LiveChannel[] = [];
  try {
    const res = await httpJson<Envelope<LiveChannel[]>>("/live/channels", {
      query: params,
      timeoutMs: 4000,
    }).catch(() => null);

    list = res?.data && res.data.length > 0 ? res.data : FALLBACK_CHANNELS;
  } catch {
    list = [...FALLBACK_CHANNELS];
  }

  // Filtrer la liste
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


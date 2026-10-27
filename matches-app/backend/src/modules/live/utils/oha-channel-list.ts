export type OhaCategory = "general" | "sport" | "cine" | "kids" | "musique";

/**
 * Sélection curatée des chaînes FR diffusées par oha.to.
 * Une entrée = une chaîne unique ; le moteur côté serveur choisit la
 * meilleure source disponible (FHD/HD, sans BACKUP) dans le catalogue.
 */
export const OHA_ALLOWLIST: ReadonlyArray<{ label: string; category: OhaCategory }> = [
  // ── Généralistes ──────────────────────────────────────────────────────────
  { label: "6TER", category: "general" },
  { label: "ARTE", category: "general" },
  { label: "C STAR", category: "general" },
  { label: "C STAR HIT", category: "general" },
  { label: "C8", category: "general" },
  { label: "FRANCE 2", category: "general" },
  { label: "FRANCE 24", category: "general" },
  { label: "FRANCE 3", category: "general" },
  { label: "FRANCE 3 NOA", category: "general" },
  { label: "FRANCE 4", category: "general" },
  { label: "FRANCE 5", category: "general" },
  { label: "LCP ASSEMBLEE NATIONALE", category: "general" },
  { label: "M6", category: "general" },
  { label: "M6 INTERNATIONAL", category: "general" },
  { label: "M6 MUSIC", category: "general" },
  { label: "PUBLIC SENAT", category: "general" },
  { label: "RMC DECOUVERTE", category: "general" },
  { label: "RMC STORY", category: "general" },
  { label: "TF1", category: "general" },
  { label: "TF1 SERIES & FILM", category: "general" },
  { label: "TFX", category: "general" },
  { label: "TMC", category: "general" },
  { label: "W9", category: "general" },

  // ── Foot & Sport ──────────────────────────────────────────────────────────
  { label: "BEIN SPORTS 1", category: "sport" },
  { label: "BEIN SPORTS 2", category: "sport" },
  { label: "BEIN SPORTS 3", category: "sport" },
  { label: "BEIN SPORTS MAX 4", category: "sport" },
  { label: "BEIN SPORTS MAX 5", category: "sport" },
  { label: "BEIN SPORTS MAX 6", category: "sport" },
  { label: "BEIN SPORTS MAX 7", category: "sport" },
  { label: "BEIN SPORTS MAX 8", category: "sport" },
  { label: "BEIN SPORTS MAX 9", category: "sport" },
  { label: "BEIN SPORTS MAX 10", category: "sport" },
  { label: "CANAL+ SPORT", category: "sport" },
  { label: "CANAL+ SPORT 1", category: "sport" },
  { label: "CANAL+ SPORT 2", category: "sport" },
  { label: "CANAL+ SPORT 3", category: "sport" },
  { label: "CANAL+ SPORT 4", category: "sport" },
  { label: "CANAL+ SPORT 5", category: "sport" },
  { label: "CANAL+ SPORT 360", category: "sport" },
  { label: "CANAL+ FOOT", category: "sport" },
  { label: "DAZN 1", category: "sport" },
  { label: "DAZN 2", category: "sport" },
  { label: "DAZN 2 LEAUGE 1", category: "sport" },
  { label: "DAZN 3 LEAUGE 1", category: "sport" },
  { label: "DAZN EVENT 1", category: "sport" },
  { label: "DAZN EVENT 2", category: "sport" },
  { label: "DAZN EVENT 3", category: "sport" },
  { label: "DAZN EVENT 4", category: "sport" },
  { label: "DAZN EVENT 5", category: "sport" },
  { label: "DAZN EVENT 6", category: "sport" },
  { label: "DAZN EVENT 7", category: "sport" },
  { label: "DAZN EVENT 8", category: "sport" },
  { label: "DAZN EVENT 9", category: "sport" },
  { label: "DAZN EVENT 10", category: "sport" },
  { label: "DAZN EVENT 11", category: "sport" },
  { label: "DAZN EVENT 12", category: "sport" },
  { label: "DAZN EVENT 13", category: "sport" },
  { label: "DAZN EVENT 14", category: "sport" },
  { label: "DAZN EVENT 15", category: "sport" },
  { label: "DAZN EVENT 16", category: "sport" },
  { label: "DAZN EVENT 17", category: "sport" },
  { label: "DAZN EVENT 18", category: "sport" },
  { label: "DAZN EVENT 19", category: "sport" },
  { label: "DAZN EVENT 20", category: "sport" },
  { label: "DAZN LIGUE 1 LIVE 1", category: "sport" },
  { label: "DAZN LIGUE 1 LIVE 2", category: "sport" },
  { label: "DAZN LIGUE 1 LIVE 3", category: "sport" },
  { label: "DAZN LIGUE 1 LIVE 4", category: "sport" },
  { label: "DAZN LIGUE 1 LIVE 5", category: "sport" },
  { label: "DAZN LIGUE 1 LIVE 6", category: "sport" },
  { label: "DAZN LIGUE 1 LIVE 7", category: "sport" },
  { label: "DAZN LIGUE 1 LIVE 8", category: "sport" },
  { label: "DAZN LIGUE 1 LIVE 9", category: "sport" },
  { label: "EUROSPORT 1", category: "sport" },
  { label: "EUROSPORT 2", category: "sport" },
  { label: "L'EQUIPE", category: "sport" },

  // ── Cinéma & Séries ───────────────────────────────────────────────────────
  { label: "ACTION", category: "cine" },
  { label: "CANAL+ ACTION", category: "cine" },
  { label: "CANAL+ CINEMA CENTRE", category: "cine" },
  { label: "CANAL+ CINEMA OUEST", category: "cine" },
  { label: "CANAL+ CINEMAS", category: "cine" },
  { label: "CINE+ OCS", category: "cine" },
  { label: "CINE+ ACTION", category: "cine" },
  { label: "CINE+ CLASSIC", category: "cine" },
  { label: "CINE+ CLUB", category: "cine" },
  { label: "CINE+ EMOTION", category: "cine" },
  { label: "CINE+ FAMIZ", category: "cine" },
  { label: "CINE+ FESTIVAL", category: "cine" },
  { label: "CINE+ FRISSON", category: "cine" },
  { label: "CINE+ PREMIER", category: "cine" },
  { label: "CINE+ STAR", category: "cine" },
  { label: "COMEDY CENTRAL", category: "cine" },
  { label: "DISNEY CINEMA", category: "cine" },
  { label: "OCS CHOC", category: "cine" },
  { label: "OCS CITY", category: "cine" },
  { label: "OCS FRANCEBOX 1", category: "cine" },
  { label: "OCS FRANCEBOX 2", category: "cine" },
  { label: "OCS FRANCEBOX 3", category: "cine" },
  { label: "OCS FRANCEBOX 4", category: "cine" },
  { label: "OCS FRANCEBOX 5", category: "cine" },
  { label: "OCS GEANTS", category: "cine" },
  { label: "OCS MAX", category: "cine" },
  { label: "PARAMOUNT CHANNEL", category: "cine" },
  { label: "PARAMOUNT DECALE", category: "cine" },
  { label: "WARNER", category: "cine" },
  { label: "WARNER TV", category: "cine" },
  { label: "WARNER TV NEXT", category: "cine" },

  // ── Dessins animés / Kids ─────────────────────────────────────────────────
  { label: "BABY TV", category: "kids" },
  { label: "BOING", category: "kids" },
  { label: "BOOMERANG", category: "kids" },
  { label: "CANAL J", category: "kids" },
  { label: "CANAL JUNIOR", category: "kids" },
  { label: "CARTOON NETWORK", category: "kids" },
  { label: "CARTOONITO", category: "kids" },
  { label: "DISNEY CHANNEL", category: "kids" },
  { label: "DISNEY CHANNEL+1", category: "kids" },
  { label: "DISNEY JUNIOR", category: "kids" },
  { label: "GULLI", category: "kids" },
  { label: "NICKELODEON", category: "kids" },
  { label: "NICKELODEON +1", category: "kids" },
  { label: "NICKELODEON 4 TEEN", category: "kids" },
  { label: "NICKELODEON JUNIOR", category: "kids" },
  { label: "NICKELODEON TOONS", category: "kids" },
  { label: "PIWI+", category: "kids" },
  { label: "TIJI", category: "kids" },

  // ── Musique ───────────────────────────────────────────────────────────────
  { label: "MEZZO", category: "musique" },
  { label: "MEZZO LIVE", category: "musique" },
  { label: "MTV FRANCE", category: "musique" },
  { label: "MTV HITS", category: "musique" },
  { label: "NRJ 12", category: "musique" },
  { label: "NRJ HITS", category: "musique" },
  { label: "TRACE AFRICA", category: "musique" },
  { label: "TRACE SPORT STARS", category: "musique" },
  { label: "TRACE URBAN", category: "musique" },
];

/** Tags pays du catalogue oha.to retenus (France métropolitaine + packs sport FR). */
export const OHA_FR_TAGS: ReadonlySet<string> = new Set(["France", "France Sport"]);

/**
 * Normalise un nom de chaîne brut en « base » : retire les suffixes qualité
 * ((1), (7), HD/FHD/4K…), les marqueurs BACKUP / EVENT ONLY et la ponctuation
 * finale, pour regrouper les variantes d'une même chaîne.
 */
export function ohaBaseName(raw: string): string {
  let n = raw;
  n = n.replace(/\s*\((?:\d+|P)\)\s*$/u, "");
  n = n.replace(
    /\s*\[(?:BACKUP|LIVE DURING EVENTS ONLY|EVENT ONLY)\]\s*\(?\d*\)?/giu,
    "",
  );
  n = n.replace(
    /\s*\((?:BACKUP|EVENT ONLY|LIVE DURING EVENTS ONLY)\)\s*$/giu,
    "",
  );
  n = n.replace(
    /\b(?:HD|FHD|UHD|4K|SD|360P|480P|720P|1080P|HEVC|ACCESS)\b/giu,
    " ",
  );
  n = n.replace(/^(?:CA:|BE:|4K TR:)\s*/iu, "");
  n = n.replace(/[\s.]+$/u, "");
  return n.replace(/\s+/gu, " ").trim().toUpperCase();
}

/** Clé de regroupement insensible à la casse et à la ponctuation (PIWI+ ≡ PIWI +). */
export function ohaNormalizeKey(base: string): string {
  return base.replace(/[^A-Z0-9]/gu, "");
}

/** Score d'une source : privilégie les sources principales (1)/(7), FHD/HD, pénalise BACKUP/EVENT ONLY. */
export function ohaSourceScore(name: string): number {
  const u = name.toUpperCase();
  let s = 0;
  if (u.includes("BACKUP")) s -= 10;
  if (u.includes("EVENT ONLY") || u.includes("LIVE DURING EVENTS")) s -= 10;
  if (/\((?:1|7)\)/u.test(u)) s += 2;
  if (u.includes("FHD") || u.includes("4K")) s += 3;
  if (/\bHD\b/u.test(u)) s += 2;
  if (u.includes("SD") || u.includes("360") || u.includes("480")) s -= 1;
  if (!u.includes("BACKUP") && !/\(\d+\)/u.test(u)) s += 1;
  return s;
}

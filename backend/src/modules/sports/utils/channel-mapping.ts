/**
 * channel-mapping.ts
 *
 * Mappe les chaînes de télévision en direct (LiveTV / IPTV de CHILLERS)
 * vers les rencontres de sport.
 *
 * Si un match est diffusé sur une chaîne connue (ex: beIN Sports, Canal+,
 * SSC, Eurosport, Fox Sports, DAZN, TNT Sports, Thmaniya...) ou si l'API
 * indique des diffuseurs officiels (match.broadcasts), ce module retrouve
 * les chaînes TV actives correspondantes et les propose dans la liste des serveurs.
 */
import fs from 'node:fs';
import path from 'path';
import { BACKEND_ROOT } from '../../../config/data-paths';
import type { SportsMatch, SportsServer } from '../sports.types';
import { findLogo } from '../lab/lab-logos';

interface TvCandidate {
  name: string;
  normalizedName: string;
  url: string;
  logo?: string;
  source: 'livetv' | 'iptv-org';
}

let cachedTvChannels: TvCandidate[] | null = null;
let lastCacheTs = 0;
const CACHE_TTL_MS = 5 * 60_000; // 5 min

export function normalizeChannelName(name: string): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/\b(hd|sd|fhd|uhd|4k|hls|direct|miroir|player|serveur)\b/gi, ' ')
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Charge les chaînes sportives disponibles (IPTV snapshot + LiveTV DB si dispo). */
function loadAvailableTvChannels(): TvCandidate[] {
  const now = Date.now();
  if (cachedTvChannels && now - lastCacheTs < CACHE_TTL_MS) {
    return cachedTvChannels;
  }

  const list: TvCandidate[] = [];

  // 1. Chaînes sport issues du snapshot report.json (53 diffuseurs vérifiés)
  try {
    const reportPath = path.resolve(BACKEND_ROOT, '..', 'sports-channels-lab', 'data', 'report.json');
    if (fs.existsSync(reportPath)) {
      const raw = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      for (const tv of raw?.tvChannels ?? []) {
        if (!tv?.url || !tv?.name) continue;
        const norm = normalizeChannelName(tv.name);
        if (!norm) continue;
        list.push({
          name: tv.name,
          normalizedName: norm,
          url: tv.url,
          logo: tv.logo || findLogo(tv.name),
          source: 'iptv-org',
        });
      }
    }
  } catch {}

  cachedTvChannels = list;
  lastCacheTs = now;
  return list;
}

/**
 * Vérifie si deux libellés de chaîne désignent le même diffuseur.
 * Ex: "beIN Sports 1" correspond à "beIN Sports 1 Turk" ou "beIN Sports 1 HD"
 */
function isChannelMatch(queryNorm: string, targetNorm: string): boolean {
  if (!queryNorm || !targetNorm) return false;
  if (queryNorm === targetNorm) return true;

  // L'un commence par l'autre
  if (targetNorm.startsWith(queryNorm) || queryNorm.startsWith(targetNorm)) {
    return true;
  }

  // Mêmes mots clés
  const qWords = queryNorm.split(' ').filter(Boolean);
  const tWords = targetNorm.split(' ').filter(Boolean);
  if (qWords.length >= 2 && qWords.every((w) => tWords.includes(w))) {
    return true;
  }

  return false;
}

/**
 * Enrichit la liste des serveurs d'un match avec les chaînes TV correspondantes.
 *
 * @param match Le match en cours
 * @param existingServers Les serveurs déjà résolus pour ce match
 * @param broadcasts Libellés additionnels de diffuseurs (ex: ESPN broadcasts)
 */
export function mapTvChannelsToMatch(
  match: SportsMatch,
  existingServers: SportsServer[],
  broadcasts?: string[],
): SportsServer[] {
  const tvChannels = loadAvailableTvChannels();
  if (!tvChannels.length) return existingServers;

  // Noms recherchés :
  // 1. Noms des serveurs existants (ex: "beIN Sports 1", "Magenta Sport 3")
  // 2. Diffuseurs passés en argument
  // 3. Noms issus des serveurs bruts
  const candidatesToFind: string[] = [];

  for (const s of existingServers) {
    if (s.name) candidatesToFind.push(s.name);
  }
  if (broadcasts && Array.isArray(broadcasts)) {
    candidatesToFind.push(...broadcasts);
  }

  const addedServers: SportsServer[] = [];
  const existingUrls = new Set(existingServers.map((s) => s.url));

  for (const candidate of candidatesToFind) {
    const norm = normalizeChannelName(candidate);
    if (norm.length < 3) continue;

    for (const tv of tvChannels) {
      if (existingUrls.has(tv.url)) continue;

      if (isChannelMatch(norm, tv.normalizedName)) {
        existingUrls.add(tv.url);
        addedServers.push({
          name: `📺 ${tv.name}`,
          url: tv.url,
          type: 'hls',
        });
      }
    }
  }

  return [...existingServers, ...addedServers];
}

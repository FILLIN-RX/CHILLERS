/**
 * Store du lab « chaînes de match » : lecture du snapshot `report.json`
 * produit par `sports-channels-lab` (scan des 5 providers + iptv-org + probe).
 *
 * Tout est en mémoire avec un TTL court : la page de test veut voir les liens
 * déjà récoltés, pas relancer un scan (62 s) à chaque ouverture.
 */
import fs from 'fs';
import path from 'path';
import { BACKEND_ROOT } from '../../../config/data-paths';
import { findLogo } from './lab-logos';

/** Hors prod : l'ensemble des routes lab répond 404 tant que le flag est absent. */
export const LAB_ENABLED =
  process.env.SPORTS_CHANNELS_LAB === '1' || process.env.SPORTS_CHANNELS_LAB === 'true';

const REPORT_PATH = path.resolve(BACKEND_ROOT, '..', 'sports-channels-lab', 'data', 'report.json');
const CACHE_TTL_MS = 60_000;

const enc = (s: string) => Buffer.from(s, 'utf8').toString('base64url');

export interface LabRawChannel {
  provider: string;
  sourceId: string;
  channelName: string;
  type: 'hls' | 'iframe';
  url: string;
  referer?: string;
  playable: boolean;
  confirmed: boolean;
  httpStatus?: number;
  meta?: { ch?: string; language?: string; category?: string; edge?: number; koraType?: string };
}

interface LabRawFixture {
  home: string;
  away: string;
  startTs?: string;
  status?: string;
  league?: string;
  providers: string[];
  playableCount: number;
  channels: LabRawChannel[];
}

interface LabRawReport {
  generatedAt: string;
  totals: {
    records: number;
    playable: number;
    deepConfirmed: number;
    pageOnly: number;
    dead: number;
    notProbed?: number;
    byProvider?: Record<string, { links: number; playable: number; confirmed: number }>;
  };
  fixtures: LabRawFixture[];
  tvChannels?: Array<{ name: string; provider: string; url: string; logo?: string; playable: boolean; confirmed: boolean }>;
}

export interface LabChannel {
  id: string;
  channelName: string;
  provider: string;
  sourceId: string;
  type: 'hls' | 'iframe';
  url: string;
  /** Relay lecture (HLS uniquement) : playlist + segments passent par le backend. */
  relayUrl?: string;
  referer?: string;
  logo?: string;
  language?: string;
  playable: boolean;
  confirmed: boolean;
  httpStatus?: number;
}

export interface LabFixture {
  id: string;
  home: string;
  away: string;
  startTs?: string;
  status: string;
  league?: string;
  providers: string[];
  playableCount: number;
  channelCount: number;
  confirmedCount: number;
  hlsCount: number;
  names: string[];
}

export interface LabSnapshot {
  generatedAt: string;
  totals: LabRawReport['totals'];
  fixtures: LabFixture[];
  byId: Map<string, LabChannel[]>;
}

/** Identifiant stable d'une rencontre : libellés normalisés + coup d'envoi. */
export function fixtureId(home: string, away: string, startTs?: string): string {
  const n = (s: string) =>
    (s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const ts = startTs ? Date.parse(startTs) || 0 : 0;
  return `${n(home) || 'na'}--${n(away) || 'na'}--${ts}`;
}

function relayUrlFor(type: string, url: string, referer?: string): string | undefined {
  if (type !== 'hls') return undefined;
  const r = referer ? `&r=${enc(referer)}` : '';
  return `/api/sports/lab/play?u=${enc(url)}${r}`;
}

function compareChannels(a: LabChannel, b: LabChannel): number {
  if (a.confirmed !== b.confirmed) return a.confirmed ? -1 : 1;
  if (a.playable !== b.playable) return a.playable ? -1 : 1;
  if (a.type !== b.type) return a.type === 'hls' ? -1 : 1;
  return a.channelName.localeCompare(b.channelName);
}

function buildSnapshot(raw: LabRawReport): LabSnapshot {
  const fixtures: LabFixture[] = [];
  const byId = new Map<string, LabChannel[]>();

  for (const fix of raw.fixtures || []) {
    const id = fixtureId(fix.home, fix.away, fix.startTs);
    const channels: LabChannel[] = (fix.channels || []).map((ch, i) => ({
      id: `${id}#${i}`,
      channelName: ch.channelName || 'Serveur',
      provider: ch.provider,
      sourceId: String(ch.sourceId ?? ''),
      type: ch.type === 'hls' ? 'hls' : 'iframe',
      url: ch.url,
      relayUrl: relayUrlFor(ch.type, ch.url, ch.referer),
      referer: ch.referer,
      logo: findLogo(ch.channelName),
      language: ch.meta?.language,
      playable: Boolean(ch.playable),
      confirmed: Boolean(ch.confirmed),
      httpStatus: ch.httpStatus,
    }));
    channels.sort(compareChannels);

    byId.set(id, channels);
    fixtures.push({
      id,
      home: fix.home,
      away: fix.away,
      startTs: fix.startTs,
      status: fix.status === 'live' ? 'live' : 'upcoming',
      league: fix.league,
      providers: fix.providers || [],
      playableCount: fix.playableCount || channels.filter((c) => c.playable).length,
      channelCount: channels.length,
      confirmedCount: channels.filter((c) => c.confirmed).length,
      hlsCount: channels.filter((c) => c.type === 'hls').length,
      names: Array.from(new Set(channels.map((c) => c.channelName))).slice(0, 8),
    });
  }

  fixtures.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'live' ? -1 : 1;
    const ta = a.startTs ? Date.parse(a.startTs) : 0;
    const tb = b.startTs ? Date.parse(b.startTs) : 0;
    return tb - ta;
  });

  return { generatedAt: raw.generatedAt, totals: raw.totals, fixtures, byId };
}

let cache: { mtimeMs: number; ts: number; data: LabSnapshot } | null = null;

export function loadSnapshot(force = false): LabSnapshot {
  const now = Date.now();
  try {
    const stat = fs.statSync(REPORT_PATH);
    if (!force && cache && cache.mtimeMs === stat.mtimeMs && now - cache.ts < CACHE_TTL_MS) {
      return cache.data;
    }
    const raw = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as LabRawReport;
    const data = buildSnapshot(raw);
    // Un re-scan du lab change le mtime : on recharge sans attendre le TTL.
    cache = { mtimeMs: stat.mtimeMs, ts: now, data };
    return data;
  } catch (err) {
    if (cache) return cache.data;
    throw err;
  }
}

export function listFixtures(): LabFixture[] {
  return loadSnapshot().fixtures;
}

export function findFixture(id: string): LabFixture | null {
  return loadSnapshot().fixtures.find((f) => f.id === id) ?? null;
}

export function listChannels(id: string): LabChannel[] | null {
  const channels = loadSnapshot().byId.get(id);
  return channels ?? null;
}

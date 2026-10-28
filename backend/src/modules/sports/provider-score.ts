/**
 * Score de fiabilité des providers sport.
 *
 * Les candidats d'un match ne se valent pas : liveball et kooorah livrent un
 * HLS direct, kora un player souvent derrière un jeton, streamiz est un repli
 * presque toujours vide. Ce score répond à « quelle probabilité que ce provider
 * donne un flux jouable maintenant ? » à partir des sondes déjà passées.
 *
 *   valeur d'une sonde : HLS = 1, iframe jouable = 0,8, échec = 0
 *   score = moyenne mobile exponentielle (alpha 0,2)
 *
 * L'EWMA s'auto-corrige en une dizaine d'essais : un provider qui revient en
 * forme remonte vite, contrairement à un taux cumulé. Les stats de plus de
 * trois jours sont ignorées (un provider réparé entre-temps repart neutre).
 *
 * Seules les sondes d'un match commencé comptent comme échec : avant le coup
 * d'envoi, « pas encore de flux » est normal. Un succès compte toujours (un
 * flux jouable en avance est un bon signal).
 *
 * Les compteurs vivent en mémoire (TTL 60 s) et sont persistés en Mongo :
 * redémarrer le backend ne remet pas les providers à égalité. On n'y stocke
 * jamais d'URL — seulement des issues de sonde.
 */
import mongoose from 'mongoose';
import SportsProviderStat from '../../models/SportsProviderStat';
import type { SportsProviderOutcome } from '../../models/SportsProviderStat';
import { SPORTS_SOURCES, type SportsSourceId } from './sports.types';

const REFRESH_MS = 60_000;
const EWMA_ALPHA = 0.2;
const SCORE_FLOOR = 0.02;
const SCORE_CEIL = 0.98;
const NEUTRAL_SCORE = 0.5;
/** Au-delà, les compteurs ne décrivent plus le provider d'aujourd'hui. */
const STALE_AFTER_MS = 72 * 3_600_000;

interface ProviderSnapshot {
  ewma: number;
  attempts: number;
  playable: number;
  hlsPlayable: number;
  iframePlayable: number;
  lastOkAt?: number;
  lastKoAt?: number;
  lastOutcome?: SportsProviderOutcome;
}

export interface ProviderScore extends ProviderSnapshot {
  source: SportsSourceId;
  /** Probabilité de flux jouable au prochain essai (0..1). */
  score: number;
}

const stats = new Map<SportsSourceId, ProviderSnapshot>();
let loadedAt = 0;
let loading: Promise<void> | null = null;

function asSource(value: string): SportsSourceId | null {
  return (SPORTS_SOURCES as string[]).includes(value) ? (value as SportsSourceId) : null;
}

function dbReady(): boolean {
  return mongoose.connection.readyState === 1;
}

const clamp = (score: number) => Math.min(SCORE_CEIL, Math.max(SCORE_FLOOR, score));

/** Charge les compteurs depuis Mongo (au plus une fois par minute). */
export async function refreshProviderStats(force = false): Promise<void> {
  if (!force && Date.now() - loadedAt < REFRESH_MS) return;
  if (loading) return loading;
  if (!dbReady()) return;

  loading = (async () => {
    try {
      const rows = await SportsProviderStat.find().lean();
      const now = Date.now();
      for (const row of rows) {
        const source = asSource(String(row.source));
        if (!source) continue;
        const lastAttemptAt = row.lastAttemptAt ? new Date(row.lastAttemptAt).getTime() : 0;
        if (lastAttemptAt && now - lastAttemptAt > STALE_AFTER_MS) {
          stats.delete(source);
          continue;
        }
        stats.set(source, {
          // Ancienne ligne sans EWMA : on repart du taux cumulé lissé.
          ewma: typeof row.ewma === 'number' ? row.ewma : NEUTRAL_SCORE,
          attempts: row.attempts ?? 0,
          playable: row.playable ?? 0,
          hlsPlayable: row.hlsPlayable ?? 0,
          iframePlayable: row.iframePlayable ?? 0,
          lastOutcome: row.lastOutcome,
          lastOkAt: row.lastOkAt ? new Date(row.lastOkAt).getTime() : undefined,
          lastKoAt: row.lastKoAt ? new Date(row.lastKoAt).getTime() : undefined,
        });
      }
      loadedAt = now;
    } catch (error) {
      console.warn('[sports] stats providers indisponibles:', (error as Error)?.message);
    }
  })().finally(() => {
    loading = null;
  });

  return loading;
}

/** Score courant, lecture synchrone (le cache est rechargé en tâche de fond). */
export function getProviderScore(source: SportsSourceId): number {
  void refreshProviderStats();
  const snapshot = stats.get(source);
  return snapshot ? clamp(snapshot.ewma) : NEUTRAL_SCORE;
}

/** Tous les scores, du plus fiable au moins fiable. */
export function listProviderScores(): ProviderScore[] {
  void refreshProviderStats();
  return SPORTS_SOURCES.map((source) => {
    const snapshot = stats.get(source);
    return {
      source,
      score: snapshot ? clamp(snapshot.ewma) : NEUTRAL_SCORE,
      ewma: snapshot?.ewma ?? NEUTRAL_SCORE,
      attempts: snapshot?.attempts ?? 0,
      playable: snapshot?.playable ?? 0,
      hlsPlayable: snapshot?.hlsPlayable ?? 0,
      iframePlayable: snapshot?.iframePlayable ?? 0,
      lastOkAt: snapshot?.lastOkAt,
      lastKoAt: snapshot?.lastKoAt,
      lastOutcome: snapshot?.lastOutcome,
    };
  }).sort((a, b) => b.score - a.score);
}

/**
 * Enregistre l'issue d'une sonde de candidat. Met à jour le cache local tout
 * de suite (le classement suivant en tient compte) et persiste en tâche de
 * fond : une panne Mongo ne doit jamais bloquer la résolution d'un flux.
 */
export function recordProviderOutcome(source: SportsSourceId, outcome: SportsProviderOutcome): void {
  const previous = stats.get(source);
  const now = Date.now();
  const value = outcome === 'hls' ? 1 : outcome === 'iframe' ? 0.8 : 0;
  const ewma = (previous?.ewma ?? NEUTRAL_SCORE) + EWMA_ALPHA * (value - (previous?.ewma ?? NEUTRAL_SCORE));
  const next: ProviderSnapshot = {
    ewma,
    attempts: (previous?.attempts ?? 0) + 1,
    playable: (previous?.playable ?? 0) + (outcome === 'fail' ? 0 : 1),
    hlsPlayable: (previous?.hlsPlayable ?? 0) + (outcome === 'hls' ? 1 : 0),
    iframePlayable: (previous?.iframePlayable ?? 0) + (outcome === 'iframe' ? 1 : 0),
    lastOutcome: outcome,
    lastOkAt: outcome === 'fail' ? previous?.lastOkAt : now,
    lastKoAt: outcome === 'fail' ? now : previous?.lastKoAt,
  };
  stats.set(source, next);

  if (!dbReady()) return;
  SportsProviderStat.updateOne(
    { source },
    {
      $inc: {
        attempts: 1,
        playable: outcome === 'fail' ? 0 : 1,
        hlsPlayable: outcome === 'hls' ? 1 : 0,
        iframePlayable: outcome === 'iframe' ? 1 : 0,
      },
      $set: {
        ewma,
        lastOutcome: outcome,
        lastAttemptAt: new Date(now),
        ...(outcome === 'fail' ? { lastKoAt: new Date(now) } : { lastOkAt: new Date(now) }),
      },
      $setOnInsert: { source },
    },
    { upsert: true },
  ).catch((error) => {
    console.warn(`[sports] stats provider ${source} non persistées:`, (error as Error)?.message);
  });
}

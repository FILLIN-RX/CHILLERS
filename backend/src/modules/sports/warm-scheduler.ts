/**
 * Préchauffage des chaînes des matchs du jour.
 *
 * Objectif : au coup d'envoi, la liste des candidats (et leurs sondes) est
 * déjà en mémoire — pas de « première résolution » de 30 s au moment où le
 * spectateur clique. Toutes les 2 min, on repère les rencontres qui entrent
 * dans la fenêtre T-60 min (ou qui sont en direct depuis moins de 4 h) et on
 * lance leur agrégation complète en tâche de fond.
 *
 * L'agrégation est bornée :
 * - `warmupMatchChannels` déduplique (collecte déjà en vol, registre complet,
 *   répit de 60 s après un échec) : ce module ne peut pas créer d'orage ;
 * - au plus `SPORTS_WARM_MAX` matchs par passage, `SPORTS_WARM_CONCURRENCY`
 *   en parallèle, les coups d'envoi les plus proches d'abord.
 *
 * `SPORTS_WARM=0` désactive l'ordonnanceur (utile en recette locale) ;
 * `SPORTS_WARM_CRON` change la cadence (expression node-cron).
 */
import cron, { type ScheduledTask } from 'node-cron';
import { getSportsMatches, warmupMatchChannels } from './sports.service';
import { getRegisteredChannels } from './match-channels.registry';
import type { SportsMatch } from './sports.types';

const DEFAULT_CRON = '*/2 * * * *';
/** Fenêtre avant le coup d'envoi : au-delà, le registre (2 min de TTL) serait déjà froid. */
const WINDOW_BEFORE_S = 60 * 60;
/** Un match marqué live depuis plus de 4 h est terminé côté providers. */
const WINDOW_AFTER_S = 4 * 3600;
const MAX_PER_RUN = Math.max(1, Number(process.env.SPORTS_WARM_MAX) || 8);
const CONCURRENCY = Math.max(1, Number(process.env.SPORTS_WARM_CONCURRENCY) || 3);

const envOff = (value: string | undefined) => ['0', 'false'].includes((value || '').trim().toLowerCase());
export const WARM_ENABLED = !envOff(process.env.SPORTS_WARM);

function cronExpression(): string {
  const raw = (process.env.SPORTS_WARM_CRON || '').trim();
  if (!raw) return DEFAULT_CRON;
  if (!cron.validate(raw)) {
    console.warn(`[sports] SPORTS_WARM_CRON invalide (${raw}) → ${DEFAULT_CRON}`);
    return DEFAULT_CRON;
  }
  return raw;
}

/** Le match entre-t-il dans la fenêtre de préchauffage ? */
function isDue(match: SportsMatch, nowSec: number): boolean {
  if (match.startTs === undefined) return match.status === 'live';
  const untilKickoff = match.startTs - nowSec;
  if (match.status === 'live') return untilKickoff > -WINDOW_AFTER_S;
  return untilKickoff <= WINDOW_BEFORE_S && untilKickoff > -5 * 60;
}

let running = false;
let task: ScheduledTask | null = null;

/**
 * Repli exponentiel par match : un match dont aucun provider ne diffuse (pas
 * encore de flux au coup d'envoi, chaîne morte) ne doit pas être retenté toutes
 * les 2 min pendant 4 h. 2 min, 4, 8, 10… plafonné à 10 min pour rester réactif
 * à l'approche du coup d'envoi ; réinitialisé dès qu'une collecte rapporte un
 * serveur.
 */
const FAILURE_BASE_MS = 2 * 60_000;
const FAILURE_MAX_MS = 10 * 60_000;
const backoff = new Map<string, { failures: number; until: number }>();

function recordWarmOutcome(match: SportsMatch, started: boolean): void {
  if (!started) return;
  const hasServers = (getRegisteredChannels(match.id)?.servers.length ?? 0) > 0;
  if (hasServers) {
    backoff.delete(match.id);
    return;
  }
  const failures = (backoff.get(match.id)?.failures ?? 0) + 1;
  backoff.set(match.id, {
    failures,
    until: Date.now() + Math.min(FAILURE_MAX_MS, FAILURE_BASE_MS * 2 ** (failures - 1)),
  });
}

/**
 * Un passage : repère les matchs dus et lance leur agrégation. Exporté pour
 * pouvoir le déclencher à la main (diagnostic local, test).
 */
export async function runWarmPass(): Promise<{ due: number; warmed: number }> {
  if (running) return { due: 0, warmed: 0 };
  running = true;
  try {
    const matches = await getSportsMatches();
    const now = Date.now();
    const nowSec = Math.floor(now / 1000);
    const candidates = matches
      .filter((match) => isDue(match, nowSec) && (backoff.get(match.id)?.until ?? 0) <= now)
      .sort((a, b) => (a.startTs ?? nowSec) - (b.startTs ?? nowSec));

    // Les directs passent d'abord, mais sans affamer les coups d'envoi proches :
    // au plus la moitié des créneaux pour les uns, le reste pour les autres.
    const live = candidates.filter((match) => match.status === 'live');
    const upcoming = candidates.filter((match) => match.status !== 'live');
    const liveQuota = Math.ceil(MAX_PER_RUN / 2);
    const due = [
      ...live.slice(0, liveQuota),
      ...upcoming.slice(0, MAX_PER_RUN - Math.min(live.length, liveQuota)),
    ];

    let warmed = 0;
    for (let i = 0; i < due.length; i += CONCURRENCY) {
      const batch = due.slice(i, i + CONCURRENCY).map((match) => ({
        match,
        promise: warmupMatchChannels(match),
      }));
      // On attend la vague : au plus CONCURRENCY chaînes tournent à la fois.
      await Promise.all(batch.map((entry) => entry.promise));
      for (const entry of batch) {
        const started = entry.promise !== null;
        if (started) warmed++;
        recordWarmOutcome(entry.match, started);
      }
    }

    if (due.length > 0) {
      console.log(`[sports] préchauffage : ${warmed}/${due.length} match(s) dans la fenêtre`);
    }
    return { due: due.length, warmed };
  } catch (error) {
    console.warn('[sports] préchauffage échoué:', (error as Error)?.message);
    return { due: 0, warmed: 0 };
  } finally {
    running = false;
  }
}

export function startSportsWarmScheduler(): void {
  if (!WARM_ENABLED || task) return;
  const expression = cronExpression();
  task = cron.schedule(expression, () => {
    void runWarmPass();
  });
  console.log(`[sports] préchauffage des chaînes actif (${expression}, max ${MAX_PER_RUN}/passage)`);
}

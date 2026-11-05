import { fetchMatchSummary } from './api';
import { showMatchNotification } from './notifications.service';
import type { MatchSummary, MatchStatus } from '../types/matches';

const TICK_MS = 5_000;
const MAX_CHECKS_PER_TICK = 4;
const MAX_WATCHED_MATCHES = 50;
const LIVE_POLL_MS = 15_000;
const NEAR_START_POLL_MS = 20_000;
const SCHEDULED_POLL_MS = 60_000;
const FAR_START_POLL_MS = 5 * 60_000;
const FAR_FUTURE_POLL_MS = 30 * 60_000;
const ERROR_POLL_MS = 60_000;
const MAX_FAILURES = 10;

interface WatchState {
  initialized: boolean;
  checking: boolean;
  status?: MatchStatus;
  atHalfTime: boolean;
  goalCount: number;
  knownEventIds: Set<string>;
  corners: Record<string, number>;
  nextPollAt: number;
  failures: number;
}

let timer: ReturnType<typeof setInterval> | null = null;
let getFavoriteIds: (() => string[]) | null = null;
const states = new Map<string, WatchState>();
const done = new Set<string>();

function createState(): WatchState {
  return {
    initialized: false,
    checking: false,
    atHalfTime: false,
    goalCount: 0,
    knownEventIds: new Set(),
    corners: {},
    nextPollAt: 0,
    failures: 0,
  };
}

function isHalfTime(summary: MatchSummary): boolean {
  const text = (summary.statusText || '').trim().toLowerCase();
  const minute = (summary.minute || '').trim().toLowerCase();
  return text === 'halftime' || text === 'ht' || text === 'mi-temps' || minute === 'mt' || minute === 'ht';
}

function intervalFor(summary: MatchSummary): number {
  if (summary.status === 'live') return LIVE_POLL_MS;
  const start = Date.parse(summary.startTime || '');
  if (Number.isNaN(start)) return SCHEDULED_POLL_MS;
  const delta = start - Date.now();
  if (delta <= 15 * 60_000) return NEAR_START_POLL_MS;
  if (delta <= 3 * 3600_000) return SCHEDULED_POLL_MS;
  if (delta <= 24 * 3600_000) return FAR_START_POLL_MS;
  return FAR_FUTURE_POLL_MS;
}

function readCorners(statistics?: { name: string; displayValue: string }[]): number | null {
  if (!statistics) return null;
  const stat = statistics.find((s) => s.name === 'wonCorners' || s.name === 'corners');
  if (!stat) return null;
  const value = parseInt(stat.displayValue, 10);
  return Number.isFinite(value) ? value : null;
}

function cardKind(type: string): 'yellow' | 'red' | null {
  const t = (type || '').toLowerCase();
  if (t.includes('yellow') || t.includes('jaune')) return 'yellow';
  if (t.includes('red') || t.includes('rouge')) return 'red';
  return null;
}

function notify(matchId: string, title: string, body: string, tag: string) {
  console.log(`[Notifications] ${title} — ${body}`);
  showMatchNotification({ title, body, tag, matchId });
}

function finishMatch(matchId: string) {
  done.add(matchId);
  states.delete(matchId);
}

async function checkMatch(matchId: string, state: WatchState) {
  try {
    const summary = await fetchMatchSummary(matchId);
    if (!summary) {
      state.failures += 1;
      state.nextPollAt = Date.now() + ERROR_POLL_MS;
      if (state.failures >= MAX_FAILURES) {
        states.delete(matchId);
      }
      return;
    }
    state.failures = 0;

    const now = Date.now();
    const homeScore = summary.homeTeam.score ?? 0;
    const awayScore = summary.awayTeam.score ?? 0;
    const scoreSum = homeScore + awayScore;
    const events = summary.keyEvents || [];

    if (!state.initialized) {
      state.initialized = true;
      state.status = summary.status;
      state.atHalfTime = summary.status === 'live' && isHalfTime(summary);
      state.goalCount = Math.max(state.goalCount, scoreSum, events.filter((e) => e.scoringPlay).length);
      state.knownEventIds = new Set(events.map((e) => e.id));
      for (const box of summary.boxscore || []) {
        const corners = readCorners(box.statistics);
        if (corners != null) state.corners[box.team.id] = corners;
      }
      if (summary.status === 'finished') {
        finishMatch(matchId);
        return;
      }
      state.nextPollAt = now + intervalFor(summary);
      return;
    }

    const prevStatus = state.status;

    // 1. Coup d'envoi
    if (prevStatus === 'upcoming' && summary.status === 'live' && !isHalfTime(summary)) {
      notify(matchId, "Coup d'envoi !", `${summary.title} · ${summary.league.name}`, `kickoff-${matchId}`);
    }

    // 2. Mi-temps
    const atHalfTime = summary.status === 'live' && isHalfTime(summary);
    if (atHalfTime && !state.atHalfTime) {
      notify(matchId, 'Mi-temps', `${summary.title} — ${homeScore}-${awayScore}`, `halftime-${matchId}`);
    }
    state.atHalfTime = atHalfTime;

    // 3. But (filet de sécurité quand le SSE est absent)
    if (scoreSum > state.goalCount) {
      const newScorers = events.filter((e) => e.scoringPlay && !state.knownEventIds.has(e.id));
      const latest = newScorers[newScorers.length - 1];
      const title = latest?.teamName
        ? `BUT ! ${latest.teamName} (${homeScore}-${awayScore})`
        : `BUT ! ${homeScore}-${awayScore}`;
      const body = [summary.title, latest?.clock].filter(Boolean).join(' · ');
      notify(matchId, title, body, `goal-${matchId}`);
      state.goalCount = scoreSum;
    }

    // 4. Cartons
    for (const ev of events) {
      if (ev.id && state.knownEventIds.has(ev.id)) continue;
      const kind = cardKind(ev.type);
      if (!kind) continue;
      const who = ev.participants?.[0]?.name || ev.teamName || '';
      const title =
        kind === 'yellow'
          ? `Carton jaune${who ? ` — ${who}` : ''}`
          : `Carton rouge${who ? ` — ${who}` : ''}`;
      const body = [ev.teamName, summary.title, ev.clock].filter(Boolean).join(' · ');
      notify(matchId, title, body, `card-${ev.id || matchId}`);
    }

    // 5. Corners
    for (const box of summary.boxscore || []) {
      const corners = readCorners(box.statistics);
      if (corners == null) continue;
      const previous = state.corners[box.team.id];
      if (previous !== undefined && corners > previous) {
        notify(
          matchId,
          `Corner — ${box.team.name}`,
          `${summary.title} · ${corners} corners`,
          `corner-${matchId}-${box.team.id}`,
        );
      }
      state.corners[box.team.id] = corners;
    }

    // 6. Fin de match
    if (summary.status === 'finished') {
      if (prevStatus === 'live') {
        notify(matchId, 'Fin du match', `${summary.title} — ${homeScore}-${awayScore}`, `ft-${matchId}`);
      }
      finishMatch(matchId);
      return;
    }

    state.status = summary.status;
    state.knownEventIds = new Set(events.map((e) => e.id));
    state.nextPollAt = now + intervalFor(summary);
  } catch (err) {
    console.warn('[Notifications] Vérification du match échouée:', matchId, err);
    state.failures += 1;
    state.nextPollAt = Date.now() + ERROR_POLL_MS;
    if (state.failures >= MAX_FAILURES) {
      states.delete(matchId);
    }
  } finally {
    state.checking = false;
  }
}

function tick() {
  if (!getFavoriteIds) return;
  let favorites: string[];
  try {
    favorites = getFavoriteIds();
  } catch {
    return;
  }
  const favoriteSet = new Set(favorites);

  for (const key of Array.from(states.keys())) {
    if (!favoriteSet.has(key)) states.delete(key);
  }
  for (const id of Array.from(done)) {
    if (!favoriteSet.has(id)) done.delete(id);
  }

  const now = Date.now();
  let budget = MAX_CHECKS_PER_TICK;
  for (const id of favorites) {
    if (budget <= 0) break;
    if (done.has(id)) continue;

    let state = states.get(id);
    if (state) {
      if (state.checking || state.nextPollAt > now) continue;
    } else {
      if (states.size >= MAX_WATCHED_MATCHES) continue;
      state = createState();
      states.set(id, state);
    }

    budget -= 1;
    state.checking = true;
    state.nextPollAt = now + LIVE_POLL_MS;
    void checkMatch(id, state);
  }
}

export function startFavoriteWatcher(provider: () => string[]) {
  if (timer) return;
  getFavoriteIds = provider;
  timer = setInterval(tick, TICK_MS);
  tick();
  console.log('[Notifications] Surveillance des favoris démarrée.');
}

export function stopFavoriteWatcher() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  getFavoriteIds = null;
  states.clear();
  done.clear();
}

/**
 * Aligné sur le score envoyé par le SSE : retourne false si le watcher a déjà
 * couvert ce but (évite un double alerte), true s'il faut notifier côté SSE.
 */
export function noteSseGoal(matchId: string, homeScore?: number, awayScore?: number): boolean {
  if (homeScore == null || awayScore == null) return true;
  const sum = homeScore + awayScore;
  let state = states.get(matchId);
  if (!state) {
    state = createState();
    states.set(matchId, state);
  }
  if (sum <= state.goalCount) return false;
  state.goalCount = sum;
  return true;
}

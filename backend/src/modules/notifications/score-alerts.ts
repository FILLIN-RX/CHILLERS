import { fetchLiveBallHomepage, parseBlocks, type LiveBallMatch } from '../liveball/liveball.service';
import { PushSubscription } from './notification.models';
import { markOnce, sendToSubscription, type PushPayload } from './push.service';

/** 5 s tant qu'un match de LiveBall est en direct, sinon on ralentit. */
const LIVE_POLL_MS = 5_000;
const IDLE_POLL_MS = 30_000;
const SUBSCRIBER_TTL_MS = 60_000;
const GOAL_MARKER_TTL_MS = 2 * 24 * 60 * 60 * 1000;

const TEAM_ALIASES: Array<[RegExp, string]> = [
  [/\bparis\s+saint[- ]germain\b/g, 'psg'],
  [/\bmanchester\s+city\b/g, 'mancity'],
  [/\bmanchester\s+united\b/g, 'manunited'],
  [/\batletico\s+madrid\b/g, 'atleticomadrid'],
  [/\breal\s+madrid\b/g, 'realmadrid'],
  [/\bbayern\s+(munich|munchen)\b/g, 'bayernmunich'],
  [/\bborussia\s+dortmund\b/g, 'dortmund'],
];

/** Nom comparable : minuscules, sans accent, alias de clubs et ponctuation. */
export function normalizeTeamName(name: string): string {
  let value = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [pattern, alias] of TEAM_ALIASES) value = value.replace(pattern, alias);
  value = value.replace(/\b(fc|cf|sc|ac|as|rc|us|afc|ssc|cd|club|de|united|city|hotspur|sporting)\b/g, '');
  return value.replace(/[^a-z0-9]/g, '');
}

export interface GoalScore {
  home: number;
  away: number;
  key: string;
}

/** « 3 : 1 », « 3-1 » ou « 3:1 » → score numérique comparable. */
export function parseGoalScore(score?: string): GoalScore | null {
  const match = score?.match(/(\d+)\s*[:\-–]\s*(\d+)/);
  if (!match) return null;
  const home = Number(match[1]);
  const away = Number(match[2]);
  return { home, away, key: `${home}-${away}` };
}

export function buildGoalNotification(fixture: LiveBallMatch, score: GoalScore): PushPayload {
  return {
    title: `But · ${fixture.home} ${score.home} - ${score.away} ${fixture.away}`,
    body: [fixture.league || 'En direct', fixture.minute].filter(Boolean).join(' · '),
    url: `/live/lb/${fixture.id}`,
    tag: `goal-${fixture.id}-${score.key}`,
    category: 'matches',
  };
}

interface Follower {
  subscription: any;
  teams: Set<string>;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let polling = false;
let followerCache: { at: number; list: Follower[] } | null = null;
/** Dernier score vu par match, pour ne pas notifier le score d'un match qu'on découvre. */
const lastScores = new Map<string, GoalScore>();

async function loadFollowers(): Promise<Follower[]> {
  if (followerCache && Date.now() - followerCache.at < SUBSCRIBER_TTL_MS) return followerCache.list;
  const rows = await PushSubscription.find({
    userId: { $ne: null },
    'preferences.matches': true,
    followedTeams: { $exists: true, $ne: [] },
  }).lean();
  const list = (rows as any[])
    .map((row) => ({
      subscription: row,
      teams: new Set<string>(
        (row.followedTeams || []).map((team: string) => normalizeTeamName(team)).filter(Boolean),
      ),
    }))
    .filter((follower) => follower.teams.size > 0);
  followerCache = { at: Date.now(), list };
  return list;
}

async function notifyGoal(fixture: LiveBallMatch, score: GoalScore, followers: Follower[]) {
  const home = normalizeTeamName(fixture.home);
  const away = normalizeTeamName(fixture.away);
  const concerned = followers.filter((follower) => follower.teams.has(home) || follower.teams.has(away));
  if (!concerned.length) return;

  const payload = buildGoalNotification(fixture, score);
  let accepted = 0;
  for (const follower of concerned) {
    // Un abonné = une notification par but, même si plusieurs workers tournent.
    if (!await markOnce(`goal:${follower.subscription._id}:${fixture.id}:${score.key}`, GOAL_MARKER_TTL_MS)) continue;
    if (await sendToSubscription(follower.subscription, payload)) accepted += 1;
  }
  if (accepted) console.info('[WebPush] But notifié.', { matchId: fixture.id, score: score.key, accepted });
}

/**
 * Compare deux relevés : un match découvert avec un score déjà ouvert sert de
 * référence, seuls les buts suivants sont renvoyés. Les matchs sortis du direct
 * sont oubliés.
 */
export function findNewGoals(
  fixtures: LiveBallMatch[],
  state: Map<string, GoalScore>,
): Array<{ fixture: LiveBallMatch; score: GoalScore }> {
  const seen = new Set<string>();
  const goals: Array<{ fixture: LiveBallMatch; score: GoalScore }> = [];
  for (const fixture of fixtures) {
    const score = parseGoalScore(fixture.score);
    if (!score) continue;

    const key = `liveball:${fixture.id}`;
    seen.add(key);
    const previous = state.get(key);
    state.set(key, score);
    if (!previous) continue;
    if (score.home + score.away <= previous.home + previous.away) continue;

    goals.push({ fixture, score });
  }

  for (const key of state.keys()) if (!seen.has(key)) state.delete(key);
  return goals;
}

/** Renvoie true si au moins un match était en direct (pour garder le rythme 5 s). */
async function pollOnce(): Promise<boolean> {
  const followers = await loadFollowers();
  if (!followers.length) return false;

  let fixtures: LiveBallMatch[];
  try {
    // Page brute, pas la route cachée 60 s : c'est ce qui fait la différence
    // entre une alerte à 8 s et une alerte à 40 s.
    fixtures = parseBlocks(await fetchLiveBallHomepage()).filter((match) => match.status === 'live');
  } catch {
    return false;
  }

  for (const { fixture, score } of findNewGoals(fixtures, lastScores)) {
    await notifyGoal(fixture, score, followers);
  }

  return fixtures.length > 0;
}

async function run() {
  if (polling) {
    schedule(IDLE_POLL_MS);
    return;
  }
  polling = true;
  let hasLive = false;
  try {
    hasLive = await pollOnce();
  } catch (error: any) {
    console.warn('[WebPush] Veille des scores en échec:', error?.message || error);
  } finally {
    polling = false;
    schedule(hasLive ? LIVE_POLL_MS : IDLE_POLL_MS);
  }
}

function schedule(delay: number) {
  timer = setTimeout(() => void run(), delay);
  timer.unref?.();
}

export function startScoreAlerts() {
  if (timer) return;
  console.log('[WebPush] Veille des scores démarrée (5 s sur les matchs en direct).');
  schedule(2_000);
}

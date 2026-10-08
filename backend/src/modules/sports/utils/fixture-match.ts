/**
 * Reprise de la même rencontre d'une source à l'autre.
 *
 * Chaque provider écrit les clubs à sa façon (« Maghreb de Fes » / « Maghreb Fès »,
 * « Raja Casablanca » / « Raja CA ») : la comparaison se fait donc sur des jetons
 * normalisés, avec tolérance pour les abréviations et les initiales, plutôt que
 * sur les libellés bruts.
 */
import type { SportsMatch } from '../sports.types';

const STOPWORDS = new Set([
  'fc', 'cf', 'sc', 'ac', 'afc', 'cfc', 'sk', 'fk', 'bk', 'de', 'du', 'del', 'la', 'le', 'les',
  'the', 'club', 'team', 'and', 'et', 'u',
]);

const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4', v: '5' };

export function teamTokens(name?: string): string[] {
  if (!name) return [];
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((t) => ROMAN[t] ?? t)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/** Deux jetons désignent le même mot si l'un est une abréviation de l'autre. */
function compatible(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length <= 4 && (b.startsWith(a) || b.endsWith(a))) return true;
  if (b.length <= 4 && (a.startsWith(b) || a.endsWith(b))) return true;
  return false;
}

/** 0 = rien en commun, 1 = les deux libellés couvrent les mêmes jetons. */
export function sideScore(a?: string, b?: string): number {
  const ta = teamTokens(a);
  const tb = teamTokens(b);
  if (!ta.length || !tb.length) return 0;

  const initials = (t: string[]) => t.map((x) => x[0]).join('');
  if (ta.length === 1 && tb.length > 1 && compatible(ta[0], initials(tb))) return 1;
  if (tb.length === 1 && ta.length > 1 && compatible(tb[0], initials(ta))) return 1;

  const free = tb.map(() => false);
  let hits = 0;
  for (const x of ta) {
    const idx = tb.findIndex((y, i) => !free[i] && compatible(x, y));
    if (idx >= 0) {
      free[idx] = true;
      hits++;
    }
  }
  return hits / Math.max(ta.length, tb.length);
}

/** Score d'une paire de rencontres : sides dans l'ordre, puis inversés. */
export function fixtureScore(a: Pick<SportsMatch, 'home' | 'away'>, b: Pick<SportsMatch, 'home' | 'away'>): number {
  const straight = Math.min(sideScore(a.home, b.home), sideScore(a.away, b.away));
  const crossed = Math.min(sideScore(a.home, b.away), sideScore(a.away, b.home));
  return Math.max(straight, crossed);
}

const CLOSE_KICKOFF_S = 45 * 60;

/**
 * Deux entrées désignent la même rencontre. Un score parfait passe sans autre
 * formalité ; un score partiel n'est retenu que si les coups d'envoi collent,
 * sinon on risquerait de servir le match du voisin de 20h30.
 */
export function isSameFixture(a: SportsMatch, b: SportsMatch): boolean {
  const score = fixtureScore(a, b);
  if (score >= 0.99) return true;
  if (score < 0.5) return false;
  if (a.startTs === undefined || b.startTs === undefined) return false;
  return Math.abs(a.startTs - b.startTs) <= CLOSE_KICKOFF_S;
}

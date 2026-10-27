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
  const tokens = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .map((t) => ROMAN[t] ?? t)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));

  // Sigle de club accolé au libellé (« Real Madrid RM », « Raja CA ») : ce n'est
  // pas un mot supplémentaire, c'est l'initiale des autres jetons. Le compter
  // ferait chuter le score et empêcherait la reprise d'un provider à l'autre.
  return tokens.filter((t, i) => {
    if (t.length > 3) return true;
    const others = tokens.filter((_, j) => j !== i);
    if (!others.length) return true;
    return t !== others.map((x) => x[0]).join('');
  });
}

/** Distance d'édition ≤ 1 (une insertion, suppression ou substitution). */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Deux jetons désignent le même mot si l'un est une abréviation/variante de l'autre. */
function compatible(a: string, b: string): boolean {
  if (a === b) return true;
  // Tolérance d'abréviation : un jeton court est le début/fin de l'autre.
  // Seuil ≤7 pour couvrir "riyad"/"riyadh", "diriya"/"diriyah", "madrid"/"madridista"…
  if (a.length <= 7 && (b.startsWith(a) || b.endsWith(a))) return true;
  if (b.length <= 7 && (a.startsWith(b) || a.endsWith(b))) return true;
  // Variantes orthographiques d'une langue à l'autre (« Barcelone » / « Barcelona »,
  // « Munich » / « Munchen ») : un seul caractère d'écart sur un mot assez long.
  if (a.length >= 5 && b.length >= 5 && withinOneEdit(a, b)) return true;
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

export const CLOSE_KICKOFF_S = 45 * 60;

/**
 * Deux entrées désignent la même rencontre.
 *
 * • Score ≥ 0.99 → match parfait, on accepte même sans timestamp.
 * • Score ≥ 0.75 → très haute confiance ; on accepte si l'un des deux n'a pas
 *   de timestamp (fréquent pour liveball dont les matchs live n'ont pas de startTs).
 * • Score ≥ 0.5  → confiance partielle ; les deux timestamps doivent être proches.
 * • Score < 0.5  → rejeté.
 */
export function isSameFixture(a: SportsMatch, b: SportsMatch): boolean {
  const score = fixtureScore(a, b);
  if (score >= 0.99) return true;
  if (score < 0.5) return false;
  // Haute confiance : on accepte même si un seul côté a un timestamp.
  if (score >= 0.75 && (a.startTs === undefined || b.startTs === undefined)) return true;
  if (a.startTs === undefined || b.startTs === undefined) return false;
  return Math.abs(a.startTs - b.startTs) <= CLOSE_KICKOFF_S;
}

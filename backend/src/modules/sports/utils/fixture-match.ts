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
  // Article arabe : présent dans presque tous les noms de club, il ne
  // distingue rien. Le laisser donnait 50 % à deux affiches différentes à la
  // même heure (« Al-Nahda / Al-Rayyan » ≈ « Al-Dzhazira / Al-Mukharrak »),
  // donc de faux jumeaux et le flux d'un autre match servi.
  'al', 'el',
]);

const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4', v: '5' };

/**
 * Plie les translittérations des live (« Al-Khalidzh », « Khaleej », « Hazm »)
 * sur une forme commune. Sans ce pli, LiveBall, kora et streamiz décrivent la
 * même affiche avec des graphies que la distance d'édition ne rapproche pas :
 * la chaîne de flux ne voit alors jamais le jumeau qui, lui, diffuse.
 * Mêmes règles que le plieur du client (`src/lib/match-poster.ts`).
 */
const FOLD_RULES: Array<[RegExp, string]> = [
  [/dzh/g, 'g'],
  [/kh/g, 'h'],
  [/gh/g, 'g'],
  [/ph/g, 'f'],
  [/ch/g, 'j'],
  [/ck/g, 'k'],
  [/sh/g, 's'],
  [/j/g, 'h'],
  [/[cq]/g, 'k'],
  [/x/g, 'ks'],
  [/y/g, 'i'],
  [/w/g, 'v'],
  [/v/g, 'u'],
  [/z/g, 's'],
  [/ee/g, 'i'],
  [/oo/g, 'u'],
  [/aa/g, 'a'],
  [/(.)\1+/g, '$1'],
];

function foldTransliteration(token: string): string {
  let value = token;
  for (const [pattern, replacement] of FOLD_RULES) value = value.replace(pattern, replacement);
  return value;
}

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

/**
 * Distance d'édition ≤ 1 (une insertion, suppression ou substitution).
 * Le balayage naïf comptait deux éditions pour « Hazem » / « Hazm » quand la
 * lettre en trop précède la fin du mot ; on retire un caractère du plus long
 * et on compare, ce qui est exact pour une longueur d'un cran d'écart.
 */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    let diffs = 0;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i] && ++diffs > 1) return false;
    }
    return true;
  }
  const short = a.length < b.length ? a : b;
  const long = a.length < b.length ? b : a;
  for (let i = 0; i < long.length; i++) {
    if (long.slice(0, i) + long.slice(i + 1) === short) return true;
  }
  return false;
}

function sameToken(a: string, b: string): boolean {
  if (a === b) return true;
  // Tolérance d'abréviation : un jeton court est le début/fin de l'autre.
  // Seuil ≤7 pour couvrir "riyad"/"riyadh", "diriya"/"diriyah", "madrid"/"madridista"…
  if (a.length <= 7 && (b.startsWith(a) || b.endsWith(a))) return true;
  if (b.length <= 7 && (a.startsWith(b) || a.endsWith(b))) return true;
  // Variantes orthographiques d'une langue à l'autre (« Barcelone » / « Barcelona »,
  // « Munich » / « Munchen », « Hazem » / « Hazm ») : un seul caractère d'écart.
  // Une substitution exige deux mots assez longs ; une lettre de plus ou de
  // moins est une preuve plus forte et passe dès 4 caractères.
  const longer = Math.max(a.length, b.length);
  const shorter = Math.min(a.length, b.length);
  if (withinOneEdit(a, b) && shorter >= (longer === shorter ? 5 : 4)) return true;
  return false;
}

/**
 * Deux jetons désignent le même mot si l'un est une abréviation/variante de
 * l'autre, y compris à travers une translittération (« Khalidzh » / « Khaleej »).
 * La forme brute est testée d'abord : le pli ne doit jamais casser une paire
 * déjà reconnue (« Hazem » / « Hazm »).
 */
function compatible(a: string, b: string): boolean {
  if (sameToken(a, b)) return true;
  const fa = foldTransliteration(a);
  const fb = foldTransliteration(b);
  if (fa === a && fb === b) return false;
  return sameToken(fa, fb);
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
  // Un libellé qui ajoute la ville qualifie le même club (« Al-Khaleej » /
  // « Al Khaleej Saihat ») : quand tous les jetons de la forme courte sont
  // couverts, la côté est complet — sinon le jumeau reste invisible et la
  // chaîne s'arrête à un provider sans flux.
  if (hits === Math.min(ta.length, tb.length)) return 1;
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

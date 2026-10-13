/**
 * Affiche des rencontres diffusées en direct.
 *
 * Deux problèmes distincts, et deux mécanismes :
 *
 * 1. SAVOIR SI UN MATCH EST UNE « GRANDE COMPÉTITION ». On se fie au libellé de
 *    ligue publié par la source. Ne pas se fier à la jointure avec le service de
 *    score pour décider : LiveBall écrit les noms en français (« FC Barcelone »,
 *    « Club Bruges », « Sporting CP ») et un match de Ligue des Champions qui ne
 *    se rejoint pas disparaîtrait de la page. La jointure enrichit, elle n'exclut
 *    jamais.
 * 2. HABILLER L'AFFICHE (badge de compétition, écussons). Le service de score est
 *    la seule source qui nomme la compétition correctement (le flux ESPN global
 *    répond « Football ») et donne les écussons officiels.
 */
import type { PosterFixture } from "@/types/matches";

export type { PosterFixture };

/**
 * Libellés de compétitions à retenir. Comparaison sur le libellé normalisé
 * (minuscules, sans accents, sans ponctuation) : égalité stricte pour les ligues
 * dont le nom seul désigne une division (« Egypt. Premier League » n'est pas la
 * Premier League), recouvrement pour les familles UEFA où la source ajoute un
 * qualifiant (« UEFA Women's Champions League »).
 */
const MAJOR_COMPETITIONS: Array<(label: string) => boolean> = [
  (l) => l.includes("europa"),
  (l) => l.includes("conference league"),
  (l) => l.includes("nations league"),
  (l) => l === "premier league" || l === "english premier league" || l === "epl",
  (l) => l === "la liga" || l === "laliga" || l === "spain la liga",
  (l) => l === "serie a" || l === "italy serie a",
  (l) => l === "bundesliga" || l === "germany bundesliga",
  (l) => l === "ligue 1" || l === "france ligue 1",
  (l) => l.includes("libertadores"),
  (l) => l.includes("champions league") && !/\b(afc|caf|concacaf|ofc|amateur)\b/.test(l),
];

function normalizeLabel(league?: string): string {
  return (league || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Vrai si la rencontre entre dans la vitrine « grandes compétitions ». La
 * décision se prend sur le libellé de la source, jamais sur la jointure avec le
 * service de score : une non-jointure (graphie de club inconnue) ne doit pas
 * faire disparaître le match.
 */
export function isMajorCompetition(league?: string): boolean {
  const label = normalizeLabel(league);
  if (!label) return false;
  return MAJOR_COMPETITIONS.some((test) => test(label));
}

/**
 * Étiquette lisible d'une compétition. LiveBall publie un slug
 * (« uefa-champions-league ») : l'afficher tel quel se lirait mal sur l'affiche.
 */
export function presentCompetition(label?: string | null): string | null {
  if (!label) return null;
  const looksLikeSlug = /[-_]/.test(label) || !/[A-Z]/.test(label);
  if (!looksLikeSlug) return label;
  return normalizeLabel(label)
    .split(" ")
    .filter(Boolean)
    .map((word) =>
      word === "uefa" || word === "afc" ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)
    )
    .join(" ");
}

// Les graphismes live abrègent ou francisent (« PSG », « Man City », « Barcelone »)
// là où le service de score écrit le nom anglais : sans ces équivalences, la
// rencontre ne se rejoint pas et l'affiche reste sans écusson officiel.
const TEAM_ALIASES: Array<[RegExp, string]> = [
  [/\bparis\s+saint[-\s]?germain\b/g, "psg"],
  [/\bparis\s+sg\b/g, "psg"],
  [/\bmanchester\s+city\b/g, "mancity"],
  [/\bmanchester\s+united\b/g, "manunited"],
  [/\bman\s+city\b/g, "mancity"],
  [/\bman\s+utd?\b/g, "manunited"],
  [/\batletico\s+madrid\b/g, "atleticomadrid"],
  [/\breal\s+madrid\b/g, "realmadrid"],
  [/\bbayern\s+munchen\b/g, "bayern"],
  [/\bborussia\d*\s+dortmund\b/g, "dortmund"],
  [/\btottenham\b/g, "spurs"],
  [/\binternazionale\b/g, "inter"],
  [/\bolympique\s+marseille\b/g, "marseille"],
  [/\bolympique\s+lyonnais\b/g, "lyon"],
  // Cas relevés sur les flux du jour, où la seule suppression des mentions de
  // club ne suffit pas : la graphie française ne ressemble plus à la clé anglaise.
  [/\bsporting\s+(cp|lisbonne|lisbon|portugal)\b/g, "sportingcp"],
  [/\bbarcelone\b/g, "barcelona"],
  [/\bclub\s+bruges\b/g, "brugge"],
  [/\bnewcastle\s+united\b/g, "newcastle"],
  [/\bpraha\b/g, "prague"],
];

// « sporting » reste dans la clé : c'est l'identité de Sporting CP / Sporting
// Braga, et les sources abrègent souvent le nom en « Sporting » seul. Les
// suffixes associatifs courts (FA, FK, SK…) sont retirés : une source écrit
// « Sabah FA », le score écrit « Sabah FK », et les deux cartes feraient doublon.
const NOISE_TOKENS = /\b(fc|cf|sc|ac|as|rc|us|afc|ssc|cd|club|de|united|city|hotspur|fa|fk|sk|bk|if|aif|kvv|sv)\b/g;

/** Clé de comparaison d'un nom d'équipe : minuscules, sans accents, sans mention de club. */
export function normalizeTeam(name?: string): string {
  if (!name) return "";
  let s = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[^a-z0-9 ]/g, " ");
  for (const [pattern, alias] of TEAM_ALIASES) s = s.replace(pattern, alias);
  s = s.replace(NOISE_TOKENS, " ");
  s = s.replace(/\s+/g, "");
  return s.trim();
}

/** Vrai quand les deux noms désignent la même équipe ; les clés trop courtes sont rejetées. */
function sameTeam(a: string | undefined, b: string | undefined): boolean {
  const ka = normalizeTeam(a);
  const kb = normalizeTeam(b);
  if (ka.length < 3 || kb.length < 3) return false;
  return ka === kb || ka.includes(kb) || kb.includes(ka);
}

export interface MatchPoster {
  fixture: PosterFixture;
  /** Les sources inversent parfois domicile et extérieur. */
  swapped: boolean;
}

const HOUR = 3600;
const DAY_MS = 86_400_000;

/** Heure locale du coup d'envoi ; chaîne vide quand aucune source ne la publie. */
export function formatMatchTime(ts?: number): string {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Repère relatif sur le jour du coup d'envoi : « Aujourd'hui », « Demain »,
 * « Hier », puis la date courte. Une rencontre qui bascule après minuit se lit
 * mal avec la seule heure.
 */
export function formatMatchDay(ts?: number, now: Date = new Date()): string | null {
  if (!ts) return null;
  const start = new Date(ts * 1000);
  const days = Math.round(
    (Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()) -
      Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) /
      DAY_MS
  );
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  if (days === -1) return "Hier";
  return start.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Trouve la fiche du service de score correspondant à une rencontre diffusée.
 * La fenêtre de date est exigée : deux mêmes clubs peuvent se rencontrer en
 * championnat puis en coupe, et le service de score renvoie aussi la journée
 * précédente quand rien n'est programmé aujourd'hui.
 */
export function findPoster(
  fixtures: PosterFixture[],
  match: { home: string; away: string; startTs?: number }
): MatchPoster | null {
  if (!match.home || !match.away || fixtures.length === 0) return null;

  for (const fixture of fixtures) {
    const direct = sameTeam(match.home, fixture.home) && sameTeam(match.away, fixture.away);
    const swapped = sameTeam(match.home, fixture.away) && sameTeam(match.away, fixture.home);
    if (!direct && !swapped) continue;

    if (match.startTs && fixture.startTs) {
      if (Math.abs(fixture.startTs - match.startTs) > 48 * HOUR) continue;
    }

    return { fixture, swapped: swapped && !direct };
  }

  return null;
}

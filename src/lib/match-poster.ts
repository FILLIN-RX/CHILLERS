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
 *    la seule source qui donne les écussons officiels ; le flux ESPN global
 *    publie désormais la ligue réelle (résolue côté serveur via summary), et
 *    LiveBall écrit les noms en français.
 */
import type { PosterFixture } from "@/types/matches";

export type { PosterFixture };

/**
 * Catégories écartées de la vitrine, quels que soient les libellés
 * qualifiants : femmes, jeunes, réserves, futsal/salle, divisions
 * inférieures (« Saudi Arabia. Division 1 », « Brazilian Serie B »,
 * « English League Championship »).
 */
function isMinorCompetition(label: string): boolean {
  return (
    /\b(women|feminine|youth|reserve|reserves|amateur|indoor|futsal|beach|street|esports)\b/.test(label) ||
    /\bu ?(1[5-9]|2[01]|23)\b/.test(label) ||
    /\b(division [0-9]|league 2|league one|league two|2 liga|segunda|serie b|championship|second division|reserves?)\b/.test(
      label
    )
  );
}

/**
 * Libellés de compétitions à retenir. Comparaison sur le libellé normalisé
 * (minuscules, sans accents, sans ponctuation) : égalité stricte pour les ligues
 * dont le nom seul désigne une division (« Egypt. Premier League » est
 * qualifié via son pays, « Saudi Arabia. Division 1 » est écarté comme
 * division inférieure), recouvrement pour les familles de coupes où la source
 * ajoute un qualifiant (« AFC Champions League Elite »).
 */
const MAJOR_COMPETITIONS: Array<(label: string) => boolean> = [
  // Coupes continentales (UEFA, AFC, CAF, CONCACAF, CONMEBOL)
  (l) => l.includes("champions league"),
  (l) => l.includes("champions cup"),
  (l) => l.includes("europa"),
  (l) => l.includes("conference league"),
  (l) => l.includes("libertadores"),
  (l) => l.includes("sudamericana"),
  (l) => l.includes("concacaf"),
  (l) => l.includes("africa cup") || l.includes("afcon"),
  // Cinq grands championnats : égalité stricte sur le nom de la division
  (l) => l === "premier league" || l === "english premier league" || l === "epl",
  (l) => l === "la liga" || l === "laliga" || l === "spain la liga",
  (l) => l === "serie a" || l === "italy serie a",
  (l) => l === "bundesliga" || l === "germany bundesliga",
  (l) => l === "ligue 1" || l === "france ligue 1",
  // Autres grands championnats européens
  (l) => l.includes("super lig"),
  (l) => l.includes("primeira liga"),
  (l) => l.includes("eredivisie"),
  (l) => l.includes("pro league"),
  (l) => l.includes("scottish premiership"),
  (l) => l.includes("super league"),
  (l) => l.includes("austrian bundesliga"),
  (l) => l.includes("nations league"),
  // Grandes coupes nationales
  (l) => l.includes("fa cup"),
  (l) => l.includes("pokal") || l.includes("dfb"),
  (l) => l.includes("copa del rey") || l.includes("coupe du roi"),
  (l) => l.includes("coppa italia") || l.includes("coupe d italie"),
  (l) => l.includes("coupe de france"),
  (l) => l.includes("king s cup") || l.includes("kings cup"),
  // Monde arabe et Afrique du Nord (« Saudi Pro League », « Egypt. Premier
  // League », « Botola Pro », « Qatar Stars League »…)
  (l) => l.includes("saudi"),
  (l) => l.includes("qatar"),
  (l) => l.includes("emirates") || l.includes("united arab") || l.includes("arab gulf") || l.includes("uae"),
  (l) => l.includes("egypt"),
  (l) => l.includes("morocc") || l.includes("botola"),
  (l) => l.includes("alger"),
  (l) => l.includes("tunisi"),
  (l) =>
    l.includes("iraq") ||
    l.includes("kuwait") ||
    l.includes("bahrain") ||
    l.includes("oman") ||
    l.includes("jordan"),
  // Amériques
  (l) => l === "mls" || l.includes("major league soccer"),
  (l) => l.includes("liga mx") || l.includes("liga bbva") || l === "mexican liga bbva mx",
  (l) => l.includes("liga profesional") || l.includes("argentine"),
  (l) => l.includes("brazilian") || l.includes("brasileir") || l.includes("brasil"),
  (l) => l.includes("primera a"),
  // Compétitions mondiales
  (l) => l.includes("world cup"),
  (l) => l.includes("olympic"),
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
  if (isMinorCompetition(label)) return false;
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
  // Streamiz abrège en plus le nom (« MU Manchester Utd ») : sans cette règle, la
  // clé « mumanchesterutd » ne recouvre pas « manunited » et la carte fait doublon.
  [/\bmanchester\s+utd\b/g, "manunited"],
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
  // Le flux russe francise l'allemand (« Kyoln ») là où ESPN écrit l'anglais.
  [/\bcologne\b/g, "koln"],
];

// « sporting » reste dans la clé : c'est l'identité de Sporting CP / Sporting
// Braga, et les sources abrègent souvent le nom en « Sporting » seul. Les
// suffixes associatifs courts (FA, FK, SK…) sont retirés : une source écrit
// « Sabah FA », le score écrit « Sabah FK », et les deux cartes feraient doublon.
const NOISE_TOKENS = /\b(fc|cf|sc|ac|as|rc|us|afc|ssc|cd|club|de|united|city|hotspur|fa|fk|sk|bk|if|aif|kvv|sv)\b/g;

/**
 * Replie les translittérations russes des live (« Rot-Vayss », « Grossashpakh »,
 * « Darmshtadt », « Verder ») sur les graphies ESPN. Les règles s'appliquent aux
 * deux côtés de la comparaison : elles ne rapprochent jamais une source d'une
 * autre sans que les deux clés passent par la même réduction.
 */
function foldTransliteration(key: string): string {
  return key
    .replace(/sht/g, "st")
    .replace(/kh/g, "h")
    .replace(/gh/g, "g")
    .replace(/ph/g, "f")
    .replace(/ch/g, "j")
    .replace(/j/g, "h")
    .replace(/ck/g, "k")
    .replace(/sh/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/x/g, "ks")
    .replace(/yo/g, "o")
    .replace(/ay/g, "ei")
    .replace(/ey/g, "ei")
    .replace(/y/g, "i")
    .replace(/w/g, "v")
    .replace(/v/g, "u")
    .replace(/z/g, "s")
    .replace(/ee/g, "i")
    .replace(/oo/g, "u")
    .replace(/aa/g, "a")
    .replace(/eo/g, "o")
    .replace(/(.)\1+/g, "$1");
}

/** Clé de comparaison d'un nom d'équipe : minuscules, sans accents, sans mention de club. */
export function normalizeTeam(name?: string): string {
  if (!name) return "";
  let s = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    // « Großaspach » se cassait en « gro aspach » sur le remplacement des
    // caractères non latins, ce qui empêchait toute jointure.
    .replace(/ß/g, "ss");
  s = s.replace(/[^a-z0-9 ]/g, " ");
  for (const [pattern, alias] of TEAM_ALIASES) s = s.replace(pattern, alias);
  s = s.replace(NOISE_TOKENS, " ");
  s = s.replace(/\s+/g, "");
  return foldTransliteration(s.trim());
}

/**
 * Catégorie d'une équipe (U19, U21, réserves…) : elle désigne une autre équipe
 * que l'équipe première. Sans ce repère, le recouvrement de chaînes ci-dessous
 * joindrait « AS Roma (U-19) » à « AS Roma » et ferait hériter au match des
 * jeunes le coup d'envoi de l'équipe première (« 20:00 ») → écran d'attente
 * bloquant alors que le match est déjà en direct.
 */
export function teamTier(name?: string): string {
  if (!name) return "";
  const s = name.toLowerCase();
  const age = s.match(/\b(?:u|under)\s?-?\s?(\d{1,2})\b/);
  if (age) return `u${age[1]}`;
  if (/\breserves?\b|\breserve team\b|\bii\b/.test(s)) return "reserves";
  return "";
}

/** Vrai quand les deux noms désignent la même équipe ; les clés trop courtes sont rejetées. */
function sameTeam(a: string | undefined, b: string | undefined): boolean {
  const ka = normalizeTeam(a);
  const kb = normalizeTeam(b);
  if (ka.length < 3 || kb.length < 3) return false;
  // Deux catégories différentes ne sont jamais la même équipe.
  if (teamTier(a) !== teamTier(b)) return false;
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

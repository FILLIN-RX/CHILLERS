import type { OhaChannel } from "@/types/oha";

/**
 * Droits TV France — saison 2026-2027 (vérifiés) :
 *  - Ligue des champions / Europa / Conference : CANAL+ (exclusif)
 *  - Premier League, Top 14, F1, MotoGP, NBA : CANAL+
 *  - Ligue 2, Coupe de France, Bundesliga, Coupe du monde : beIN Sports
 *  - Liga, Serie A : DAZN (+ Disney+ pour la Liga)
 *  - Ligue 1 : plateforme Ligue 1+ (pas de chaîne linéaire)
 *  - Roland-Garros / JO : France Télévisions ; cyclisme : France TV + Eurosport
 */

export interface MatchChannelInfo {
  sport?: string;
  league?: string;
  title?: string;
  /** Diffuseurs annoncés par la source du match, quand ils existent. */
  broadcast?: string[];
}

interface Rule {
  test: RegExp;
  /** Libellé affiché (« Diffuse : … »). */
  label: string;
  /** Chaînes préférées, dans l'ordre (noms du catalogue CHILLERS). */
  channels: string[];
}

const RULES: Rule[] = [
  {
    test: /ligue des champions|champions league|\bucl\b/i,
    label: "Ligue des champions",
    channels: ["CANAL+ SPORT", "CANAL+ FOOT", "CANAL+ SPORT 1", "CANAL+ SPORT 2", "CANAL+ SPORT 360"],
  },
  {
    test: /ligue europa|europa league/i,
    label: "Ligue Europa",
    channels: ["CANAL+ SPORT", "CANAL+ FOOT", "CANAL+ SPORT 2", "CANAL+ SPORT 3", "CANAL+ SPORT 360"],
  },
  {
    test: /conference league/i,
    label: "Conference League",
    channels: ["CANAL+ SPORT", "CANAL+ SPORT 3", "CANAL+ SPORT 4"],
  },
  {
    test: /\bligue 1\b|ligue1/i,
    label: "Ligue 1",
    channels: [
      "DAZN LIGUE 1 LIVE 1",
      "DAZN LIGUE 1 LIVE 2",
      "DAZN 1",
      "DAZN 2",
      "DAZN 2 LEAUGE 1",
    ],
  },
  {
    test: /\bligue 2\b|ligue2/i,
    label: "Ligue 2",
    channels: ["BEIN SPORTS 1", "BEIN SPORTS 2", "BEIN SPORTS MAX 4"],
  },
  {
    test: /coupe de france/i,
    label: "Coupe de France",
    channels: ["BEIN SPORTS 1", "BEIN SPORTS 2", "FRANCE 2", "FRANCE 3"],
  },
  {
    test: /premier league/i,
    label: "Premier League",
    channels: ["CANAL+ SPORT", "CANAL+ SPORT 1", "CANAL+ SPORT 2"],
  },
  {
    test: /la ?liga/i,
    label: "Liga",
    channels: ["DAZN 1", "DAZN 2", "DAZN EVENT 1"],
  },
  {
    test: /serie a/i,
    label: "Serie A",
    channels: ["DAZN 1", "DAZN 2", "DAZN EVENT 2"],
  },
  {
    test: /bundesliga/i,
    label: "Bundesliga",
    channels: ["BEIN SPORTS 1", "BEIN SPORTS 2", "BEIN SPORTS MAX 4"],
  },
  {
    test: /top 14|champions cup|rugby|six nations|tournoi des six/i,
    label: "Rugby",
    channels: ["CANAL+ SPORT", "CANAL+ SPORT 1", "FRANCE 2"],
  },
  {
    test: /\bnba\b|euroleague|basket/i,
    label: "Basket",
    channels: ["BEIN SPORTS 1", "BEIN SPORTS 2", "CANAL+ SPORT"],
  },
  {
    test: /formule 1|formula 1|\bf1\b/i,
    label: "Formule 1",
    channels: ["CANAL+ SPORT", "CANAL+ SPORT 360", "CANAL+ SPORT 1"],
  },
  {
    test: /moto ?gp/i,
    label: "MotoGP",
    channels: ["CANAL+ SPORT", "CANAL+ SPORT 2", "CANAL+ SPORT 360"],
  },
  {
    test: /tennis|roland|atp|wta|wimbledon|australian open|us open/i,
    label: "Tennis",
    channels: ["EUROSPORT 1", "FRANCE 2", "FRANCE 3", "CANAL+ SPORT"],
  },
  {
    test: /cyclisme|tour de france|giro|vuelta|paris-roubaix/i,
    label: "Cyclisme",
    channels: ["FRANCE 2", "FRANCE 3", "EUROSPORT 1", "EUROSPORT 2"],
  },
  {
    test: /\bufc\b|\bmma\b|boxe|boxing/i,
    label: "Combat",
    channels: ["DAZN 1", "BEIN SPORTS 1", "BEIN SPORTS MAX 4", "DAZN EVENT 1"],
  },
  {
    test: /coupe du monde|world cup|\beuro\b|eurocopa|euro 20/i,
    label: "Équipe de France",
    channels: ["BEIN SPORTS 1", "M6", "TF1", "FRANCE 2", "FRANCE 3"],
  },
  {
    test: /jeux olympiques|olympic/i,
    label: "Jeux olympiques",
    channels: ["FRANCE 2", "FRANCE 3", "EUROSPORT 1", "EUROSPORT 2"],
  },
];

/** Repli par sport quand la compétition n'est pas reconnue. */
const SPORT_FALLBACK: Record<string, string[]> = {
  football: ["CANAL+ SPORT", "BEIN SPORTS 1", "DAZN 1"],
  rugby: ["CANAL+ SPORT", "CANAL+ SPORT 1"],
  basketball: ["BEIN SPORTS 1", "BEIN SPORTS 2"],
  tennis: ["EUROSPORT 1", "FRANCE 2"],
  other: ["BEIN SPORTS 1", "CANAL+ SPORT", "EUROSPORT 1"],
};

function norm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9+]/gu, "");
}

/** Le nom du catalogue correspond-il au libellé attendu ? */
function sameChannel(name: string, wanted: string): boolean {
  const a = norm(name);
  const b = norm(wanted);
  if (!a || !b) return false;
  if (a === b) return true;
  // « CANAL+ SPORT » doit matcher « Canal+ Sport » mais pas « Canal+ Sport 360 ».
  return a.startsWith(b) && /^\d*$/u.test(a.slice(b.length));
}

export function matchChannelInfo(info: MatchChannelInfo): MatchChannelInfo {
  return info;
}

/** Compétitions reconnues pour un match (libellés). */
export function matchCompetitionLabels(info: MatchChannelInfo): string[] {
  const haystack = `${info.league ?? ""} ${info.title ?? ""}`;
  return RULES.filter((r) => r.test.test(haystack)).map((r) => r.label);
}

/** Noms de chaînes préférés pour un match, dans l'ordre. */
export function preferredChannelNames(info: MatchChannelInfo): string[] {
  const haystack = `${info.league ?? ""} ${info.title ?? ""}`;
  const names: string[] = [];

  // 1. Diffuseurs annoncés par la source (les plus fiables).
  for (const b of info.broadcast ?? []) {
    const hit = RULES.flatMap((r) => r.channels).find((c) => sameChannel(c, b));
    if (hit && !names.includes(hit)) names.push(hit);
  }

  // 2. Règles de compétition.
  for (const rule of RULES) {
    if (!rule.test.test(haystack)) continue;
    for (const c of rule.channels) {
      if (!names.includes(c)) names.push(c);
    }
  }

  // 3. Repli par sport.
  if (names.length === 0) {
    const fallback = SPORT_FALLBACK[info.sport ?? "other"] ?? SPORT_FALLBACK.other;
    names.push(...fallback);
  }

  return names;
}

/** Chaînes du catalogue correspondant au match, ordonnées. */
export function pickMatchChannels(
  channels: OhaChannel[],
  info: MatchChannelInfo,
): OhaChannel[] {
  const preferred = preferredChannelNames(info);
  const out: OhaChannel[] = [];
  const used = new Set<string>();

  for (const wanted of preferred) {
    const ch = channels.find((c) => sameChannel(c.name, wanted) && !used.has(c.id));
    if (ch) {
      out.push(ch);
      used.add(ch.id);
    }
  }
  return out;
}

/** Compétitions diffusées par une chaîne (pour « Diffuse : … »). */
export function competitionsForChannel(channelName: string): string[] {
  const labels: string[] = [];
  for (const rule of RULES) {
    if (rule.channels.some((c) => sameChannel(channelName, c))) {
      if (!labels.includes(rule.label)) labels.push(rule.label);
    }
  }
  return labels;
}

/* ── Vérification à l'heure du match ─────────────────────────────────────── */

export interface MatchChannelStatus {
  channel: OhaChannel;
  /** L'EPG de la chaîne annonce bien ce match (titre/équipes/compétition). */
  confirmed: boolean;
  /** Titre du programme qui a confirmé la diffusion. */
  matchedTitle?: string;
}

const NAME_STOP_WORDS = new Set([
  "fc", "cf", "sc", "ac", "as", "rc", "us", "afc", "ssc", "cd", "club", "de", "of",
  "the", "city", "united", "sport", "sports", "inter", "union", "stade", "olympique",
  "athletic", "atletico", "dynamo", "fk", "sk", "bk", "real", "sporting", "football",
]);

function tokens(value?: string): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .split(/[^a-z0-9]+/u)
    .filter((t) => t.length >= 3 && !NAME_STOP_WORDS.has(t));
}

/** Mots-clés de compétition cherchés dans le titre EPG. */
const COMPETITION_KEYWORDS: { test: RegExp; keywords: RegExp }[] = [
  {
    test: /ligue des champions|champions league|\bucl\b/i,
    keywords: /ligue des champions|champions league|\bucl\b|\bc1\b|multiplex/i,
  },
  { test: /ligue europa|europa league/i, keywords: /ligue europa|europa league|\bc3\b/i },
  { test: /conference league/i, keywords: /conference league/i },
  { test: /\bligue 1\b|ligue1/i, keywords: /ligue 1|ligue1|\bl1\b/i },
  { test: /\bligue 2\b|ligue2/i, keywords: /ligue 2|ligue2|\bl2\b/i },
  { test: /coupe de france/i, keywords: /coupe de france/i },
  { test: /premier league/i, keywords: /premier league|\bpl\b/i },
  { test: /la ?liga/i, keywords: /la ?liga|laliga/i },
  { test: /serie a/i, keywords: /serie a/i },
  { test: /bundesliga/i, keywords: /bundesliga/i },
  { test: /top 14|champions cup|rugby|six nations/i, keywords: /top 14|champions cup|rugby|six nations|tournoi/i },
  { test: /\bnba\b|euroleague|basket/i, keywords: /\bnba\b|euroleague|basket/i },
  { test: /formule 1|formula 1|\bf1\b/i, keywords: /formule 1|formula 1|grand prix|\bgp\b/i },
  { test: /moto ?gp/i, keywords: /moto ?gp/i },
  { test: /tennis|roland|atp|wta|wimbledon|australian open|us open/i, keywords: /tennis|roland|atp|wta|wimbledon|open/i },
  { test: /cyclisme|tour de france|giro|vuelta/i, keywords: /cyclisme|tour de france|giro|vuelta|etape/i },
  { test: /\bufc\b|\bmma\b|boxe|boxing/i, keywords: /\bufc\b|\bmma\b|boxe|boxing/i },
  { test: /coupe du monde|world cup|euro/i, keywords: /coupe du monde|world cup|euro/i },
];

/** Abréviations ↔ noms complets (EPG FR abrège souvent). */
const TEAM_ALIASES: Record<string, string[]> = {
  psg: ["paris", "paris sg", "paris saint germain"],
  om: ["marseille"],
  ol: ["lyon"],
  asse: ["saint etienne", "saint-etienne"],
  losc: ["lille"],
  rcl: ["lens"],
  asm: ["monaco"],
  ogcn: ["nice"],
  srfc: ["rennes"],
  fcn: ["nantes"],
  tfc: ["toulouse"],
  mhsc: ["montpellier"],
  sb29: ["brest"],
  rcs: ["strasbourg"],
  fcm: ["metz"],
  sco: ["angers"],
  hac: ["le havre"],
  sdr: ["reims"],
  fcn2: [],
  barca: ["barcelone", "barcelona"],
  real: ["real madrid"],
  atleti: ["atletico", "atletico madrid"],
  city: ["manchester city", "man city"],
  united: ["manchester united", "man utd"],
  juve: ["juventus"],
  milan: ["ac milan"],
  inter: ["inter milan"],
  bayern: ["bayern munich", "bayern munchen"],
  bvb: ["dortmund", "borussia dortmund"],
  fenerbahce: ["fenerbahce istanbul", "fenerbahce sk"],
  slavia: ["slavia prague", "slavia praha"],
};

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/** Clés de recherche d'une équipe : tokens + alias (dans les deux sens). */
function teamKeys(name?: string): string[] {
  const keys = new Set<string>(tokens(name));
  const phrase = (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
  if (phrase) keys.add(phrase);
  for (const [abbr, aliases] of Object.entries(TEAM_ALIASES)) {
    const all = [abbr, ...aliases];
    if (all.some((alias) => {
      const normalized = alias
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/gu, "")
        .replace(/[^a-z0-9]+/gu, " ")
        .trim();
      return phrase === normalized || Boolean(phrase && containsWord(phrase, normalized));
    })) {
      all.forEach((a) => keys.add(a));
    }
  }
  return [...keys];
}

function containsWord(haystack: string, word: string): boolean {
  if (!word) return false;
  return new RegExp(`(^|[^a-z0-9])${escapeRe(word)}([^a-z0-9]|$)`, "u").test(haystack);
}

export interface EpgLikeEntry {
  title: string;
  start?: string | number;
  end?: string | number;
}

function toMs(value?: string | number): number | null {
  if (value == null) return null;
  const ms = typeof value === "number" ? value : Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function programMatchesCompetition(
  title: string,
  info: MatchChannelInfo,
): boolean {
  const haystack = `${info.league ?? ""} ${info.title ?? ""}`;
  return COMPETITION_KEYWORDS.some(
    (rule) => rule.test.test(haystack) && rule.keywords.test(title),
  );
}

/** Le titre désigne-t-il précisément ce match ? */
export function programMatchesMatch(
  title: string,
  info: MatchChannelInfo & { home?: string; away?: string },
): boolean {
  if (!title) return false;
  const normalized = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu, "");

  // Les émissions d'avant/après-match ne confirment pas la diffusion du match.
  if (/plateau|avant[- ]?match|apr[eè]s[- ]?match|d[eé]brief|magazine/iu.test(normalized)) {
    return false;
  }

  // Si les deux équipes sont connues, les deux doivent apparaître. Un titre
  // « Ligue des Champions » seul ne permet pas de distinguer le match du rugby
  // ou d'un autre match diffusé au même moment sur une chaîne homonyme.
  const homeKeys = teamKeys(info.home);
  const awayKeys = teamKeys(info.away);
  const homeHit = homeKeys.some((key) => containsWord(normalized, key));
  const awayHit = awayKeys.some((key) => containsWord(normalized, key));
  if (homeKeys.length > 0 && awayKeys.length > 0) return homeHit && awayHit;
  if (homeKeys.length > 0 || awayKeys.length > 0) return homeHit || awayHit;

  // Si on n'a pas les noms des équipes, la compétition reste un signal utile.
  return programMatchesCompetition(title, info);
}

function epgEntryAtMatchTime(entry: EpgLikeEntry, matchStartMs?: number): boolean {
  // Fenêtre : le programme doit couvrir le coup d'envoi (± 30 min de tolérance).
  if (matchStartMs && entry.start != null && entry.end != null) {
    const s = toMs(entry.start);
    const e = toMs(entry.end);
    if (s != null && e != null) {
      const margin = 30 * 60_000;
      if (matchStartMs < s - margin || matchStartMs > e + margin) return false;
    }
  }
  return true;
}

function epgMatchesEntry(
  entry: EpgLikeEntry | undefined,
  info: MatchChannelInfo & { home?: string; away?: string },
  matchStartMs?: number,
): boolean {
  if (!entry?.title || !epgEntryAtMatchTime(entry, matchStartMs)) return false;

  return programMatchesMatch(entry.title, info);
}

/**
 * Chaînes candidates pour un match, avec vérification de l'EPG au coup d'envoi.
 * Les chaînes confirmées passent devant ; les autres restent proposées.
 */
export function rankChannelsForMatch(
  channels: OhaChannel[],
  info: MatchChannelInfo & { home?: string; away?: string },
  matchStartMs?: number,
  /** EPG externe (journée complète) : remplace le now/next d'oha quand disponible. */
  lookup?: (channel: OhaChannel) => EpgLikeEntry[],
): MatchChannelStatus[] {
  const preferred = pickMatchChannels(channels, info);
  const evaluate = (channel: OhaChannel): MatchChannelStatus | null => {
    const variants = channel.sourceVariants ?? [];
    const variantsWithSchedule = variants
      .map((variant) => ({
        variant,
        entries: [variant.epgNow, variant.epgNext].filter(
          (entry): entry is NonNullable<typeof entry> => Boolean(entry),
        ),
      }))
      .filter(({ entries }) => entries.length > 0);

    // Quand les doublons ont un EPG propre, ne pas réutiliser les autres
    // variantes comme fallback : l'une peut programmer du rugby à cette heure.
    if (variantsWithSchedule.length > 0) {
      const matching: { variant: (typeof variants)[number]; entry: EpgLikeEntry }[] = [];
      const competitionOnly: { variant: (typeof variants)[number]; entry: EpgLikeEntry }[] = [];
      for (const { variant, entries } of variantsWithSchedule) {
        const entry = entries.find((item) => epgMatchesEntry(item, info, matchStartMs));
        if (entry) matching.push({ variant, entry });
        else {
          const broadEntry = entries.find(
            (item) => epgEntryAtMatchTime(item, matchStartMs) && programMatchesCompetition(item.title, info),
          );
          if (broadEntry) competitionOnly.push({ variant, entry: broadEntry });
        }
      }
      // Un EPG qui annonce seulement la compétition donne une piste, pas une
      // confirmation : garder la chaîne visible sans la démarrer par défaut.
      if (matching.length === 0 && competitionOnly.length > 0) {
        const possible = competitionOnly[0];
        return {
          channel: {
            ...channel,
            id: possible.variant.id,
            altIds: undefined,
            epgNow: possible.variant.epgNow,
            epgNext: possible.variant.epgNext,
            sourceVariants: [possible.variant],
          },
          confirmed: false,
          matchedTitle: possible.entry.title,
        };
      }
      if (matching.length === 0) return null;

      const selected = matching[0];
      const matchingIds = matching.map(({ variant }) => variant.id);
      const altIds = matchingIds.filter((id) => id !== selected.variant.id);
      const selectedChannel: OhaChannel = {
        ...channel,
        id: selected.variant.id,
        altIds: altIds.length > 0 ? altIds : undefined,
        epgNow: selected.variant.epgNow,
        epgNext: selected.variant.epgNext,
        sourceVariants: matching.map(({ variant }) => variant),
      };
      return { channel: selectedChannel, confirmed: true, matchedTitle: selected.entry.title };
    }

    const external = lookup?.(channel) ?? [];
    const entries: EpgLikeEntry[] =
      external.length > 0 ? external : [channel.epgNow, channel.epgNext].filter((e): e is NonNullable<typeof e> => Boolean(e));
    for (const entry of entries) {
      if (epgMatchesEntry(entry, info, matchStartMs)) {
        return { channel, confirmed: true, matchedTitle: entry?.title };
      }
    }
    const competitionEntry = entries.find(
      (entry) => epgEntryAtMatchTime(entry, matchStartMs) && programMatchesCompetition(entry.title, info),
    );
    if (competitionEntry) {
      return { channel, confirmed: false, matchedTitle: competitionEntry.title };
    }
    // Un programme connu qui ne correspond pas au match est une vraie
    // exclusion, pas une simple absence d'information.
    if (entries.length > 0) return null;
    return { channel, confirmed: false };
  };

  const preferredIds = new Set(preferred.map((channel) => channel.id));
  const statuses = preferred
    .map(evaluate)
    .filter((status): status is MatchChannelStatus => Boolean(status));

  // Les droits TV servent de première piste, mais ne couvrent pas toujours
  // les matchs décalés ou les canaux événementiels. L'EPG peut alors faire
  // remonter une autre chaîne sport qui annonce réellement la rencontre.
  for (const channel of channels) {
    if (channel.category !== "sport" || preferredIds.has(channel.id)) continue;
    const status = evaluate(channel);
    if (status?.confirmed) statuses.push(status);
  }

  // Confirmées d'abord, puis dans l'ordre de préférence.
  return [...statuses].sort((a, b) => Number(b.confirmed) - Number(a.confirmed));
}

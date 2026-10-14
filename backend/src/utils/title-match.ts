/**
 * title-match — comparaison titre Mongo ↔ TMDB, en une seule implémentation
 * partagée par l'audit (`audit-tmdb-mismatch.ts`), le correcteur
 * (`realign-tmdb-links.ts`) et la jointure de lecture du provider mongodb.
 *
 * Le correcteur et l'audit doivent classer un document exactement comme le
 * filtre la lecture : si les deux divergent, on « corrige » des documents que
 * le lecteur continuait de servir correctement.
 */

export type TmdbMatchStatus = 'ok' | 'titre_tronque' | 'titre_different' | 'annee_different' | 'introuvable';

/** minuscules, sans accents, sans ligature, sans ponctuation, sans année isolée. */
export function normalizeTitle(str?: string | null): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // NFD ne décompose pas les ligatures : sans cette passe « Sœurs et demie »
    // devient « urs et demie », et la fiche ne ressemble plus à elle-même.
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleTokens(str?: string | null): Set<string> {
  return new Set(normalizeTitle(str).split(' ').filter((w) => w.length > 1));
}

/**
 * Recouvrement de Jaccard entre le titre Mongo et un candidat TMDB.
 * Les cartes des sites sources sont souvent tronquées (« … royaume du crâne
 * de ») : un fort recouvrement n'est donc pas une fausse jointure, c'est
 * l'ANNÉE qui départage deux homonymes.
 */
export function titleOverlap(docTitle: string, candidateTitles: Array<string | undefined>): number {
  const doc = titleTokens(docTitle);
  if (doc.size === 0) return 0;
  let best = 0;
  for (const candidate of candidateTitles) {
    const other = titleTokens(candidate || '');
    if (other.size === 0) continue;
    let inter = 0;
    for (const w of doc) if (other.has(w)) inter++;
    best = Math.max(best, inter / new Set([...doc, ...other]).size);
  }
  return best;
}

/** Deux titres identiques une fois normalisés : seule jointure sans ambiguïté. */
export function sameTitle(a?: string | null, b?: string | null): boolean {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  return !!x && !!y && x === y;
}

function words(str?: string | null): string[] {
  return normalizeTitle(str).split(' ').filter((w) => w.length > 1);
}

/**
 * Le document est-il une CARTE TRONQUÉE du titre TMDB ? La carte du site source
 * coupe la fin de la ligne (« … royaume du crâne de ») : les mots du document
 * forment alors une fenêtre CONTIGUË collée à une extrémité du titre complet, à
 * un article près. « Les dimanches » dans « Les beaux dimanches » ne l'est pas
 * — ce n'est pas une coupe, c'est une autre œuvre (un homonyme de plus), et le
 * traiter comme troncature laissait pointer une fiche de 1974.
 */
export function isTruncation(docTitle: string, candidateTitle: string): boolean {
  const a = words(docTitle);
  const b = words(candidateTitle);
  if (!a.length || !b.length) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  for (let i = 0; i + short.length <= long.length; i++) {
    const contiguous = short.every((w, k) => long[i + k] === w);
    if (contiguous && (i <= 1 || i + short.length >= long.length - 1)) return true;
  }
  return false;
}

/** Une des étiquettes TMDB est-elle une troncature du titre du document ? */
export function isTruncatedAgainst(docTitle: string, candidates: Array<string | undefined | null>): boolean {
  return candidates.some((c) => !!c && isTruncation(docTitle, c));
}

/**
 * Fraction des mots de `title` retrouvés dans `other`. Contrairement à Jaccard,
 * le surplus de `other` n'est pas puni : c'est la bonne mesure pour comparer un
 * titre à un nom de fichier (« greenland migration » vs
 * « greenland 2 migration truefrench 1080p web h264 supply.mkv »).
 */
export function titleCoverage(title: string, other: string): number {
  const a = titleTokens(title);
  const b = titleTokens(other);
  if (a.size === 0 || b.size === 0) return 0;
  let hit = 0;
  for (const w of a) if (b.has(w)) hit++;
  return hit / a.size;
}

/**
 * Le scraper garde le titre anglais du marché (« Blades Of The Guardians »)
 * alors que TMDB, interrogé en fr, répond « Le Sabre des gardiens » /
 * « 镖人：风起大漠 ». La jointure n'est pas fausse, le titre du document est juste
 * un alias. On le cherche donc dans `alternative_titles`, en containment parce
 * que les alias portent souvent un sous-titre.
 */
export function aliasMatches(docTitle: string, aliases: Array<string | undefined | null>): boolean {
  const want = normalizeTitle(docTitle);
  if (want.length < 3) return false;
  return aliases.some((raw) => {
    const alias = normalizeTitle(raw || '');
    if (!alias) return false;
    if (alias === want) return true;
    if (Math.min(alias.length, want.length) < 8) return false;
    return alias.includes(want) || want.includes(alias);
  });
}

/** L'année laissée dans le titre par le scraper : « Kraken (2000) », « Armageddon 2013 ». */
export function yearFromTitle(titre?: string | null): number | null {
  const m = /(?:\(|\s)((?:19|20)\d{2})(?:\)|\b)/.exec(titre || '');
  return m ? Number(m[1]) : null;
}

export function tmdbYear(data: any): number | null {
  const raw = data?.release_date || data?.first_air_date || '';
  const y = parseInt(String(raw).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/**
 * Le scraper colle la saison dans le titre de la fiche (« Le croque-mort -
 * Saison 1 ») alors que TMDB s'arrête à l'œuvre. Sans ce retranchement, chaque
 * saison d'une série bien jointée passe en anomalie.
 */
export function stripSeason(titre?: string | null): string {
  return (titre || '')
    .replace(/[ (][-)sS]*[sS]aison[ :]*\d+[)]?/g, ' ')
    .replace(/[-–:]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DocTitles {
  titre: string;
  year?: number | string | null;
}

export interface TmdbClassification {
  status: TmdbMatchStatus;
  tmdbTitle: string;
  tmdbYear: number | null;
  overlap: number;
}

/**
 * Classe la jointure d'un document avec la fiche TMDB qu'il prétend désigner.
 * `data` = réponse TMDB, ou null (404) / `{ __error }` si injoignable.
 */
export function classifyDocVsTmdb(doc: DocTitles, data: any): TmdbClassification {
  if (!data || data.__error) return { status: 'introuvable', tmdbTitle: '', tmdbYear: null, overlap: 0 };

  const title = data.title || data.name || '';
  const original = data.original_title || data.original_name || '';
  const year = tmdbYear(data);
  const wanted = stripSeason(doc.titre);
  const overlap = titleOverlap(wanted, [title, original]);
  const docYear = Number(doc.year);
  const refYear = Number.isFinite(docYear) ? docYear : yearFromTitle(doc.titre);

  const base = { tmdbTitle: title, tmdbYear: year, overlap };
  if (refYear && year && Math.abs(refYear - year) > 1) return { status: 'annee_different', ...base };
  // Les titres faits de chiffres (« 9-1-1 ») n'ont plus aucun mot de longueur > 1
  // après normalisation : l'égalité des chaînes fait foi, pas le recouvrement.
  if (sameTitle(wanted, title) || sameTitle(wanted, original)) return { status: 'ok', ...base };
  if (overlap < 0.35) return { status: 'titre_different', ...base };
  if (overlap < 0.95) {
    const truncated = isTruncatedAgainst(wanted, [title, original]);
    // Le mot-à-mot ne raconte pas une coupe : les deux noms se ressemblent sans
    // se contenir, donc ce sont deux œuvres distinctes.
    if (!truncated) return { status: 'titre_different', ...base };
    return { status: 'titre_tronque', ...base };
  }
  return { status: 'ok', ...base };
}

/**
 * realign-tmdb-links.ts — parcourt le catalogue et réaligne les fiches.
 *
 * Deux classes de défaut, mesurées par `audit-tmdb-mismatch.ts` mais jamais
 * corrigées (`link-movies-tmdb.ts` ne traite que les tmdbId ABSENTS) :
 *
 *  1. tmdbId qui désigne une autre œuvre que le titre stocké — « Blood » (2023)
 *     pointait sur Rambo (1982). La page du vrai film retombe alors sur un
 *     homonyme, ou sur rien.
 *  2. `lien` dont le nom de fichier n'est pas le film du document : le fichier
 *     stocké est un autre long-métrage.
 *
 * Ce qui N'EST pas un défaut, et que la première version signalait à tort :
 * un document intitulé de son titre de marché anglais (« Omniscient Reader: The
 * Prophecy ») dont TMDB ne parle qu'en français ou en hanzi. La jointure est
 * bonne, l'alias est juste dans `alternative_titles`. D'où l'étape alias avant
 * toute conclusion, et le nom de fichier comparé aux titres TMDB et non au seul
 * titre Mongo (« Mission Père Noël » = fichier « mission santa yoyo… »).
 *
 * Règle d'écriture, volontairement étroite : on ne re-pointe un tmdbId que sur
 * un candidat TMDB dont le titre (localisé ou original) est NORMALISÉMENT
 * IDENTIQUE au titre du document, candidat unique, id libre au catalogue, ET
 * avec une année au document — un titre exact ne départage pas deux homonymes
 * (« Les dimanches » est un film de 2011 et de 2025). Sinon on signale sans
 * toucher : réaligner à l'aveugle, c'est créer un nouveau mauvais lien.
 *
 * Usage :
 *   npx tsx src/modules/scraping/maintenance/realign-tmdb-links.ts           # dry-run (défaut)
 *   npx tsx ... --apply                                                      # écrit en base
 *   npx tsx ... --limit=500 --type=movie
 * Rapport : /tmp/realign-tmdb-links.json (hors du repo, survit à un git clean)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../../.env') });

import fs from 'fs';
import tmdbClient from '../../../config/tmdb';
import { connectDB } from '../../../config/db';
import Movie from '../../../models/Movie';
import Serie from '../../../models/Serie';
import {
  aliasMatches,
  classifyDocVsTmdb,
  normalizeTitle,
  stripSeason,
  titleCoverage,
  yearFromTitle,
} from '../../../utils/title-match';

const CONCURRENCY = 8;
const REPORT_PATH = '/tmp/realign-tmdb-links.json';
/** En dessous, le nom de fichier ne contient pas le film du document. */
const FILE_COVERAGE_MIN = 0.5;

type Kind = 'tmdb_wrong' | 'fichier_different' | 'realignable' | 'realigne' | 'conflit' | 'refuse_sans_annee';

interface Finding {
  _id: string;
  titre: string;
  year: number | null;
  tmdbId: number | null;
  kind: Kind;
  detail: string;
  newTmdbId?: number;
}

const counters = {
  scanned: 0,
  aligned: 0,
  viaAlias: 0,
  withoutTmdbId: 0,
  tmdb_wrong: 0,
  fichier_different: 0,
  realignable: 0,
  realigne: 0,
  conflit: 0,
  refuse_sans_annee: 0,
  fileConfirmedByTmdb: 0,
};

function docYear(doc: any): number | null {
  const y = Number(doc.year);
  return Number.isFinite(y) && y > 0 ? y : yearFromTitle(doc.titre);
}

/** Les noms sous lesquels l'œuvre existe côté TMDB. */
function tmdbNames(data: any): string[] {
  if (!data || data.__error) return [];
  return [data.title, data.name, data.original_title, data.original_name].filter(Boolean);
}

/** « Mission_Santa_Yoyo…_1080p_h264_slay3r.mkv » → « mission santa yoyo … h264 slay3r ». */
function fileTitle(lien?: string): string {
  if (!lien) return '';
  const base = decodeURIComponent(String(lien).split('?')[0].split('/').pop() || '');
  return base.replace(/\.(mp4|mkv|webm|m3u8)$/i, '').replace(/_/g, ' ');
}

/**
 * Les tags de release suintent dans le nom de fichier, et toujours APRÈS le
 * titre : on coupe au premier marqueur pour ne garder que le titre.
 */
const FILE_JUNK = /^(vf|vff|vf2|vfq|vow|vo|fr|eng|multi|truefr|truefrench|subfr|subfrench|subforced|vostfr|vost|french|francais|film|doc|docs|documentaire|short|episode|saison|s\d|e\d|s\d{1,2}e\d{1,2}|\d{1,2}x\d{1,2}|1080p|720p|480p|2160p|4k|uhd|hd|sd|ts|cam|scr|rip|workprint|web|webrip|webdl|dl|bluray|bdrip|dvdrip|hdrip|xvid|x26[456]|h26[456]|hevc|av1|e?ac3|ddp?5[1]?|dd|atmos|hdr10?\+?|hdr|sdr|10bit|8bit|dts[0-9]*|ma|audio|[0-9]+)$/i;

/** Le titre tel que le fichier l'écrit, ou '' si le nom n'est pas un titre. */
function fileNameTitle(lien: string): string {
  const raw = normalizeTitle(fileTitle(lien));
  const words: string[] = [];
  for (const w of raw.split(' ')) {
    if (FILE_JUNK.test(w)) break;
    words.push(w);
  }
  const title = words.join(' ').trim();
  // « g95imcuixyl8n », « u075rxpvtf6m » : le lien d'embed n'a pas de nom de
  // film, seulement le code du fichier chez l'hébergeur. Rien à confronter.
  const head = title.split(' ')[0] || '';
  if (head.length >= 10 && /[a-z]/.test(head) && /\d/.test(head)) return '';
  return title;
}

function linksToCheck(doc: any, type: 'movie' | 'tv'): string[] {
  // Les épisodes se nomment par code de saison (« S03E01 », « 2x01 »), pas par
  // le titre de l'œuvre : comparer ce nom à « Westworld » ne mesure rien.
  // Le contrôle du fichier ne s'applique donc qu'aux films.
  if (type !== 'movie') return [];
  const isFile = (u: string) => /\.(mp4|mkv|webm|m3u8)(\?|$)/i.test(u);
  return [doc.lienOriginal, doc.lien].filter((u: string) => u && isFile(u));
}

/**
 * Variantes sous lesquelles le document peut désigner le film : titre complet,
 * mais aussi sa tête avant un deux-points ou un tiret — « Kartavya : Le sens
 * du devoir » est rendu « kartavya multi vff 1080p… », et une comparaison sur le
 * titre entier échouerait sur les mots du sous-titre.
 */
function titleVariants(titre: string): string[] {
  const out = [titre];
  const head = titre.split(/[:—–-]|\((?:19|20)\d{2}\)/)[0].trim();
  if (head && head !== titre) out.push(head);
  return out;
}

/** Meilleur recouvrement entre un nom de fichier et l'un des titres connus. */
function bestCover(names: string[], file: string): number {
  let best = 0;
  for (const n of names) for (const v of titleVariants(n)) best = Math.max(best, titleCoverage(v, file));
  return best;
}

async function getTmdb(id: number, type: 'movie' | 'tv'): Promise<any | null> {
  try {
    const { data } = await tmdbClient.get(`/${type}/${id}`, { params: { language: 'fr' } });
    return data;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    return { __error: err?.message || 'tmdb_error' };
  }
}

/** Alias du film (« Omniscient Reader: The Prophecy » du titre coréen d'origine). */
async function getAliases(id: number, type: 'movie' | 'tv'): Promise<string[]> {
  try {
    const { data } = await tmdbClient.get(`/${type}/${id}/alternative_titles`);
    const list = type === 'movie' ? data?.titles : data?.results;
    return (list || []).map((t: any) => t?.title).filter(Boolean);
  } catch {
    return [];
  }
}

async function searchTmdb(titre: string, year: number | null, type: 'movie' | 'tv'): Promise<any[]> {
  try {
    const params: Record<string, any> = { query: titre, page: 1 };
    if (year) params[type === 'movie' ? 'year' : 'first_air_date_year'] = year;
    const { data } = await tmdbClient.get(`/search/${type}`, { params });
    return data.results || [];
  } catch {
    return [];
  }
}

/**
 * Candidat non ambigu : titre normalisé identique (localisé ou original) et,
 * si on connaît l'année du document, année TMDB à ±1.
 */
function pickExactCandidate(results: any[], titre: string, year: number | null): any | null {
  const want = normalizeTitle(titre);
  const hits = results.filter((r) => {
    const title = normalizeTitle(r.title || r.name || '');
    const original = normalizeTitle(r.original_title || r.original_name || '');
    if (title !== want && original !== want) return false;
    if (!year) return true;
    const candYear = Number(String(r.release_date || r.first_air_date || '').slice(0, 4));
    return !candYear || Math.abs(candYear - year) <= 1;
  });
  // Un seul candidat exact, sinon on ne sait pas lequel est le bon.
  return hits.length === 1 ? hits[0] : null;
}

/**
 * Le document prétend désigner `tmdbId`. Est-ce bien son œuvre ?
 * 'match' → jointure confirmée ; 'alias' → confirmée via un titre alternatif ;
 * 'different' → faux.
 */
async function judge(doc: any, data: any, type: 'movie' | 'tv', wanted: string): Promise<'match' | 'alias' | 'different'> {
  const status = classifyDocVsTmdb(doc, data).status;
  if (status === 'ok' || status === 'titre_tronque') return 'match';

  if (aliasMatches(wanted, await getAliases(doc.tmdbId, type))) return 'alias';

  // TMDB lui-même désigne cet id pour le titre du document : c'est notre
  // recouvrement de mots qui est myope, pas la jointure.
  const best = pickExactCandidate(await searchTmdb(wanted, docYear(doc), type), wanted, docYear(doc));
  return best && best.id === doc.tmdbId ? 'alias' : 'different';
}

async function realignCollection(model: any, type: 'movie' | 'tv', label: string, limit: number, apply: boolean) {
  const projection = type === 'movie' ? 'titre year tmdbId lien lienOriginal' : 'titre year tmdbId episodes.lien';
  const docs: any[] = await model.find({}).select(projection).sort({ updatedAt: -1 }).limit(limit).lean();

  console.log(`\n### ${label} — ${docs.length} documents parcours`);
  const findings: Finding[] = [];
  const queue = [...docs];

  const push = (f: Finding) => {
    findings.push(f);
    counters[f.kind]++;
  };

  const work = async () => {
    while (queue.length) {
      const doc: any = queue.shift();
      if (!doc) break;
      counters.scanned++;
      const year = docYear(doc);
      const wanted = stripSeason(doc.titre);
      const base = { _id: String(doc._id), titre: doc.titre, year, tmdbId: doc.tmdbId ?? null };

      if (!doc.tmdbId) {
        counters.withoutTmdbId++;
        continue; // link-movies-tmdb.ts rattache les ids manquants
      }

      const data = await getTmdb(doc.tmdbId, type);
      const verdict = await judge(doc, data, type, wanted);

      if (verdict === 'alias') counters.viaAlias++;
      else if (verdict === 'match') counters.aligned++;
      else if (!data || data.__error) {
        push({ ...base, kind: 'tmdb_wrong', detail: `tmdb ${doc.tmdbId} injoignable (${data?.__error || '404'})` });
      } else {
        const best = pickExactCandidate(await searchTmdb(doc.titre, year, type), doc.titre, year);
        const why = `${classifyDocVsTmdb(doc, data).status} vs tmdb ${doc.tmdbId} "${data.title || data.name}" (${String(data.release_date || data.first_air_date || '').slice(0, 4)})`;
        if (!best) {
          push({ ...base, kind: 'tmdb_wrong', detail: `${why} — aucun candidat TMDB strict` });
        } else if (!year) {
          // Un titre exact ne départage pas deux homonymes : « Les dimanches »
          // est un film de 2011 ET de 2025. Sans année sur le document, on
          // signale pour un humain, on n'écrit pas.
          push({ ...base, kind: 'refuse_sans_annee', newTmdbId: best.id, detail: `${why} — candidat unique ${best.id} "${best.title || best.name}" mais document sans année` });
        } else if (await model.exists({ tmdbId: best.id, _id: { $ne: doc._id } })) {
          push({ ...base, kind: 'conflit', newTmdbId: best.id, detail: `${why} — ${best.id} déjà porté par une autre fiche` });
        } else {
          const to = `${best.id} "${best.title || best.name}" (${String(best.release_date || best.first_air_date || '').slice(0, 4)})`;
          if (apply) {
            // Double garde : ne jamais écraser un id corrigé entre-temps par le scraper.
            const r = await model.updateOne({ _id: doc._id, tmdbId: doc.tmdbId }, { $set: { tmdbId: best.id } });
            if (r.modifiedCount > 0) {
              push({ ...base, kind: 'realigne', newTmdbId: best.id, detail: `${doc.tmdbId} → ${to}` });
              // Écho immédiat : un job tué avant la fin ne laisse aucun rapport
              // sur disque, et sans la liste ancien → nouveau il n'y a pas de
              // quoi annuler.
              console.log(`    [ÉCRITURE] "${doc.titre}" tmdbId ${doc.tmdbId} → ${best.id}`);
            } else {
              push({ ...base, kind: 'tmdb_wrong', detail: `${why} — écriture annulée (id changé en base)` });
            }
          } else {
            push({ ...base, kind: 'realignable', newTmdbId: best.id, detail: `${doc.tmdbId} → ${to}` });
          }
        }
      }

      // Nom de fichier. Le fichier porte le titre INTERNATIONAL, que TMDB ne
      // renvoie pas quand on l'interroge en français — et qu'il n'a pas
      // toujours dans ses alias. Quand les mots ne se recouvrent pas, on
      // demande donc à TMDB : si son index multilingue retombe sur le même id
      // pour le nom du fichier, c'est le bon film dans une autre langue.
      const variants = [doc.titre, wanted, ...tmdbNames(data)];
      for (const lien of linksToCheck(doc, type)) {
        const file = fileNameTitle(lien);
        if (!file) continue;
        if (bestCover(variants, file) >= FILE_COVERAGE_MIN) continue;
        if ((await searchTmdb(file, null, type)).some((r: any) => r.id === doc.tmdbId)) {
          counters.fileConfirmedByTmdb++;
          continue;
        }
        push({ ...base, kind: 'fichier_different', detail: `fichier="${file}" brut="${fileTitle(lien)}"` });
        break;
      }

      if (counters.scanned % 500 === 0) console.log(`  … ${counters.scanned} vérifiés`);
    }
  };

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, docs.length) }, work));

  console.log(
    `  conformes=${counters.aligned} (dont via alias=${counters.viaAlias}) | sans tmdbId=${counters.withoutTmdbId}` +
      ` | tmdb_wrong=${counters.tmdb_wrong} realignable=${counters.realignable} realigne=${counters.realigne}` +
      ` conflit=${counters.conflit} refusés_sans_année=${counters.refuse_sans_annee}` +
      ` | fichier_different=${counters.fichier_different} (dont fichiers confirmés par TMDB=${counters.fileConfirmedByTmdb})`
  );
  return findings;
}

async function main() {
  const argv = process.argv.join(' ');
  const apply = /--apply\b/.test(argv);
  const limit = Number(/--limit=(\d+)/.exec(argv)?.[1] || 100000);
  const only = /--type=(movie|serie)/.exec(argv)?.[1];

  console.log(`[Realign] mode=${apply ? 'ÉCRITURE' : 'dry-run (lecture seule)'} limit=${limit} type=${only || 'tous'}`);
  await connectDB();

  const report: Record<string, any> = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    counters,
  };

  if (!only || only === 'movie') report.films = await realignCollection(Movie, 'movie', 'FILMS', limit, apply);
  if (!only || only === 'serie') report.series = await realignCollection(Serie, 'tv', 'SÉRIES', limit, apply);

  report.counters = { ...counters };
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n[Realign] ${findingsTotal(report)} anomalies — détail dans ${REPORT_PATH}`);
  if (!apply) console.log('[Realign] Aucune écriture : relancer avec --apply.');
}

function findingsTotal(report: Record<string, any>): number {
  return [...(report.films || []), ...(report.series || [])].length;
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FATAL]', err?.message || err);
    process.exit(1);
  });

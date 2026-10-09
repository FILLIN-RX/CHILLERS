/**
 * audit-tmdb-mismatch.ts — AUDIT EN LECTURE SEULE.
 *
 * Aucune écriture en base : seulement des find()/countDocuments() Mongo et des
 * GET TMDB. But : mesurer combien de documents films/séries portent un tmdbId
 * qui ne correspond pas au titre/à l'année stockés — les homonymes scrapés
 * avant l'ajout de l'année, quand la clé d'upsert était le titre seul
 * (Movie.titre est `unique`, donc un second film du même nom n'a jamais créé
 * son document : « Film déjà traité »).
 *
 * Usage : npx tsx src/scripts/audit-tmdb-mismatch.ts [--limit=N] [--type=movie|serie]
 * Rapport : /tmp/audit-tmdb-mismatch.json (hors du repo, survit à un git clean)
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

import fs from 'fs';
import tmdbClient from '../config/tmdb';
import { connectDB } from '../config/db';
import Movie from '../models/Movie';
import Serie from '../models/Serie';

const CONCURRENCY = 8;
const REPORT_PATH = '/tmp/audit-tmdb-mismatch.json';

type Status = 'ok' | 'titre_tronque' | 'titre_different' | 'annee_different' | 'introuvable';

interface Row {
  _id: string;
  titre: string;
  docYear?: number | null;
  tmdbId: number;
  tmdbTitle?: string;
  tmdbYear?: number | null;
  status: Status;
}

/** minuscules, sans accents, sans ponctuation, sans année isolée. */
function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b(19|20)\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(str: string): Set<string> {
  return new Set(normalize(str).split(' ').filter((w) => w.length > 1));
}

/**
 * Recouvrement de Jaccard titre Mongo vs titre TMDB (localisé ou original).
 * Les cartes des sites sources sont souvent tronquées (« … royaume du crâne de ») :
 * un fort recouvrement n'est donc pas une fausse jointure. C'est l'ANNÉE qui
 * départage deux homonymes.
 */
function titleOverlap(docTitle: string, a: string, b: string): number {
  const doc = tokens(docTitle);
  if (doc.size === 0) return 0;
  let best = 0;
  for (const t of [a, b]) {
    const other = tokens(t || '');
    if (other.size === 0) continue;
    let inter = 0;
    for (const w of doc) if (other.has(w)) inter++;
    best = Math.max(best, inter / new Set([...doc, ...other]).size);
  }
  return best;
}

function tmdbYear(data: any): number | null {
  const raw = data?.release_date || data?.first_air_date || '';
  const y = parseInt(String(raw).slice(0, 4), 10);
  return Number.isFinite(y) ? y : null;
}

/** L'année laissée dans le titre par le scraper : « Kraken (2000) », « Armageddon 2013 ». */
function yearFromTitle(titre: string): number | null {
  const m = /(?:\(|\s)((?:19|20)\d{2})(?:\)|\b)/.exec(titre || '');
  return m ? Number(m[1]) : null;
}

async function fetchTmdb(id: number, type: 'movie' | 'tv'): Promise<any | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { data } = await tmdbClient.get(`/${type}/${id}`, { params: { language: 'fr' } });
      return data;
    } catch (err: any) {
      if (err?.response?.status === 404) return null;
      if (err?.response?.status === 429) {
        const wait = Number(err?.response?.headers?.['retry-after'] || 20) * 1000;
        await new Promise((r) => setTimeout(r, wait));
        continue;
      }
      if (attempt === 2) return { __error: err?.message || 'tmdb_error' };
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return { __error: 'tmdb_error' };
}

/** Consomme une file de docs avec N workers. */
async function runQueue<T>(items: T[], workers: number, fn: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(workers, items.length) }, async () => {
      while (cursor < items.length) {
        const idx = cursor++;
        await fn(items[idx]);
      }
    })
  );
}

function classify(doc: any, data: any): Row {
  const base = {
    _id: String(doc._id),
    titre: doc.titre,
    docYear: doc.year ?? null,
    tmdbId: doc.tmdbId,
  };

  if (!data || data.__error) return { ...base, status: 'introuvable' };

  const t = data.title || data.name || '';
  const o = data.original_title || data.original_name || '';
  const year = tmdbYear(data);
  const overlap = titleOverlap(doc.titre, t, o);
  const refYear = doc.year ? Number(doc.year) : yearFromTitle(doc.titre);

  const row = { ...base, tmdbTitle: t, tmdbYear: year };
  if (refYear && year && Math.abs(refYear - year) > 1) return { ...row, status: 'annee_different' };
  if (overlap < 0.35) return { ...row, status: 'titre_different' };
  if (overlap < 0.95) return { ...row, status: 'titre_tronque' };
  return { ...row, status: 'ok' };
}

async function auditCollection(model: any, tmdbType: 'movie' | 'tv', label: string, limit: number) {
  const total = await model.countDocuments({});
  const withId = await model.countDocuments({ tmdbId: { $exists: true, $gt: 0 } });
  console.log(`\n### ${label} — ${total} docs | ${withId} avec tmdbId | ${total - withId} sans tmdbId`);

  const docs: any[] = await model
    .find({ tmdbId: { $exists: true, $gt: 0 } })
    .select('titre year tmdbId')
    .sort({ tmdbId: 1 })
    .limit(limit)
    .lean();

  const rows: Row[] = [];
  let done = 0;
  await runQueue<any>(docs, CONCURRENCY, async (doc) => {
    rows.push(classify(doc, await fetchTmdb(doc.tmdbId, tmdbType)));
    done++;
    if (done % 200 === 0) console.log(`  … ${done}/${docs.length} vérifiés`);
  });

  const count = (s: Status) => rows.filter((r) => r.status === s).length;
  const byId = new Map<number, string[]>();
  for (const r of rows) byId.set(r.tmdbId, [...(byId.get(r.tmdbId) || []), r.titre]);
  const duplicates = [...byId.entries()].filter(([, titles]) => titles.length > 1);

  console.log(
    `  ok=${count('ok')} | titre_tronque=${count('titre_tronque')} | titre_different=${count('titre_different')}` +
      ` | annee_different=${count('annee_different')} | introuvable=${count('introuvable')}` +
      ` | tmdbId partagés=${duplicates.length}`
  );
  console.log(`  --- annee_different (le pire : le lien est un autre film) ---`);
  for (const r of rows.filter((x) => x.status === 'annee_different').slice(0, 20)) {
    console.log(`    mongo="${r.titre}"${r.docYear ? ` year=${r.docYear}` : ''} → tmdb ${r.tmdbId} "${r.tmdbTitle}" (${r.tmdbYear})`);
  }
  console.log(`  --- titre_different ---`);
  for (const r of rows.filter((x) => x.status === 'titre_different').slice(0, 20)) {
    console.log(`    mongo="${r.titre}" → tmdb ${r.tmdbId} "${r.tmdbTitle}" (${r.tmdbYear})`);
  }

  return {
    label,
    total,
    withId,
    withoutId: total - withId,
    audited: rows.length,
    counts: {
      ok: count('ok'),
      titre_tronque: count('titre_tronque'),
      titre_different: count('titre_different'),
      annee_different: count('annee_different'),
      introuvable: count('introuvable'),
      tmdbId_partages: duplicates.length,
    },
    suspects: rows.filter((r) => r.status === 'annee_different' || r.status === 'titre_different'),
  };
}

async function main() {
  const argv = process.argv.join(' ');
  const limit = Number(/--limit=(\d+)/.exec(argv)?.[1] || 100000);
  const only = /--type=(movie|serie)/.exec(argv)?.[1];

  await connectDB();

  const report: Record<string, any> = {
    generatedAt: new Date().toISOString(),
    note: 'audit en lecture seule — aucune écriture en base',
  };

  if (!only || only === 'movie') report.films = await auditCollection(Movie, 'movie', 'FILMS', limit);
  if (!only || only === 'serie') report.series = await auditCollection(Serie, 'tv', 'SÉRIES', limit);

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nRapport: ${REPORT_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[FATAL]', err?.message || err);
    process.exit(1);
  });

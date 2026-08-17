/**
 * keepalive-uqload.ts
 *
 * Tâche de maintenance mensuelle : parcourt toutes les vidéos (films ET
 * épisodes de séries) qui ont un lien Uqload dans la base de données et
 * effectue une requête HTTP HEAD sur chaque lien embed.
 *
 * But : Uqload supprime les fichiers après 90 jours sans activité.
 * En "visitant" régulièrement les liens, on remet le compteur à zéro
 * et les fichiers restent actifs indéfiniment.
 *
 * La tâche est intentionnellement lente (délai entre chaque requête)
 * pour ne pas surcharger les serveurs d'Uqload et éviter le ban IP.
 */

import mongoose from 'mongoose';
import { connectDB } from '../config/db';
import Movie from '../models/Movie';
import Serie from '../models/Serie';

// ── Config ────────────────────────────────────────────────────────────────────

/** Délai entre chaque ping (ms) — 2 secondes par défaut pour être poli */
const DELAY_MS = 2000;

/** Timeout par requête (ms) */
const REQUEST_TIMEOUT_MS = 15_000;

/** User-Agent navigateur pour passer les filtres de base */
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Ping un lien Uqload : envoie une requête GET légère pour simuler une vue.
 * Uqload génère des liens embed de la forme :
 *   https://uqload.is/embed-XXXX.html
 * ou des liens directs :
 *   https://uqload.is/XXXX.html
 *
 * On tente d'abord l'embed, puis le lien direct comme fallback.
 */
async function pingUqload(code: string, link?: string): Promise<'ok' | 'dead' | 'error'> {
  const urls: string[] = [];

  // Construire les URLs à tester
  if (link) urls.push(link);
  if (code) {
    urls.push(`https://uqload.is/embed-${code}.html`);
    urls.push(`https://uqload.is/${code}.html`);
  }

  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          'Referer': 'https://uqload.is/',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        },
      });

      clearTimeout(timer);

      if (res.status === 404 || res.status === 410) return 'dead';
      if (res.ok || res.status === 302 || res.status === 301) return 'ok';

    } catch (err: any) {
      if (err?.name === 'AbortError') {
        console.warn(`  [KeepAlive] Timeout pour ${url}`);
        return 'error';
      }
      // On continue avec l'URL suivante si celle-ci échoue
    }
  }

  return 'error';
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('[KeepAlive] ══════════════════════════════════════════');
  console.log('[KeepAlive] Démarrage du Keep-Alive Uqload');
  console.log(`[KeepAlive] Heure : ${new Date().toISOString()}`);
  console.log('[KeepAlive] ══════════════════════════════════════════');

  await connectDB();

  let pinged = 0;
  let ok = 0;
  let dead = 0;
  let errors = 0;

  // ── 1. Films ─────────────────────────────────────────────────────────────

  console.log('\n[KeepAlive] --- Traitement des FILMS ---');
  const movies = await Movie.find({
    $or: [{ uqloadCode: { $exists: true, $ne: '' } }, { uqloadLink: { $exists: true, $ne: '' } }],
  }).select('titre uqloadCode uqloadLink').lean();

  console.log(`[KeepAlive] ${movies.length} film(s) avec un lien Uqload trouvés.`);

  for (const movie of movies) {
    process.stdout.write(`  → ${movie.titre} … `);
    const result = await pingUqload(movie.uqloadCode || '', movie.uqloadLink);
    pinged++;
    if (result === 'ok') { ok++; console.log('✅ OK'); }
    else if (result === 'dead') { dead++; console.log('💀 MORT (à réuploader)'); }
    else { errors++; console.log('⚠️  Erreur réseau'); }
    await sleep(DELAY_MS);
  }

  // ── 2. Séries / Épisodes ─────────────────────────────────────────────────

  console.log('\n[KeepAlive] --- Traitement des SÉRIES ---');
  const series = await Serie.find({
    'episodes.uqloadCode': { $exists: true, $ne: '' },
  }).select('titre episodes').lean();

  console.log(`[KeepAlive] ${series.length} série(s) avec des épisodes Uqload trouvées.`);

  for (const serie of series) {
    const uqEpisodes = serie.episodes.filter((e) => e.uqloadCode || e.uqloadLink);
    if (!uqEpisodes.length) continue;

    console.log(`  📺 ${serie.titre} — ${uqEpisodes.length} épisode(s) à pinger`);

    for (const ep of uqEpisodes) {
      process.stdout.write(
        `    S${String(ep.season).padStart(2, '0')}E${String(ep.episodeNumber).padStart(2, '0')} … `
      );
      const result = await pingUqload(ep.uqloadCode || '', ep.uqloadLink);
      pinged++;
      if (result === 'ok') { ok++; console.log('✅'); }
      else if (result === 'dead') { dead++; console.log('💀 MORT'); }
      else { errors++; console.log('⚠️ Erreur'); }
      await sleep(DELAY_MS);
    }
  }

  // ── Rapport final ─────────────────────────────────────────────────────────

  console.log('\n[KeepAlive] ══════════════════════════════════════════');
  console.log('[KeepAlive] RAPPORT FINAL');
  console.log(`[KeepAlive]   Total pingés  : ${pinged}`);
  console.log(`[KeepAlive]   ✅ Actifs      : ${ok}`);
  console.log(`[KeepAlive]   💀 Morts       : ${dead}`);
  console.log(`[KeepAlive]   ⚠️  Erreurs     : ${errors}`);
  console.log(`[KeepAlive] Terminé à : ${new Date().toISOString()}`);
  console.log('[KeepAlive] ══════════════════════════════════════════');

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error('[KeepAlive] Erreur fatale :', err);
  process.exit(1);
});

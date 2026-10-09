/**
 * source-year.js — récupération de l'année d'une entrée scrapée.
 *
 * Les cartes du site source n'affichent pas l'année (« 1978 », « X-Men '97 - Saison 2 »,
 * pageUrl = ?watch_fs=15126560) : le titre seul ne permet donc pas de départager
 * deux homonymes, qui plus est quand `titre` est l'index unique de la collection.
 * L'année est en revanche exposée par l'API interne de la source (/api/fs-watch),
 * indexed sur l'ID de la page — c'est elle qui permet de dire si « Kraken »
 * scrapé est celui de 2000 ou de 2023.
 *
 * Écrit en CommonJS (.js) parce que scrape-films.js est lancé par `node` sans tsx
 * (cron-manager.resolveScript), et consommé en import par les scrapers .ts.
 */

const axios = require('axios');

const BASE_URL = 'https://www.open-otaku.me';

function maxPlausibleYear() {
  return new Date().getFullYear() + 3;
}

function valid(year) {
  const y = Number(year);
  return Number.isFinite(y) && y >= 1900 && y <= maxPlausibleYear() ? y : null;
}

/**
 * Année dans un titre, seulement quand elle est clairement une mention
 * métadonnée : « Kraken (2000) », « Paris - 2008 ». Un titre qui EST une année
 * (« 1978 », « L'Année 1984 ») n'en est pas une.
 */
function yearFromTitle(title) {
  if (!title) return null;
  const paren = (String(title).match(/[([]\s*((?:19|20)\d{2})\s*[)\]]/) || [])[1];
  if (paren) return valid(paren);
  const suff = (String(title).match(/\s[-–—:]\s*((?:19|20)\d{2})\s*$/) || [])[1];
  return suff ? valid(suff) : null;
}

/** Année dans le slug de la page (« /film/kraken-2000/ »), jamais dans un ID. */
function yearFromUrl(url) {
  if (!url) return null;
  const clean = String(url).split('?')[0].replace(/\/+$/, '');
  const last = clean.split('/').pop() || '';
  const m = last.match(/(?:^|[-_.\s])((?:19|20)\d{2})(?=$|[-_.\s])/);
  return m ? valid(m[1]) : null;
}

/** ID de page open-otaku : ?watch_fs=15126560, sinon tout param numérique de l'URL. */
function pageId(url) {
  if (!url) return null;
  // Les premiers IDs du site sont courts (« ?watch_fs=245 ») : pas de borne basse
  // ici, contrairement à yearFromUrl où un nombre isolé est justement une année.
  const watch = (String(url).match(/watch_fs=(\d+)/) || [])[1];
  if (watch) return watch;
  const param = (String(url).match(/[?&]id=(\d+)/) || [])[1];
  if (param) return param;
  const tail = String(url).replace(/\/+$/, '').split('/').pop() || '';
  const digits = tail.match(/^\d+$/) ? tail : null;
  return digits;
}

/**
 * Année officielle telle que la source la déclare. Retourne null sans lever :
 * le scraping ne doit jamais échouer pour ça.
 */
async function fetchSourceYear(pageUrl, { timeout = 8000 } = {}) {
  const id = pageId(pageUrl);
  if (!id) return null;
  try {
    const { data } = await axios.get(`${BASE_URL}/api/fs-watch`, {
      params: { id },
      timeout,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    return valid(data?.meta?.year);
  } catch (err) {
    console.warn(`[SourceYear] /api/fs-watch id=${id} injoignable: ${err?.message || err}`);
    return null;
  }
}

/** Titre + URL + API source, dans cet ordre de confiance. */
async function resolveYear(title, pageUrl) {
  return yearFromTitle(title) || (await fetchSourceYear(pageUrl)) || yearFromUrl(pageUrl);
}

module.exports = { yearFromTitle, yearFromUrl, pageId, fetchSourceYear, resolveYear };

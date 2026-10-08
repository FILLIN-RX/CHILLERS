/**
 * torrents.utils.ts — fonctions pures du module torrents.
 *
 * Séparées des services pour être testables en isolation (jest) :
 * scoring des résultats Prowlarr, choix du fichier vidéo dans un
 * torrent, construction des requêtes de recherche.
 */

export interface TorrentCandidate {
  title: string;
  indexer: string;
  size: number; // octets
  seeders: number;
  magnet?: string;
  downloadUrl?: string;
  infoHash?: string;
}

export interface TorrentFile {
  id: number;
  path: string;
  length: number;
}

export const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v'];

/** Message d'erreur sûr depuis un throw inconnu (catch). */
export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

const GOOD_INDEXERS_RE = /(yts|eztv|1337x|galaxytv|nyaa|rarbg|therarbg|kickass|torrent9|ygg)/i;
const BAD_QUALITY_RE = /(\bcam\b|\bts\b|screener|hdtc|hdts|telesync|telecine|subbed\s*telesync)/i;
const QUALITY_RE = {
  '2160p': 10,
  '4k': 10,
  '1080p': 30,
  '720p': 20,
};

/**
 * Score un résultat torrent : plus c'est haut, meilleur c'est.
 * - Seeders en échelle sous-linéaire (plafonné à 100 pts)
 * - Taille idéale 0.7–4 Go (720p/1080p) : 50 pts
 * - Qualité explicite dans le titre (720p/1080p/4K)
 * - Indexeurs réputés +20
 * - Pénalité lourde pour les qualités pourries (CAM/TS/SCREENER)
 */
export function scoreTorrent(item: TorrentCandidate): number {
  const sizeGB = item.size > 0 ? item.size / 1024 ** 3 : 0;
  const seeds = Math.max(0, item.seeders || 0);
  let score = 0;

  score += Math.min(seeds, 500) * 0.2;

  if (sizeGB >= 0.7 && sizeGB <= 4) {
    score += 50;
  } else if (sizeGB > 0 && sizeGB < 0.7) {
    score += 15;
  } else if (sizeGB > 4 && sizeGB <= 8) {
    score += 20;
  }

  const title = (item.title || '').toLowerCase();
  if (BAD_QUALITY_RE.test(title)) score -= 100;

  for (const [re, pts] of Object.entries(QUALITY_RE)) {
    if (new RegExp(`\\b${re}\\b`).test(title)) score += pts;
  }
  if (/\b(bluray|web-?dl|webrip|hdtv)\b/.test(title)) score += 15;

  if (GOOD_INDEXERS_RE.test(item.indexer || '')) score += 20;

  return score;
}

export function sortTorrents(items: TorrentCandidate[]): TorrentCandidate[] {
  return [...items].sort((a, b) => scoreTorrent(b) - scoreTorrent(a));
}

/**
 * Marque de saison dans un nom de release : « S01E05 », « 1x05 », « S01 »
 * (pack de saison) ou « Saison 1 ». Un film homonyme n'en porte jamais.
 */
export function isEpisodeRelease(title: string, season: number, episode?: number): boolean {
  const ss = String(season).padStart(2, '0');
  const patterns = [
    episode != null
      ? new RegExp(`\\bs\\s*${ss}\\s*e\\s*${String(episode).padStart(2, '0')}`, 'i')
      : null,
    episode != null ? new RegExp(`\\b${season}\\s*x\\s*${String(episode).padStart(2, '0')}`, 'i') : null,
    // Pack de saison : « S01E07 » vaut saison 1, donc pas de \b après les chiffres.
    new RegExp(`\\bs\\s*${ss}(?![0-9])`, 'i'),
    new RegExp(`\\bsaison\\s*${season}\\b`, 'i'),
  ].filter(Boolean) as RegExp[];

  return patterns.some((re) => re.test(title));
}

/**
 * Choisit le fichier vidéo principal d'un torrent :
 * - Si saison/épisode fournis → uniquement le fichier SxxExx / NxN correspondant.
 *   Sans correspondance, on renvoie null : le torrent est très probablement un
 *   film homonyme (le search retombe sur la requête « Titre » seul), et servir
 *   « le plus gros fichier » reviendrait à lire un film à la place de l'épisode.
 * - Sinon → le plus gros fichier vidéo.
 */
export function pickVideoFile(
  files: TorrentFile[],
  season?: number,
  episode?: number
): { index: number; filename: string; length: number } | null {
  const videos = files.filter((f) =>
    VIDEO_EXTENSIONS.some((ext) => f.path.toLowerCase().endsWith(ext))
  );
  if (videos.length === 0) return null;

  const cleanName = (p: string) => p.split('/').pop()?.split('\\').pop() || p;

  if (season != null && episode != null) {
    const ss = String(season).padStart(2, '0');
    const es = String(episode).padStart(2, '0');
    const pattern = new RegExp(`s\\s*${ss}\\s*e\\s*${es}`, 'i');
    const patternAlt = new RegExp(`\\b${season}\\s*x\\s*${episode}\\b`, 'i');
    const matches = videos.filter((f) => pattern.test(f.path) || patternAlt.test(f.path));
    if (matches.length > 0) {
      const main = [...matches].sort((a, b) => b.length - a.length)[0];
      return { index: main.id, filename: cleanName(main.path), length: main.length };
    }
    console.warn(
      `[Torrents] Aucun fichier S${ss}E${es} dans ce torrent (${videos.length} vidéo(s)) — film homonyme ?`
    );
    return null;
  }

  const best = [...videos].sort((a, b) => b.length - a.length)[0];
  return { index: best.id, filename: cleanName(best.path), length: best.length };
}

/**
 * Construit les requêtes Prowlarr par ordre de spécificité :
 * - Séries : "Titre S01E02" d'abord
 * - Puis "Titre (Année)", "Titre Année", enfin "Titre" seul
 */
export function buildSearchQueries(opts: {
  title: string;
  year?: number;
  season?: number;
  episode?: number;
}): string[] {
  const queries: string[] = [];

  if (opts.season != null && opts.episode != null) {
    const ss = String(opts.season).padStart(2, '0');
    queries.push(`${opts.title} S${ss}E${String(opts.episode).padStart(2, '0')}`);
    // Pack de saison : beaucoup de séries ne sortent qu'en S01 complet.
    queries.push(`${opts.title} S${ss}`);
  }
  if (opts.year) queries.push(`${opts.title} (${opts.year})`);
  if (opts.year) queries.push(`${opts.title} ${opts.year}`);
  queries.push(opts.title);

  return [...new Set(queries)];
}

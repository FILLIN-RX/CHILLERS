/**
 * TorrServerProvider — fallback de dernier recours de la chaîne de streaming.
 *
 * Flux : recherche Prowlarr (score seeds/taille/qualité) → ajout du torrent
 * dans TorrServer → attente des métadonnées → choix du fichier vidéo
 * (SxxExx pour les épisodes) → préchargement P2P → URL de transcode.
 *
 * Positionné en DERNIER dans la chaîne : supports() renvoie toujours false
 * pour que ProviderManager le traite en fallback (les 4 providers classiques
 * ont toujours la priorité).
 */

import { StreamingProvider, StreamQuery, StreamResult } from './provider.interface';
import { isTorrentsConfigured } from '../torrents/config';
import { searchTorrents, resolveTorrentLink } from '../torrents/prowlarr.service';
import {
  addTorrent,
  waitForFileInfo,
  warmUpTorrent,
  buildStreamUrl,
} from '../torrents/torrents.service';
import { resolveTmdbYear } from '../torrents/utils/tmdb-helper';

/**
 * Budget interne du provider P2P. ProviderManager l'avorte à 60 s
 * (TORRENT_TIMEOUT) : on se cale en dessous pour qu'une recherche longue ne
 * consomme pas le temps des métadonnées, et qu'un échec reste lisible plutôt
 * qu'un AbortError en plein addTorrent.
 */
const TORRENT_BUDGET_MS = 50_000;

export class TorrServerProvider implements StreamingProvider {
  readonly name = 'torrserver';

  /** Toujours en fallback : le manager tente d'abord les providers supports()=true. */
  supports(): boolean {
    return false;
  }

  async getMovieStream(query: StreamQuery): Promise<StreamResult | null> {
    return this.prepareStream(query, 'movie');
  }

  async getEpisodeStream(query: StreamQuery): Promise<StreamResult | null> {
    return this.prepareStream(query, 'episode');
  }

  private async prepareStream(
    query: StreamQuery,
    type: 'movie' | 'episode'
  ): Promise<StreamResult | null> {
    if (!query.title || !isTorrentsConfigured()) return null;

    const deadlineAt = Date.now() + TORRENT_BUDGET_MS;
    const year = await resolveTmdbYear(query);
    const label =
      type === 'movie'
        ? `"${query.title}"${year ? ` (${year})` : ''}`
        : `"${query.title}" S${query.season}E${query.episode}`;
    console.log(`[TorrServer] Recherche torrent pour ${label}`);

    const candidates = await searchTorrents(
      {
        title: query.title,
        year,
        season: type === 'episode' ? query.season : undefined,
        episode: type === 'episode' ? query.episode : undefined,
      },
      deadlineAt
    );

    if (candidates.length === 0) {
      console.log(`[TorrServer] Aucun torrent trouvé pour ${label}`);
      return null;
    }

    const best = candidates[0];
    const sizeGB = best.size > 0 ? (best.size / 1024 ** 3).toFixed(2) : '?';
    console.log(
      `[TorrServer] Meilleur choix: "${best.title}" | ${best.seeders} seeds/santé | ${sizeGB} GB | ${best.indexer}`
    );

    const source = await resolveTorrentLink(best);
    const hash = await addTorrent(source, best.title, deadlineAt);

    console.log(`[TorrServer] Hash ${hash} — attente des métadonnées...`);
    const fileInfo = await waitForFileInfo(
      hash,
      {
        season: type === 'episode' ? query.season : undefined,
        episode: type === 'episode' ? query.episode : undefined,
      },
      deadlineAt
    );

    if (!fileInfo) {
      // Absent de ce provider (métadonnées introuvables / fichier manquant) :
      // 'skip' plutôt qu'une exception, qui ouvrirait le circuit breaker sur
      // un simple contenu indisponible.
      console.log(`[TorrServer] Aucun fichier vidéo lisible pour ${label} → skip`);
      return null;
    }

    console.log(
      `[TorrServer] Fichier principal: "${fileInfo.filename}" (${(fileInfo.length / 1024 ** 3).toFixed(2)} GB)`
    );
    await warmUpTorrent(hash, fileInfo.index, deadlineAt);

    return {
      provider: this.name,
      embedUrl: buildStreamUrl(hash, fileInfo.index),
      type,
    };
  }
}

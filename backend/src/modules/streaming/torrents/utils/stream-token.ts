/**
 * Jeton des routes média du module torrents.
 *
 * `/api/torrents/stream?hash=…` alimente un <video> : impossible d'y mettre un
 * header Authorization. Sans jeton, n'importe quel visiteur pouvait faire tirer
 * un info_hash de son choix par notre TorrServer (relais P2P ouvert + un process
 * FFmpeg par requête). Le jeton est signé côté provider au moment où la chaîne
 * accepte le torrent, et porte le hash + l'index : il est inutile pour un autre
 * fichier et expire avec le cache du stream.
 */

import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chillers-super-secret-key-change-me';
const TTL = '6h';

export interface TorrentTarget {
  hash: string;
  index: number;
}

export function signTorrentToken({ hash, index }: TorrentTarget): string {
  return jwt.sign({ scope: 'torrent-stream', hash, index }, JWT_SECRET, { expiresIn: TTL });
}

export function verifyTorrentToken(token: string | undefined, target: TorrentTarget): boolean {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return (
      decoded.scope === 'torrent-stream' &&
      String(decoded.hash).toLowerCase() === target.hash.toLowerCase() &&
      Number(decoded.index) === target.index
    );
  } catch {
    return false;
  }
}

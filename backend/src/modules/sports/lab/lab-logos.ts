/**
 * Logos des diffuseurs : index local construit depuis les logos déjà présents
 * dans le snapshot iptv-org (`tvChannels`) — pas d'appel réseau, pas d'URL
 * devinée. À défaut de correspondance, le front affiche les initiales.
 */
import fs from 'fs';
import path from 'path';
import { BACKEND_ROOT } from '../../../config/data-paths';

interface LogoIndex {
  byName: Map<string, string>;
  byPrefix: Map<string, string>;
}

const normalize = (s: string) =>
  (s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // « beIN SPORTS 1 (1080p) [Geo-blocked] » → « bein sports 1 »
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

let index: LogoIndex | null = null;

function ensureIndex(): LogoIndex {
  if (index) return index;

  const byName = new Map<string, string>();
  const byPrefix = new Map<string, string>();
  index = { byName, byPrefix };

  try {
    const file = path.resolve(BACKEND_ROOT, '..', 'sports-channels-lab', 'data', 'report.json');
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const tv of raw?.tvChannels ?? []) {
      if (!tv?.logo || !tv?.name) continue;
      const key = normalize(tv.name);
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, tv.logo);
      // Le premier mot du nom suffit à désigner une famille (« bein sports »…).
      const head = key.split(' ').slice(0, 2).join(' ');
      if (head.length > 3 && !byPrefix.has(head)) byPrefix.set(head, tv.logo);
    }
  } catch {
    // Snapshot absent : on n'a simplement pas de logo.
  }

  return index;
}

/** Logo si le nom de chaîne correspond à un diffuseur connu du snapshot. */
export function findLogo(channelName?: string): string | undefined {
  if (!channelName) return undefined;
  const { byName, byPrefix } = ensureIndex();
  const key = normalize(channelName);
  if (!key) return undefined;

  return (
    byName.get(key) ||
    byName.get(key.replace(/\s+(hd|sd|fhd|uhd|4k)$/g, '')) ||
    byPrefix.get(key.split(' ').slice(0, 2).join(' '))
  );
}

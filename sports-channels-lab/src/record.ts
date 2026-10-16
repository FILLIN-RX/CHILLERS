/**
 * Stockage du lab : un JSONL append-merge par « lien de chaîne ».
 *
 * Clé = provider:sourceId:channelName:url. Un re-scan met à jour les champs
 * du fixture et repousse `lastSeen`, mais conserve `firstSeen` et le dernier
 * probe (rafraîchi par probe.ts, pas par scan). Écriture atomique (tmp+rename).
 */
import fs from 'node:fs';
import path from 'node:path';

export interface ProbeResult {
  at: string;
  httpStatus?: number;
  contentType?: string;
  playable: boolean;
  /** URL média directe extraite (si la réponse est une playlist m3u8). */
  directM3u8?: string;
  error?: string;
  /** Posé quand le lien répondait puis a cessé (re-probe). */
  deadAt?: string;
}

export interface ChannelRecord {
  key: string;
  provider: string;
  sourceId: string;
  home: string;
  away: string;
  league?: string;
  startTs?: number;
  status?: string;
  channelName: string;
  url: string;
  type: 'hls' | 'iframe';
  referer?: string;
  /** Champs additionnels de la source (ex. kora: ch, language, category, edge). */
  meta?: Record<string, string | number | boolean>;
  firstSeen: string;
  lastSeen: string;
  probe?: ProbeResult;
}

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const STORE = path.join(DATA_DIR, 'channels.jsonl');

export function makeKey(r: Pick<ChannelRecord, 'provider' | 'sourceId' | 'channelName' | 'url'>): string {
  return `${r.provider}:${r.sourceId}:${r.channelName}:${r.url}`;
}

export function dataFile(name: string): string {
  return path.join(DATA_DIR, name);
}

export function loadAll(): Map<string, ChannelRecord> {
  const map = new Map<string, ChannelRecord>();
  if (!fs.existsSync(STORE)) return map;
  for (const line of fs.readFileSync(STORE, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const rec = JSON.parse(line) as ChannelRecord;
      if (rec && rec.key) map.set(rec.key, rec);
    } catch {
      // ligne corrompue : ignorée
    }
  }
  return map;
}

export function saveAll(map: Map<string, ChannelRecord>): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const body = Array.from(map.values())
    .map((r) => JSON.stringify(r))
    .join('\n');
  const tmp = `${STORE}.tmp`;
  fs.writeFileSync(tmp, body ? `${body}\n` : '');
  fs.renameSync(tmp, STORE);
}

export function mergeAndSave(
  incoming: ChannelRecord[]
): { created: number; updated: number; total: number } {
  const map = loadAll();
  let created = 0;
  let updated = 0;
  for (const rec of incoming) {
    const prev = map.get(rec.key);
    if (prev) {
      updated += 1;
      map.set(rec.key, { ...rec, firstSeen: prev.firstSeen, probe: prev.probe });
    } else {
      created += 1;
      map.set(rec.key, rec);
    }
  }
  saveAll(map);
  return { created, updated, total: map.size };
}

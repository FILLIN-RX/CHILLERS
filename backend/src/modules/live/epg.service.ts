import { gunzipSync } from 'node:zlib';
import { getEpgChannelModel } from './epg.model';
import { getOhaCatalogChannelModel } from './oha-catalog.model';
import { getLiveChannelModel } from './live.db';
import { discoverOhaChannels } from './utils/oha-catalog-source';
import { ohaNormalizeKey } from './utils/oha-channel-list';
import { buildEpgMapping, type EpgMappingInput } from './utils/epg-map';
import { parseXmltv, type XmltvProgram } from './utils/xmltv';

const EPG_URL =
  process.env.EPG_FR_URL ??
  'https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

/** Au-delà, le now/next OHA n'est plus assez frais pour être affiché. */
const OHA_EPG_MAX_AGE_MS = 90 * 60_000;
const EXTERNAL_EPG_MAX_AGE_MS = 48 * 60 * 60_000;
const EPG_HISTORY_MS = 36 * 60 * 60_000;
const EPG_HORIZON_MS = 6 * 24 * 60 * 60_000;

interface OhaEpgEntry {
  title: string;
  start: string;
  end: string;
}

interface OhaGuideDoc {
  channelKey: string;
  id: string;
  altIds?: string[];
  name: string;
  category: string;
  tvg?: string;
  logo?: string | null;
  epgNow?: OhaEpgEntry | null;
  epgNext?: OhaEpgEntry | null;
  epgUpdatedAt?: Date | string | null;
}

interface StoredProgram {
  title: string;
  subTitle?: string;
  description?: string;
  category?: string;
  icon?: string;
  episode?: string;
  start: Date;
  end: Date;
}

interface StoredEpgDoc {
  channelKey: string;
  sourceId: string;
  fetchedAt: Date | string;
  programs: StoredProgram[];
}

export interface EpgProgram {
  title: string;
  subTitle?: string;
  description?: string;
  category?: string;
  icon?: string;
  episode?: string;
  start: string;
  end: string;
  source: 'epgshare' | 'oha';
}

export interface EpgGuideChannel {
  channelKey: string;
  id: string;
  altIds: string[];
  name: string;
  slug: string;
  logo: string | null;
  category: string;
  tvg?: string;
  programs: EpgProgram[];
  now?: EpgProgram;
  next?: EpgProgram;
  source: 'epgshare' | 'oha' | 'mixed' | 'none';
  updatedAt?: string;
  stale: boolean;
  hasFullGuide: boolean;
}

export interface EpgGuide {
  from: string;
  to: string;
  generatedAt: string;
  channels: EpgGuideChannel[];
  coverage: {
    total: number;
    withNow: number;
    withFullGuide: number;
    epgshare: number;
    oha: number;
    none: number;
  };
}

function dateMs(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value));
  return Number.isFinite(ms) ? ms : null;
}

function toStoredProgram(program: XmltvProgram): StoredProgram {
  return {
    title: program.title,
    subTitle: program.subTitle,
    description: program.description,
    category: program.category,
    icon: program.icon,
    episode: program.episode,
    start: new Date(program.start),
    end: new Date(program.end),
  };
}

function ohaEntryToProgram(
  entry: OhaEpgEntry | null | undefined,
): EpgProgram | null {
  if (!entry?.title || !entry.start || !entry.end) return null;
  const start = dateMs(entry.start);
  const end = dateMs(entry.end);
  if (start == null || end == null || end <= start) return null;
  return {
    title: entry.title,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
    source: 'oha',
  };
}

function overlaps(program: { start: string; end: string }, from: number, to: number): boolean {
  return dateMs(program.start) != null &&
    dateMs(program.end) != null &&
    dateMs(program.end)! > from &&
    dateMs(program.start)! < to;
}

async function fetchExternalEpg() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);
  try {
    const res = await fetch(EPG_URL, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`EPGShare HTTP ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const isGzip = body[0] === 0x1f && body[1] === 0x8b;
    const xml = (isGzip ? gunzipSync(body) : body).toString('utf8');
    return parseXmltv(xml);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Importe la grille EPGShare01 FR1 et l'associe aux chaînes OHA actives.
 * Le XMLTV complet reste en mémoire le temps de l'import uniquement.
 */
export async function importExternalEpg() {
  const OhaChannel = await getOhaCatalogChannelModel();
  const channels = (await OhaChannel.find({ active: true })
    .select('channelKey name tvg')
    .lean()) as unknown as Array<{ channelKey: string; name: string; tvg?: string }>;

  if (channels.length === 0) {
    throw new Error('Aucune chaîne OHA active : import EPG annulé pour ne pas écraser la grille.');
  }

  const parsed = await fetchExternalEpg();
  const inputs: EpgMappingInput[] = channels.map((channel) => ({
    channelKey: channel.channelKey,
    name: channel.name,
    tvg: channel.tvg,
  }));
  const mapping = buildEpgMapping(inputs, parsed);

  if (mapping.mappings.size === 0) {
    throw new Error('Aucune chaîne EPGShare associée : import annulé pour conserver l’ancienne grille.');
  }

  const now = Date.now();
  const min = now - EPG_HISTORY_MS;
  const max = now + EPG_HORIZON_MS;
  const fetchedAt = new Date();
  const programByKey = new Map<string, StoredProgram[]>();
  const mappedKeys: string[] = [];

  for (const [channelKey, entry] of mapping.mappings) {
    const programs = (parsed.programs.get(entry.sourceId) ?? [])
      .filter((program) => program.end > min && program.start < max)
      .map(toStoredProgram);
    if (programs.length === 0) continue;
    programByKey.set(channelKey, programs);
    mappedKeys.push(channelKey);
  }

  if (programByKey.size === 0) {
    throw new Error('Aucun programme EPGShare dans la fenêtre attendue : import annulé.');
  }

  const EpgChannel = await getEpgChannelModel();
  const writes = [...programByKey.entries()].map(([channelKey, programs]) => {
    const input = inputs.find((channel) => channel.channelKey === channelKey)!;
    const association = mapping.mappings.get(channelKey)!;
    const expiresAt = new Date(Math.max(...programs.map((program) => program.end.getTime())));
    return {
      updateOne: {
        filter: { channelKey },
        update: {
          $set: {
            channelKey,
            channelName: input.name,
            tvg: input.tvg,
            source: 'epgshare',
            sourceId: association.sourceId,
            matchMethod: association.method,
            programs,
            fetchedAt,
            expiresAt,
          },
        },
        upsert: true,
      },
    };
  });

  await EpgChannel.bulkWrite(writes, { ordered: false });
  await EpgChannel.deleteMany({
    source: 'epgshare',
    channelKey: { $nin: mappedKeys },
  });

  const importedAt = Date.now();
  let withNow = 0;
  for (const programs of programByKey.values()) {
    if (programs.some((program) => program.start.getTime() <= importedAt && program.end.getTime() > importedAt)) {
      withNow += 1;
    }
  }

  return {
    parsedChannels: parsed.channels.size,
    parsedPrograms: parsed.programCount,
    activeChannels: channels.length,
    associated: mapping.mappings.size,
    imported: writes.length,
    withNow,
    unmatched: mapping.unmatched.map((channel) => channel.name),
    ambiguous: mapping.ambiguous.map((entry) => ({
      name: entry.channel.name,
      candidates: entry.candidates,
    })),
    fetchedAt: fetchedAt.toISOString(),
  };
}

/**
 * Rafraîchit le now/next OHA sans retélécharger la grille EPGShare01.
 * Appelé toutes les 15 minutes : l'EPG OHA ne bougeait jusqu'ici qu'au sync
 * complet quotidien.
 */
export async function refreshOhaEpg() {
  const channels = await discoverOhaChannels();
  if (channels.length === 0) {
    throw new Error('Le catalogue OHA n’a retourné aucune chaîne pour l’EPG.');
  }

  const checkedAt = new Date();
  const OhaChannel = await getOhaCatalogChannelModel();
  const LiveChannel = await getLiveChannelModel();
  const writes = channels.map((channel) => {
    const key = ohaNormalizeKey(channel.name.toUpperCase());
    return {
      updateOne: {
        filter: { channelKey: key },
        update: {
          $set: {
            epgNow: channel.epgNow ?? null,
            epgNext: channel.epgNext ?? null,
            epgUpdatedAt: checkedAt,
            epgSource: 'oha',
          },
        },
      },
    };
  });

  await OhaChannel.bulkWrite(writes, { ordered: false });

  const liveWrites = channels.map((channel) => {
    const key = ohaNormalizeKey(channel.name.toUpperCase());
    return {
      updateOne: {
        filter: { source: 'oha', slug: `oha-${key.toLowerCase()}` },
        update: {
          $set: {
            epgNow: channel.epgNow ?? null,
            epgNext: channel.epgNext ?? null,
            epgUpdatedAt: checkedAt,
            epgSource: 'oha',
          },
        },
      },
    };
  });

  await LiveChannel.bulkWrite(liveWrites, { ordered: false });

  return {
    checked: channels.length,
    withNow: channels.filter((channel) => Boolean(channel.epgNow)).length,
    updatedAt: checkedAt.toISOString(),
  };
}

const CATEGORY_ORDER = ['general', 'sport', 'cine', 'kids', 'musique'];

/** Grille complète ou fallback now/next, sur une fenêtre de dates donnée. */
export async function getEpgGuide(options: {
  from: number;
  to: number;
  channelIds?: string[];
}): Promise<EpgGuide> {
  const { from, to } = options;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
    throw new Error('Fenêtre EPG invalide.');
  }

  const OhaChannel = await getOhaCatalogChannelModel();
  const filter: Record<string, unknown> = { active: true };
  if (options.channelIds && options.channelIds.length > 0) {
    filter.id = { $in: options.channelIds };
  }

  const channels = (await OhaChannel.find(filter)
    .select('channelKey id altIds name category tvg logo epgNow epgNext epgUpdatedAt')
    .lean()) as unknown as OhaGuideDoc[];

  const EpgChannel = await getEpgChannelModel();
  const docs = (await EpgChannel.find({
    channelKey: { $in: channels.map((channel) => channel.channelKey) },
  }).lean()) as unknown as StoredEpgDoc[];
  const docsByKey = new Map(docs.map((doc) => [doc.channelKey, doc]));

  const nowMs = Date.now();
  const nowInWindow = nowMs >= from && nowMs < to;
  const result: EpgGuideChannel[] = channels.map((channel) => {
    const doc = docsByKey.get(channel.channelKey);
    const fetchedAtMs = doc ? dateMs(doc.fetchedAt) : null;
    const externalStale = fetchedAtMs != null &&
      nowMs - fetchedAtMs > EXTERNAL_EPG_MAX_AGE_MS;

    const external: EpgProgram[] = (doc?.programs ?? [])
      .filter((program) => {
        const start = dateMs(program.start);
        const end = dateMs(program.end);
        return start != null && end != null && end > from && start < to;
      })
      .map((program): EpgProgram => ({
        title: program.title,
        subTitle: program.subTitle,
        description: program.description,
        category: program.category,
        icon: program.icon,
        episode: program.episode,
        start: program.start.toISOString(),
        end: program.end.toISOString(),
        source: 'epgshare',
      }))
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

    const ohaUpdatedMs = dateMs(channel.epgUpdatedAt);
    const ohaFresh = ohaUpdatedMs != null && nowMs - ohaUpdatedMs <= OHA_EPG_MAX_AGE_MS;
    const ohaNow = ohaFresh ? ohaEntryToProgram(channel.epgNow) : null;
    const ohaNext = ohaFresh ? ohaEntryToProgram(channel.epgNext) : null;

    let now = nowInWindow
      ? external.find((program) => dateMs(program.start)! <= nowMs && dateMs(program.end)! > nowMs)
      : undefined;
    let next = external.find((program) => dateMs(program.start)! > nowMs);

    if (!now && nowInWindow && ohaNow && overlaps(ohaNow, from, to)) {
      now = ohaNow;
    }
    if (!next && ohaNext && overlaps(ohaNext, from, to)) {
      next = ohaNext;
    }

    let programs = external;
    if (programs.length === 0) {
      programs = [ohaNow, ohaNext]
        .filter((program): program is EpgProgram => Boolean(program))
        .filter((program) => overlaps(program, from, to));
    }

    const sources = new Set<string>();
    if (external.length > 0) sources.add('epgshare');
    if (now?.source === 'oha' || next?.source === 'oha') sources.add('oha');

    let source: EpgGuideChannel['source'] = 'none';
    if (sources.size === 2) source = 'mixed';
    else if (sources.has('epgshare')) source = 'epgshare';
    else if (sources.has('oha')) source = 'oha';

    const updatedAtMs = fetchedAtMs ?? ohaUpdatedMs;
    const stale = source === 'none'
      ? false
      : source === 'oha'
        ? !ohaFresh
        : externalStale;

    return {
      channelKey: channel.channelKey,
      id: channel.id,
      altIds: channel.altIds ?? [],
      name: channel.name,
      slug: `oha-${channel.channelKey.toLowerCase()}`,
      logo: channel.logo ?? null,
      category: channel.category,
      tvg: channel.tvg,
      programs,
      now,
      next,
      source,
      updatedAt: updatedAtMs != null ? new Date(updatedAtMs).toISOString() : undefined,
      stale,
      hasFullGuide: external.length > 0,
    };
  });

  result.sort((a, b) => {
    const category = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return category !== 0 ? category : a.name.localeCompare(b.name, 'fr');
  });

  return {
    from: new Date(from).toISOString(),
    to: new Date(to).toISOString(),
    generatedAt: new Date().toISOString(),
    channels: result,
    coverage: {
      total: result.length,
      withNow: result.filter((channel) => Boolean(channel.now)).length,
      withFullGuide: result.filter((channel) => channel.hasFullGuide).length,
      epgshare: result.filter((channel) => channel.source === 'epgshare' || channel.source === 'mixed').length,
      oha: result.filter((channel) => channel.source === 'oha').length,
      none: result.filter((channel) => channel.source === 'none').length,
    },
  };
}

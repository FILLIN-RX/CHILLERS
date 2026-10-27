import { getOhaCatalogChannelModel } from './oha-catalog.model';
import { getLiveChannelModel } from './live.db';
import { discoverOhaChannels } from './utils/oha-catalog-source';
import { OHA_ALLOWLIST, ohaBaseName, ohaNormalizeKey } from './utils/oha-channel-list';
import { resolveOhaChannelStream } from './utils/oha-stream-resolver';

interface OhaChannelLike {
  id: string;
  channelKey?: string;
  altIds?: string[];
  sourceVariants?: Array<{ id: string }>;
  name: string;
  category: string;
  tvg?: string;
  logo?: string | null;
  epgNow?: unknown;
  epgNext?: unknown;
}

interface ResolvedStream {
  id: string;
  url: string;
}

type ChannelKeyOf = (channel: OhaChannelLike) => string;

const defaultChannelKey: ChannelKeyOf = (channel) =>
  ohaNormalizeKey(channel.name.toUpperCase());

export async function listOhaCatalogChannels() {
  const OhaChannel = await getOhaCatalogChannelModel();
  return OhaChannel.find({ active: true })
    .select('-_id -__v -channelKey -active -lastSyncedAt -createdAt -updatedAt')
    .sort({ category: 1, name: 1 })
    .lean();
}

function toLiveCategories(category: string): string[] {
  switch (category) {
    case 'sport': return ['sports'];
    case 'cine': return ['entertainment'];
    case 'kids': return ['kids'];
    case 'musique': return ['music'];
    default: return ['general'];
  }
}

function channelIds(channel: OhaChannelLike): string[] {
  return channel.sourceVariants?.length
    ? channel.sourceVariants.map((source) => source.id)
    : [channel.id, ...(channel.altIds ?? [])];
}

/**
 * Résout les sources de toutes les chaînes en parallèle. Une chaîne n'est
 * retenue que si au moins un de ses flux répond réellement au probe.
 */
async function resolveChannelStreams(
  channels: OhaChannelLike[],
  keyOf: ChannelKeyOf = defaultChannelKey,
): Promise<Map<string, ResolvedStream>> {
  const resolvedByKey = new Map<string, ResolvedStream>();
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(8, channels.length) },
    async () => {
      while (nextIndex < channels.length) {
        const channel = channels[nextIndex++];
        const key = keyOf(channel);
        const stream = await resolveOhaChannelStream(channelIds(channel));
        if (stream) resolvedByKey.set(key, stream);
      }
    },
  );
  await Promise.all(workers);
  return resolvedByKey;
}

/**
 * Expose OHA as ordinary Live TV channels too, so every consumer of
 * /live/channels and the multi-screen player sees the same catalogue.
 * Seules les chaînes dont le flux répond sont activées.
 */
async function mirrorOhaChannelsToLive(
  channels: OhaChannelLike[],
  resolvedByKey: Map<string, ResolvedStream>,
  checkedAt: Date,
  keyOf: ChannelKeyOf = defaultChannelKey,
  syncEpg = false,
) {
  const LiveChannel = await getLiveChannelModel();
  const liveSlugs = channels.map((channel) => `oha-${keyOf(channel).toLowerCase()}`);

  const writes = channels.map((channel, index) => {
    const key = keyOf(channel);
    const stream = resolvedByKey.get(key);
    const slug = `oha-${key.toLowerCase()}`;
    return {
      updateOne: {
        filter: { slug },
        update: {
          $set: {
            name: channel.name,
            slug,
            logo: channel.logo ?? '',
            categories: toLiveCategories(channel.category),
            country: 'FR',
            language: 'fra',
            type: 'hls',
            streamUrl: stream?.url ?? '',
            streamResolvedAt: stream ? checkedAt : null,
            lastChecked: checkedAt,
            ohaId: channel.id,
            ohaAltIds: channel.altIds ?? [],
            ...(syncEpg ? {
              epgNow: channel.epgNow,
              epgNext: channel.epgNext,
              epgUpdatedAt: checkedAt,
              epgSource: 'oha',
            } : {}),
            enabled: Boolean(stream),
            order: 1000 + index,
            isOnline: Boolean(stream),
            source: 'oha',
          },
        },
        upsert: true,
      },
    };
  });

  if (writes.length > 0) {
    await LiveChannel.bulkWrite(writes, { ordered: false });
  }

  await LiveChannel.updateMany(
    { source: 'oha', slug: { $nin: liveSlugs } },
    {
      $set: {
        enabled: false,
        isOnline: false,
        streamUrl: '',
        streamResolvedAt: null,
      },
    },
  );
}

/** Rebuild and persist the full curated set used by the Live page. */
export async function syncOhaCatalogChannels() {
  const channels = await discoverOhaChannels();
  if (channels.length === 0) throw new Error('Le catalogue OHA n’a retourné aucune chaîne.');

  const syncedAt = new Date();
  const resolvedByKey = await resolveChannelStreams(channels);
  const currentKeys = channels.map(defaultChannelKey);
  const resolvedCount = channels.filter((channel) => resolvedByKey.has(defaultChannelKey(channel))).length;

  const OhaChannel = await getOhaCatalogChannelModel();
  const writes = channels.map((channel) => {
    const key = defaultChannelKey(channel);
    const stream = resolvedByKey.get(key);
    return {
      updateOne: {
        filter: { channelKey: key },
        update: {
          $set: {
            id: channel.id,
            altIds: channel.altIds ?? [],
            sourceVariants: channel.sourceVariants ?? [],
            name: channel.name,
            category: channel.category,
            tvg: channel.tvg,
            logo: channel.logo ?? null,
            epgNow: channel.epgNow,
            epgNext: channel.epgNext,
            epgUpdatedAt: syncedAt,
            epgSource: 'oha',
            streamUrl: stream?.url ?? '',
            streamSourceId: stream?.id ?? '',
            streamResolvedAt: stream ? syncedAt : null,
            lastVerifiedAt: syncedAt,
            active: Boolean(stream),
            lastSyncedAt: syncedAt,
          },
        },
        upsert: true,
      },
    };
  });

  await OhaChannel.bulkWrite(writes, { ordered: false });

  // Les entrées qui ont disparu du catalogue courant ne doivent plus être servies.
  await OhaChannel.updateMany(
    { channelKey: { $nin: currentKeys } },
    {
      $set: {
        active: false,
        streamUrl: '',
        streamSourceId: '',
        streamResolvedAt: null,
      },
    },
  );

  await mirrorOhaChannelsToLive(channels, resolvedByKey, syncedAt, defaultChannelKey, true);

  return {
    synced: channels.length,
    resolved: resolvedCount,
    deactivated: channels.length - resolvedCount,
    servedAsNormalChannels: resolvedCount,
    syncedAt: syncedAt.toISOString(),
  };
}

/**
 * Revalide uniquement les flux des chaînes déjà en base (sans retélécharger
 * le catalogue OHA). Utilisé par le cron horaire pour retirer rapidement les
 * chaînes mortes et réactiver celles qui répondent de nouveau.
 */
export async function revalidateOhaCatalogStreams() {
  const OhaChannel = await getOhaCatalogChannelModel();
  const allowedKeys = OHA_ALLOWLIST.map((entry) =>
    ohaNormalizeKey(ohaBaseName(entry.label)),
  );
  const channels = (await OhaChannel.find({
    channelKey: { $in: allowedKeys },
  }).lean()) as unknown as OhaChannelLike[];
  const checkedAt = new Date();

  // Une chaîne retirée de l'allowlist ne doit pas être réactivée par le cron.
  await OhaChannel.updateMany(
    { channelKey: { $nin: allowedKeys } },
    {
      $set: {
        active: false,
        streamUrl: '',
        streamSourceId: '',
        streamResolvedAt: null,
      },
    },
  );

  if (channels.length === 0) {
    // Ne touche pas aux chaînes live si le catalogue n'a simplement jamais été peuplé.
    if (await OhaChannel.exists({})) {
      await mirrorOhaChannelsToLive([], new Map(), checkedAt, defaultChannelKey, false);
    }
    return {
      checked: 0,
      resolved: 0,
      deactivated: 0,
      revalidatedAt: checkedAt.toISOString(),
    };
  }

  const keyOf: ChannelKeyOf = (channel) =>
    channel.channelKey || defaultChannelKey(channel);
  const resolvedByKey = await resolveChannelStreams(channels, keyOf);
  const resolvedCount = channels.filter((channel) => resolvedByKey.has(keyOf(channel))).length;

  const writes = channels.map((channel) => {
    const key = keyOf(channel);
    const stream = resolvedByKey.get(key);
    return {
      updateOne: {
        filter: { channelKey: key },
        update: {
          $set: {
            streamUrl: stream?.url ?? '',
            streamSourceId: stream?.id ?? '',
            streamResolvedAt: stream ? checkedAt : null,
            lastVerifiedAt: checkedAt,
            active: Boolean(stream),
          },
        },
      },
    };
  });

  await OhaChannel.bulkWrite(writes, { ordered: false });
  await mirrorOhaChannelsToLive(channels, resolvedByKey, checkedAt, keyOf, false);

  return {
    checked: channels.length,
    resolved: resolvedCount,
    deactivated: channels.length - resolvedCount,
    revalidatedAt: checkedAt.toISOString(),
  };
}

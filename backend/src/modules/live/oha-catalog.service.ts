import { getOhaCatalogChannelModel } from './oha-catalog.model';
import { discoverOhaChannels } from './utils/oha-catalog-source';
import { ohaNormalizeKey } from './utils/oha-channel-list';
import { resolveOhaChannelStream } from './utils/oha-stream-resolver';

export async function listOhaCatalogChannels() {
  const OhaChannel = await getOhaCatalogChannelModel();
  return OhaChannel.find({ active: true })
    .select('-_id -__v -channelKey -active -lastSyncedAt -createdAt -updatedAt')
    .sort({ category: 1, name: 1 })
    .lean();
}

/** Rebuild and persist the full curated set used by the Live page. */
export async function syncOhaCatalogChannels() {
  const channels = await discoverOhaChannels();
  if (channels.length === 0) throw new Error('Le catalogue OHA n’a retourné aucune chaîne.');

  const OhaChannel = await getOhaCatalogChannelModel();
  const syncedAt = new Date();
  let nextIndex = 0;
  let resolvedCount = 0;
  const resolvedByKey = new Map<string, { id: string; url: string }>();
  const workers = Array.from({ length: Math.min(6, channels.length) }, async () => {
    while (nextIndex < channels.length) {
      const channel = channels[nextIndex++];
      const key = ohaNormalizeKey(channel.name.toUpperCase());
      const ids = channel.sourceVariants?.map((source) => source.id) ?? [channel.id, ...(channel.altIds ?? [])];
      const stream = await resolveOhaChannelStream(ids);
      if (stream) {
        resolvedByKey.set(key, stream);
        resolvedCount++;
      }
    }
  });
  await Promise.all(workers);

  const writes = channels.map((channel) => {
    const channelKey = ohaNormalizeKey(channel.name.toUpperCase());
    const stream = resolvedByKey.get(channelKey);
    return {
    updateOne: {
      filter: { channelKey },
      update: {
        $set: {
          ...channel,
          ...(stream ? { streamUrl: stream.url, streamSourceId: stream.id, streamResolvedAt: syncedAt } : {}),
          active: true,
          lastSyncedAt: syncedAt,
        },
      },
      upsert: true,
    },
    };
  });

  await OhaChannel.bulkWrite(writes, { ordered: false });

  return {
    synced: channels.length,
    resolved: resolvedCount,
    syncedAt: syncedAt.toISOString(),
  };
}

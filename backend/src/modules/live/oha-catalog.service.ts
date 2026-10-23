import { getOhaCatalogChannelModel } from './oha-catalog.model';
import { discoverOhaChannels } from './utils/oha-catalog-source';
import { ohaNormalizeKey } from './utils/oha-channel-list';

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
  const writes = channels.map((channel) => ({
    updateOne: {
      filter: { channelKey: ohaNormalizeKey(channel.name.toUpperCase()) },
      update: {
        $set: { ...channel, active: true, lastSyncedAt: syncedAt },
      },
      upsert: true,
    },
  }));

  await OhaChannel.bulkWrite(writes, { ordered: false });

  return {
    synced: channels.length,
    syncedAt: syncedAt.toISOString(),
  };
}

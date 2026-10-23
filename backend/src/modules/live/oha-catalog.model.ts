import { Schema } from 'mongoose';
import { getLiveDb } from './live.db';

const epgEntrySchema = new Schema({
  title: { type: String, required: true },
  start: { type: String, required: true },
  end: { type: String, required: true },
}, { _id: false });

const sourceVariantSchema = new Schema({
  id: { type: String, required: true },
  epgNow: { type: epgEntrySchema },
  epgNext: { type: epgEntrySchema },
}, { _id: false });

export const ohaCatalogChannelSchema = new Schema({
  channelKey: { type: String, required: true, unique: true, index: true },
  id: { type: String, required: true },
  altIds: { type: [String], default: [] },
  sourceVariants: { type: [sourceVariantSchema], default: [] },
  streamUrl: { type: String, default: '' },
  streamSourceId: { type: String, default: '' },
  streamResolvedAt: { type: Date },
  name: { type: String, required: true, index: true },
  category: { type: String, enum: ['general', 'sport', 'cine', 'kids', 'musique'], required: true, index: true },
  tvg: { type: String },
  logo: { type: String, default: null },
  epgNow: { type: epgEntrySchema },
  epgNext: { type: epgEntrySchema },
  active: { type: Boolean, default: true, index: true },
  lastSyncedAt: { type: Date, required: true },
}, { timestamps: true, collection: 'oha_catalog_channels' });

export async function getOhaCatalogChannelModel() {
  const conn = await getLiveDb();
  return conn.models.OhaCatalogChannel || conn.model('OhaCatalogChannel', ohaCatalogChannelSchema);
}

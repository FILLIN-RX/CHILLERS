import { Schema } from 'mongoose';
import { getLiveDb } from './live.db';

const epgProgramSchema = new Schema({
  title: { type: String, required: true },
  subTitle: { type: String },
  description: { type: String },
  category: { type: String },
  icon: { type: String },
  episode: { type: String },
  start: { type: Date, required: true },
  end: { type: Date, required: true },
}, { _id: false });

export const epgChannelSchema = new Schema({
  channelKey: { type: String, required: true, unique: true, index: true },
  channelName: { type: String, required: true },
  tvg: { type: String },
  source: { type: String, enum: ['epgshare'], required: true, index: true },
  sourceId: { type: String, required: true },
  matchMethod: { type: String, enum: ['tvg', 'name', 'alias'], required: true },
  programs: { type: [epgProgramSchema], default: [] },
  fetchedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true, index: true },
}, { timestamps: true, collection: 'epg_channels' });

export async function getEpgChannelModel() {
  const conn = await getLiveDb();
  return conn.models.EpgChannel || conn.model('EpgChannel', epgChannelSchema);
}

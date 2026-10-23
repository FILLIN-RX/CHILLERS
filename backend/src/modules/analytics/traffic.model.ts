import mongoose, { Schema, Document } from 'mongoose';

export interface ITrafficDaily extends Document {
  day: string;
  scope: 'total' | 'page' | 'campaign';
  pagePath?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  pageViews: number;
  visitors: number;
  sessions: number;
  expiresAt: Date;
}

const TrafficDailySchema = new Schema<ITrafficDaily>({
  day: { type: String, required: true },
  scope: { type: String, enum: ['total', 'page', 'campaign'], required: true },
  pagePath: { type: String, default: '' },
  source: { type: String, default: '' },
  medium: { type: String, default: '' },
  campaign: { type: String, default: '' },
  pageViews: { type: Number, default: 0 },
  visitors: { type: Number, default: 0 },
  sessions: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

TrafficDailySchema.index({ day: 1, scope: 1, pagePath: 1, source: 1, medium: 1, campaign: 1 }, { unique: true });
TrafficDailySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TrafficDaily = mongoose.models.TrafficDaily || mongoose.model<ITrafficDaily>('TrafficDaily', TrafficDailySchema);

const TrafficMarkerSchema = new Schema({
  day: { type: String, required: true },
  scope: { type: String, required: true },
  kind: { type: String, enum: ['visitor', 'session'], required: true },
  key: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

TrafficMarkerSchema.index({ day: 1, scope: 1, kind: 1, key: 1 }, { unique: true });
TrafficMarkerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TrafficMarker = mongoose.models.TrafficMarker || mongoose.model('TrafficMarker', TrafficMarkerSchema);

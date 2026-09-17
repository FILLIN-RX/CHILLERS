import mongoose, { Schema, Document } from 'mongoose';

export interface IMediaRequest extends Document {
  tmdbId?: number;
  title: string;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
  year?: number;
  posterUrl?: string;
  status: 'pending' | 'searching' | 'fulfilled' | 'not_found';
  requestedBy: Array<{
    userId?: string;
    email?: string;
    requestedAt: Date;
  }>;
  requestCount: number;
  streamSources?: Array<{
    source: string;
    streamUrl: string;
    quality?: string;
    language?: string;
    server?: string;
  }>;
  fulfilledAt?: Date;
  lastSearchAt?: Date;
  searchAttempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const MediaRequestSchema: Schema = new Schema(
  {
    tmdbId: { type: Number, index: true },
    title: { type: String, required: true, index: true },
    type: { type: String, enum: ['movie', 'series'], required: true },
    season: { type: Number },
    episode: { type: Number },
    year: { type: Number },
    posterUrl: { type: String },
    status: {
      type: String,
      enum: ['pending', 'searching', 'fulfilled', 'not_found'],
      default: 'pending',
      index: true,
    },
    requestedBy: [
      {
        userId: { type: String },
        email: { type: String },
        requestedAt: { type: Date, default: Date.now },
      },
    ],
    requestCount: { type: Number, default: 1 },
    streamSources: [
      {
        source: { type: String },
        streamUrl: { type: String },
        quality: { type: String },
        language: { type: String },
        server: { type: String },
      },
    ],
    fulfilledAt: { type: Date },
    lastSearchAt: { type: Date },
    searchAttempts: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate request entries for same media/season/episode
MediaRequestSchema.index({ tmdbId: 1, type: 1, season: 1, episode: 1 });

export default mongoose.model<IMediaRequest>('MediaRequest', MediaRequestSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IProviderPage {
  provider: string;
  path: string;
  language?: string;
  lastScrapedAt?: Date;
  isWorking?: boolean;
}

export interface IMovie extends Document {
  titre: string;
  pageUrl?: string;
  lien: string;
  lienOriginal?: string;
  tmdbId?: number;
  createdAt: Date;
  uqloadCode?: string;
  uqloadLink?: string;
  uqloadQualities?: Array<{ name: string; url: string; size: string }>;
  uqloadHls?: string;
  fileCode?: string;
  uploadedAt?: Date;
  year?: number;
  streamtapeCode?: string;
  streamtapeLink?: string;
  posterUrl?: string;
  posterSource?: string;
  speech?: string;
  disponible?: boolean;
  disponibleCheckedAt?: Date;
  langueAudio?: string;
  source?: string;
  quality?: string;
  isPremium?: boolean;
  providerPages?: IProviderPage[];
  sources?: Array<{
    source: string;
    url: string;
    quality?: string;
    isPremium?: boolean;
    langueAudio?: string;
    addedAt?: Date;
  }>;
}

const MovieSchema: Schema = new Schema({
  titre: { type: String, required: true, unique: true },
  pageUrl: { type: String, required: false },
  lien: { type: String, required: true },
  lienOriginal: { type: String },
  tmdbId: { type: Number, index: true },
  createdAt: { type: Date, default: Date.now },
  uqloadCode: { type: String, index: true, sparse: true },
  uqloadLink: { type: String },
  uqloadQualities: { type: [{ name: String, url: String, size: String }] },
  uqloadHls: { type: String },
  fileCode: { type: String },
  uploadedAt: { type: Date },
  year: { type: Number },
  streamtapeCode: { type: String },
  streamtapeLink: { type: String },
  posterUrl: { type: String },
  posterSource: { type: String, enum: ['tmdb', 'web', 'ai', 'none'], default: undefined },
  speech: { type: String },
  disponible: { type: Boolean },
  disponibleCheckedAt: { type: Date },
  langueAudio: { type: String, index: true },
  source: { type: String, index: true },
  quality: { type: String },
  isPremium: { type: Boolean, default: false },
  providerPages: {
    type: [
      {
        provider: { type: String, required: true },
        path: { type: String, required: true },
        language: { type: String, default: 'fr' },
        lastScrapedAt: { type: Date, default: Date.now },
        isWorking: { type: Boolean, default: true },
      },
    ],
    default: [],
  },
  sources: {
    type: [
      {
        source: { type: String, required: true },
        url: { type: String, required: true },
        quality: { type: String },
        isPremium: { type: Boolean, default: false },
        langueAudio: { type: String },
        addedAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  },
});

export default mongoose.model<IMovie>('Movie', MovieSchema);

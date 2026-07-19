import mongoose, { Schema, Document } from 'mongoose';

export interface IMovie extends Document {
  titre: string;
  pageUrl: string;
  lien: string;
  tmdbId?: number;
  createdAt: Date;
  uqloadCode?: string;
  uqloadLink?: string;
  uqloadQualities?: Array<{ name: string; url: string; size: string }>;
  uqloadHls?: string;
}

const MovieSchema: Schema = new Schema({
  titre: { type: String, required: true, unique: true },
  pageUrl: { type: String, required: true },
  lien: { type: String, required: true },
  tmdbId: { type: Number },
  createdAt: { type: Date, default: Date.now },
  uqloadCode: { type: String, index: true, sparse: true },
  uqloadLink: { type: String },
  uqloadQualities: { type: [{ name: String, url: String, size: String }] },
  uqloadHls: { type: String },
});

export default mongoose.model<IMovie>('Movie', MovieSchema);

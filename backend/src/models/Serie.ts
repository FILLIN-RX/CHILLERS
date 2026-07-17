import mongoose, { Schema, Document } from 'mongoose';

export interface IEpisode {
  episode: string;
  lien: string;
}

export interface ISerie extends Document {
  titre: string;
  pageUrl: string;
  episodes: IEpisode[];
  tmdbId?: number;
  createdAt: Date;
}

const EpisodeSchema: Schema = new Schema({
  episode: { type: String, required: true },
  lien: { type: String, required: true }
});

const SerieSchema: Schema = new Schema({
  titre: { type: String, required: true, unique: true },
  pageUrl: { type: String, required: true },
  episodes: [EpisodeSchema],
  tmdbId: { type: Number },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<ISerie>('Serie', SerieSchema);

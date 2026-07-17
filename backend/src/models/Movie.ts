import mongoose, { Schema, Document } from 'mongoose';

export interface IMovie extends Document {
  titre: string;
  pageUrl: string;
  lien: string;
  createdAt: Date;
}

const MovieSchema: Schema = new Schema({
  titre: { type: String, required: true, unique: true },
  pageUrl: { type: String, required: true },
  lien: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model<IMovie>('Movie', MovieSchema);

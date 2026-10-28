import mongoose, { Schema, Document } from 'mongoose';

export type SportsProviderOutcome = 'hls' | 'iframe' | 'fail';

/**
 * Fiabilité observée d'un provider sport, une ligne par source.
 *
 * On ne stocke que des compteurs (jamais d'URL : les liens portent des jetons
 * de 1 à 7 h). Les compteurs servent à classer les candidats d'un match : un
 * provider qui n'a rien livré ces derniers temps passe après ceux qui jouent.
 */
export interface ISportsProviderStat extends Document {
  source: string;
  /**
   * Moyenne mobile exponentielle de jouabilité (0..1) : alpha 0,2, mise à jour
   * à chaque sonde. Elle s'auto-corrige en une dizaine d'essais — contrairement
   * à un taux cumulé, qui enterrerait un provider après une mauvaise journée.
   */
  ewma: number;
  attempts: number;
  playable: number;
  hlsPlayable: number;
  iframePlayable: number;
  lastOutcome?: SportsProviderOutcome;
  lastAttemptAt?: Date;
  lastOkAt?: Date;
  lastKoAt?: Date;
}

const SportsProviderStatSchema: Schema = new Schema(
  {
    source: { type: String, required: true, unique: true },
    ewma: { type: Number, default: 0.5 },
    attempts: { type: Number, default: 0 },
    playable: { type: Number, default: 0 },
    hlsPlayable: { type: Number, default: 0 },
    iframePlayable: { type: Number, default: 0 },
    lastOutcome: { type: String, enum: ['hls', 'iframe', 'fail'] },
    lastAttemptAt: { type: Date },
    lastOkAt: { type: Date },
    lastKoAt: { type: Date },
  },
  { collection: 'sports_provider_stats' },
);

export default mongoose.models.SportsProviderStat ||
  mongoose.model<ISportsProviderStat>('SportsProviderStat', SportsProviderStatSchema);

import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Taux de conversion éditable sans redéployer.
 * `rateFromXAF` = combien d'XAF pour 1 unité de `currency`.
 *   montant = prixXAF / rateFromXAF
 * Les documents ici surchargent FALLBACK_RATES (saspay.config.ts).
 */
export interface ICurrencyRate extends Document {
  currency: string;
  rateFromXAF: number;
  updatedAt: Date;
  createdAt: Date;
}

const CurrencyRateSchema: Schema = new Schema(
  {
    currency: { type: String, required: true, unique: true, uppercase: true, trim: true },
    rateFromXAF: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

export const CurrencyRate: Model<ICurrencyRate> =
  mongoose.models.CurrencyRate ||
  mongoose.model<ICurrencyRate>('CurrencyRate', CurrencyRateSchema);

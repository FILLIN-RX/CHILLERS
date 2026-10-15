import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * Trace locale d'une tentative de paiement SasPay (softpay).
 * Un document = UNE intention de paiement. L'activation de l'abonnement se
 * fait uniquement quand `status` passe à SUCCESS (webhook OU polling verify).
 */
export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface IPaymentTransaction extends Document {
  userId: mongoose.Types.ObjectId | string;
  planCode: string;
  planName?: string;
  amount: number;
  currency: string;
  country: string;
  network: string;
  msisdn: string;
  saspayPaymentId?: string;
  reference?: string;
  status: PaymentStatus;
  checkoutUrl?: string;
  instructions?: string;
  idempotencyKey?: string;
  activatedAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    planCode: { type: String, required: true, lowercase: true, trim: true },
    planName: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, uppercase: true, trim: true },
    country: { type: String, required: true, uppercase: true, trim: true },
    network: { type: String, required: true, trim: true },
    // Optionnel pour carte/crypto (checkout hébergé sans Mobile Money).
    msisdn: { type: String, default: '', trim: true },
    saspayPaymentId: { type: String, index: true, sparse: true },
    reference: { type: String, sparse: true },
    status: {
      type: String,
      enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
      default: 'PENDING',
      index: true,
    },
    checkoutUrl: { type: String },
    instructions: { type: String },
    idempotencyKey: { type: String },
    activatedAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true }
);

export const PaymentTransaction: Model<IPaymentTransaction> =
  mongoose.models.PaymentTransaction ||
  mongoose.model<IPaymentTransaction>('PaymentTransaction', PaymentTransactionSchema);

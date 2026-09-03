import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IPaymentProof extends Document {
  userId: mongoose.Types.ObjectId;
  userEmail: string;
  planCode: string;
  planName: string;
  amount: number;
  paymentMethod: 'orange' | 'mtn';
  senderPhone?: string;
  transactionRef?: string;
  screenshotUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentProofSchema: Schema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userEmail: { type: String, required: true },
    planCode: { type: String, required: true },
    planName: { type: String, required: true },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['orange', 'mtn'], required: true },
    senderPhone: { type: String, trim: true },
    transactionRef: { type: String, trim: true },
    screenshotUrl: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
    adminNotes: { type: String },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

export const PaymentProof: Model<IPaymentProof> =
  mongoose.models.PaymentProof || mongoose.model<IPaymentProof>('PaymentProof', PaymentProofSchema);

export default PaymentProof;

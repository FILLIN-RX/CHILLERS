import mongoose, { Document, Schema } from 'mongoose';

export interface IProviderSession extends Document {
  provider: string;
  cookie?: string;
  csrfToken?: string;
  sessionId?: string;
  expiresAt?: Date;
  lastCheckedAt?: Date;
  isValid: boolean;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderSessionSchema = new Schema<IProviderSession>(
  {
    provider: { type: String, required: true, unique: true, trim: true },
    cookie: { type: String },
    csrfToken: { type: String },
    sessionId: { type: String },
    expiresAt: { type: Date },
    lastCheckedAt: { type: Date },
    isValid: { type: Boolean, default: false },
    lastError: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.ProviderSession ||
  mongoose.model<IProviderSession>('ProviderSession', ProviderSessionSchema);

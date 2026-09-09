import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IAuditLog extends Document {
  action: 'subscription_toggle';
  adminId: string;
  adminEmail: string;
  previousState: boolean;
  newState: boolean;
  timestamp: Date;
  httpStatusCode: number;
  requestIpAddress: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema: Schema = new Schema(
  {
    action: {
      type: String,
      enum: ['subscription_toggle'],
      required: true,
      default: 'subscription_toggle',
    },
    adminId: {
      type: String,
      required: true,
    },
    adminEmail: {
      type: String,
      required: true,
    },
    previousState: {
      type: Boolean,
      required: true,
    },
    newState: {
      type: Boolean,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    httpStatusCode: {
      type: Number,
      required: true,
    },
    requestIpAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
    },
    success: {
      type: Boolean,
      required: true,
      default: true,
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
// Descending index on timestamp for reverse chronological sorting (most recent first)
AuditLogSchema.index({ timestamp: -1 });

// Index on adminId for filtering by admin
AuditLogSchema.index({ adminId: 1 });

// Index on action for filtering by action type
AuditLogSchema.index({ action: 1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

// Usage:
// Create: await new AuditLog({
//   action: 'subscription_toggle',
//   adminId: user._id,
//   adminEmail: user.email,
//   previousState: true,
//   newState: false,
//   timestamp: new Date(),
//   httpStatusCode: 200,
//   requestIpAddress: req.ip,
//   success: true
// }).save();
//
// Query: AuditLog.find().sort({ timestamp: -1 }).limit(100)

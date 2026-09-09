import mongoose, { Document, Model, Schema } from 'mongoose';

/**
 * ISystemSettings Interface
 * Represents system-wide settings stored in MongoDB
 * Extends Document for Mongoose integration
 */
export interface ISystemSettings extends Document {
  settingKey: string; // Unique identifier (e.g., 'global_subscription_enabled')
  value: boolean; // true = subscriptions enabled, false = disabled
  lastUpdatedBy: string; // Admin user ID who made the last change
  lastUpdatedAt: Date; // Timestamp of last change
  createdAt: Date; // Initial creation time
}

/**
 * SystemSettingsSchema
 * MongoDB schema for system-wide settings
 * Includes indexes for performance and audit queries
 */
const SystemSettingsSchema: Schema = new Schema(
  {
    settingKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    value: {
      type: Boolean,
      required: true,
    },
    lastUpdatedBy: {
      type: String,
      required: true,
    },
    lastUpdatedAt: {
      type: Date,
      required: true,
      index: true, // Index for audit queries
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We manage timestamps manually
  }
);

/**
 * Create unique index on settingKey
 * Ensures only one document per setting key
 */
SystemSettingsSchema.index({ settingKey: 1 }, { unique: true });

/**
 * Create index on lastUpdatedAt for audit queries
 * Allows efficient sorting and filtering by update timestamp
 */
SystemSettingsSchema.index({ lastUpdatedAt: -1 });

/**
 * Export the SystemSettings model
 * Uses mongoose.models pattern to prevent re-initialization
 * 
 * Usage Example:
 * 
 * // Get current subscription state
 * const setting = await SystemSettings.findOne({ 
 *   settingKey: 'global_subscription_enabled' 
 * });
 * const isSubscriptionEnabled = setting?.value ?? true; // default to true
 * 
 * // Update subscription state
 * const updated = await SystemSettings.findOneAndUpdate(
 *   { settingKey: 'global_subscription_enabled' },
 *   {
 *     value: false,
 *     lastUpdatedBy: adminUserId,
 *     lastUpdatedAt: new Date(),
 *   },
 *   { returnDocument: 'after', upsert: true }
 * );
 * 
 * // Get audit history (most recent changes first)
 * const auditHistory = await SystemSettings.find({
 *   settingKey: 'global_subscription_enabled'
 * })
 *   .sort({ lastUpdatedAt: -1 })
 *   .limit(100);
 */
export const SystemSettings: Model<ISystemSettings> =
  mongoose.models.SystemSettings ||
  mongoose.model<ISystemSettings>('SystemSettings', SystemSettingsSchema);

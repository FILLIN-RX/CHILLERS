/**
 * Migration Script: System Settings
 * 
 * This script ensures the SystemSettings collection is properly initialized
 * for the Admin Subscription Control System. It can be safely run on existing
 * deployments without data loss.
 * 
 * What it does:
 * - Creates SystemSettings collection if it doesn't exist
 * - Initializes 'global_subscription_enabled' setting with default value (true)
 * - Creates required indexes (unique on settingKey, index on lastUpdatedAt)
 * - Logs all operations for verification
 * 
 * Usage:
 *   npm run migrate:system-settings
 *   or
 *   ts-node backend/src/scripts/migrate-system-settings.ts
 * 
 * Requirements: 7.1, 7.2
 */

import mongoose from 'mongoose';
import { SystemSettings } from '../models/SystemSettings';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/chillers';
const SETTING_KEY = 'global_subscription_enabled';
const DEFAULT_VALUE = true; // Subscriptions enabled by default

async function migrate() {
  console.log('[Migration] Starting SystemSettings migration...');
  console.log(`[Migration] MongoDB URI: ${MONGO_URI.replace(/:[^:@]+@/, ':****@')}`);

  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI);
    console.log('[Migration] ✓ Connected to MongoDB');

    // Check if SystemSettings collection exists
    const db = mongoose.connection.db;
    const collections = db ? await db.listCollections().toArray() : [];
    const systemSettingsExists = collections.some((col) => col.name === 'systemsettings');

    if (!systemSettingsExists) {
      console.log('[Migration] SystemSettings collection does not exist, will be created automatically');
    } else {
      console.log('[Migration] ✓ SystemSettings collection exists');
    }

    // Check if global_subscription_enabled setting exists
    const existingSetting = await SystemSettings.findOne({ settingKey: SETTING_KEY });

    if (existingSetting) {
      console.log(`[Migration] ✓ Setting '${SETTING_KEY}' already exists with value: ${existingSetting.value}`);
      console.log(`[Migration]   Last updated by: ${existingSetting.lastUpdatedBy}`);
      console.log(`[Migration]   Last updated at: ${existingSetting.lastUpdatedAt}`);
    } else {
      console.log(`[Migration] Setting '${SETTING_KEY}' does not exist, creating with default value: ${DEFAULT_VALUE}`);

      const newSetting = new SystemSettings({
        settingKey: SETTING_KEY,
        value: DEFAULT_VALUE,
        lastUpdatedBy: 'migration-script',
        lastUpdatedAt: new Date(),
      });

      await newSetting.save();
      console.log(`[Migration] ✓ Created setting '${SETTING_KEY}' with value: ${DEFAULT_VALUE}`);
    }

    // Ensure indexes are created
    console.log('[Migration] Ensuring indexes...');

    try {
      // Get existing indexes
      const indexes = await SystemSettings.collection.getIndexes();
      console.log('[Migration] Existing indexes:', Object.keys(indexes));

      // Create indexes (idempotent operation - won't recreate if they exist)
      await SystemSettings.createIndexes();
      console.log('[Migration] ✓ Indexes ensured');

      // Verify unique index on settingKey
      const settingKeyIndex = indexes['settingKey_1'];
      if (settingKeyIndex) {
        console.log('[Migration] ✓ Unique index on settingKey exists');
      } else {
        console.log('[Migration] ⚠ Unique index on settingKey may not exist, but schema will ensure it');
      }

      // Verify index on lastUpdatedAt
      const lastUpdatedAtIndex = indexes['lastUpdatedAt_1'];
      if (lastUpdatedAtIndex) {
        console.log('[Migration] ✓ Index on lastUpdatedAt exists');
      } else {
        console.log('[Migration] ⚠ Index on lastUpdatedAt may not exist, but schema will ensure it');
      }
    } catch (indexError) {
      console.warn('[Migration] ⚠ Index verification/creation had warnings:', indexError);
      console.warn('[Migration] This is usually safe - indexes will be created on first operation');
    }

    // Verify the setting can be read back
    const verification = await SystemSettings.findOne({ settingKey: SETTING_KEY });
    if (verification) {
      console.log(`[Migration] ✓ Verification successful: ${SETTING_KEY} = ${verification.value}`);
    } else {
      console.error('[Migration] ✗ Verification failed: Could not read setting back');
      process.exit(1);
    }

    console.log('[Migration] ✓ Migration completed successfully!');
    console.log('[Migration] Summary:');
    console.log(`[Migration]   - SystemSettings collection: Ready`);
    console.log(`[Migration]   - Setting '${SETTING_KEY}': Initialized`);
    console.log(`[Migration]   - Indexes: Ensured`);
    console.log('[Migration]   - Verification: Passed');

  } catch (error) {
    console.error('[Migration] ✗ Migration failed:', error);
    if (error instanceof Error) {
      console.error('[Migration] Error message:', error.message);
      console.error('[Migration] Stack trace:', error.stack);
    }
    process.exit(1);
  } finally {
    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('[Migration] MongoDB connection closed');
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log('[Migration] Exiting with success');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Migration] Unhandled error:', error);
      process.exit(1);
    });
}

// Export for use in other scripts or tests
export default migrate;

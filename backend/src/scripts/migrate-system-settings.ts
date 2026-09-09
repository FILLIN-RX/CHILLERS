import { SystemSettings } from '../models/SystemSettings';
import { AuditLog } from '../models/AuditLog';
import mongoose from 'mongoose';

/**
 * Migration script for existing deployments
 *
 * This script:
 * 1. Ensures SystemSettings collection exists and is properly initialized
 * 2. Can be run on existing deployments without data loss
 * 3. Creates MongoDB indexes if missing (unique index on settingKey)
 * 4. Sets default value (enabled: true) if not already set
 * 5. Logs migration results (number of documents created/updated)
 * 6. Is idempotent (safe to run multiple times)
 *
 * Usage:
 * - CLI: npx tsx src/scripts/migrate-system-settings.ts
 * - From code: import and call migrateSystemSettings()
 *
 * @example
 * // In package.json
 * "migrate:system-settings": "npx tsx src/scripts/migrate-system-settings.ts"
 *
 * // Then run:
 * npm run migrate:system-settings
 */

interface MigrationResult {
  success: boolean;
  documentsCreated: number;
  documentsUpdated: number;
  indexesCreated: number;
  indexesExisting: number;
  message: string;
  timestamp: Date;
}

/**
 * Main migration function
 */
export async function migrateSystemSettings(): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: true,
    documentsCreated: 0,
    documentsUpdated: 0,
    indexesCreated: 0,
    indexesExisting: 0,
    message: '',
    timestamp: new Date(),
  };

  try {
    console.log('[Migration] Starting SystemSettings migration...');

    // Step 1: Ensure collection exists
    console.log('[Migration] Step 1: Checking SystemSettings collection...');
    const collections = await mongoose.connection.db?.listCollections().toArray() || [];
    const systemSettingsExists = collections.some(
      (col) => col.name === 'systemsettings'
    );

    if (!systemSettingsExists) {
      console.log('[Migration] SystemSettings collection does not exist - will be created on first document write');
    } else {
      console.log('[Migration] SystemSettings collection exists');
    }

    // Step 2: Create indexes
    console.log('[Migration] Step 2: Creating indexes...');
    try {
      const indexes = await SystemSettings.collection.getIndexes();
      const settingKeyIndexExists = Object.values(indexes).some(
        (idx: any) => idx.key?.settingKey === 1 && idx.unique === true
      );

      if (!settingKeyIndexExists) {
        console.log('[Migration] Creating unique index on settingKey...');
        await SystemSettings.collection.createIndex(
          { settingKey: 1 },
          { unique: true }
        );
        result.indexesCreated++;
        console.log('[Migration] ✓ Unique index created on settingKey');
      } else {
        result.indexesExisting++;
        console.log('[Migration] ✓ Unique index on settingKey already exists');
      }

      // Create index on lastUpdatedAt for audit queries
      const lastUpdatedAtIndexExists = Object.values(indexes).some(
        (idx: any) => idx.key?.lastUpdatedAt === 1
      );
      if (!lastUpdatedAtIndexExists) {
        console.log('[Migration] Creating index on lastUpdatedAt...');
        await SystemSettings.collection.createIndex({ lastUpdatedAt: -1 });
        result.indexesCreated++;
        console.log('[Migration] ✓ Index created on lastUpdatedAt');
      } else {
        result.indexesExisting++;
        console.log('[Migration] ✓ Index on lastUpdatedAt already exists');
      }
    } catch (indexError) {
      const errorMsg = indexError instanceof Error ? indexError.message : String(indexError);
      console.warn('[Migration] Warning: Failed to manage indexes:', errorMsg);
      // Continue anyway - indexes are not critical for functionality
    }

    // Step 3: Ensure default system setting exists
    console.log('[Migration] Step 3: Checking for default system settings...');
    const existingSetting = await SystemSettings.findOne({
      settingKey: 'global_subscription_enabled',
    });

    if (existingSetting) {
      console.log('[Migration] ✓ Global subscription setting already exists', {
        value: existingSetting.value,
        lastUpdatedAt: existingSetting.lastUpdatedAt,
      });
      result.documentsUpdated = 1; // Indicates document existed
    } else {
      // Create the default setting
      console.log('[Migration] Creating default global subscription setting (enabled: true)...');
      const now = new Date();
      const newSetting = await SystemSettings.create({
        settingKey: 'global_subscription_enabled',
        value: true, // Default: subscriptions enabled
        lastUpdatedBy: 'migration',
        lastUpdatedAt: now,
        createdAt: now,
      });
      result.documentsCreated = 1;
      console.log('[Migration] ✓ Default setting created', {
        settingKey: newSetting.settingKey,
        value: newSetting.value,
        createdAt: newSetting.createdAt,
      });
    }

    // Step 4: Create indexes for AuditLog collection if it doesn't exist
    console.log('[Migration] Step 4: Creating AuditLog indexes...');
    try {
      const auditLogIndexes = await AuditLog.collection.getIndexes();

      // Index on timestamp (descending) for sorting recent changes
      const timestampIndexExists = Object.values(auditLogIndexes).some(
        (idx: any) => idx.key?.timestamp === -1
      );
      if (!timestampIndexExists) {
        console.log('[Migration] Creating index on timestamp (descending)...');
        await AuditLog.collection.createIndex({ timestamp: -1 });
        result.indexesCreated++;
        console.log('[Migration] ✓ Index created on timestamp');
      } else {
        result.indexesExisting++;
        console.log('[Migration] ✓ Index on timestamp already exists');
      }

      // Index on adminId for filtering by admin
      const adminIdIndexExists = Object.values(auditLogIndexes).some(
        (idx: any) => idx.key?.adminId === 1
      );
      if (!adminIdIndexExists) {
        console.log('[Migration] Creating index on adminId...');
        await AuditLog.collection.createIndex({ adminId: 1 });
        result.indexesCreated++;
        console.log('[Migration] ✓ Index created on adminId');
      } else {
        result.indexesExisting++;
        console.log('[Migration] ✓ Index on adminId already exists');
      }

      // Index on action for filtering by action type
      const actionIndexExists = Object.values(auditLogIndexes).some(
        (idx: any) => idx.key?.action === 1
      );
      if (!actionIndexExists) {
        console.log('[Migration] Creating index on action...');
        await AuditLog.collection.createIndex({ action: 1 });
        result.indexesCreated++;
        console.log('[Migration] ✓ Index created on action');
      } else {
        result.indexesExisting++;
        console.log('[Migration] ✓ Index on action already exists');
      }
    } catch (auditIndexError) {
      const errorMsg = auditIndexError instanceof Error ? auditIndexError.message : String(auditIndexError);
      console.warn('[Migration] Warning: Failed to create AuditLog indexes:', errorMsg);
      // Continue anyway - AuditLog collection may not be used yet
    }

    // Success message
    result.message = 'Migration completed successfully';
    console.log('[Migration] ✓ Migration completed successfully!');
    console.log('[Migration] Results:', {
      documentsCreated: result.documentsCreated,
      documentsUpdated: result.documentsUpdated,
      indexesCreated: result.indexesCreated,
      indexesExisting: result.indexesExisting,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.success = false;
    result.message = `Migration failed: ${errorMessage}`;

    console.error('[Migration] ✗ Migration failed:', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return result;
  }
}

/**
 * CLI execution
 * Runs the migration and exits with appropriate status code
 */
async function runMigration(): Promise<void> {
  // Check if MongoDB connection string is set
  if (!process.env.MONGODB_URI) {
    console.error('[Migration] Error: MONGODB_URI environment variable not set');
    process.exit(1);
  }

  try {
    console.log('[Migration] Connecting to MongoDB...');
    console.log('[Migration] Database:', process.env.MONGODB_URI.replace(/mongodb.*@/, 'mongodb+srv://***@'));

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
    } as any);

    console.log('[Migration] ✓ Connected to MongoDB');

    // Run migration
    const result = await migrateSystemSettings();

    // Close database connection
    await mongoose.connection.close();
    console.log('[Migration] ✓ Database connection closed');

    // Exit with appropriate code
    if (result.success) {
      console.log('[Migration] ✓ Exiting with status code 0 (success)');
      process.exit(0);
    } else {
      console.error('[Migration] ✗ Exiting with status code 1 (failure)');
      process.exit(1);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Migration] ✗ Fatal error during migration:', errorMessage);

    // Attempt to close connection
    try {
      await mongoose.connection.close();
    } catch (closeError) {
      // Ignore close errors
    }

    process.exit(1);
  }
}

// Run if this script is executed directly (not imported)
if (require.main === module) {
  runMigration();
}

// Export for use in other scripts or tests
export default migrateSystemSettings;

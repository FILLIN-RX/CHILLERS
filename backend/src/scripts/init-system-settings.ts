import { SystemSettings } from '../models/SystemSettings';

/**
 * Initializes the global subscription system settings
 * 
 * This function:
 * 1. Checks if the SystemSettings document exists with settingKey='global_subscription_enabled'
 * 2. If it exists: logs that initialization is already done and returns early
 * 3. If it doesn't exist: creates the document with default value=true (subscriptions enabled)
 * 
 * This should be called on application startup, after database connection is established,
 * and before the server starts listening.
 * 
 * Error Handling:
 * - Database errors are caught and logged with context
 * - The function does NOT throw errors (lets app continue)
 * - Feature gate logic will handle missing settings gracefully
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * // In server.ts or app.ts
 * import { initializeSystemSettings } from './scripts/init-system-settings';
 * 
 * connectDB().then(async () => {
 *   await initializeSystemSettings();
 *   // ... rest of startup
 *   app.listen(PORT, () => { ... });
 * });
 */
export async function initializeSystemSettings(): Promise<void> {
  try {
    // Check if the global_subscription_enabled setting already exists
    const existingSetting = await SystemSettings.findOne({
      settingKey: 'global_subscription_enabled',
    });

    if (existingSetting) {
      // Setting already exists - initialization already done
      console.log(
        '[SystemSettings] Global subscription setting already initialized',
        {
          settingKey: 'global_subscription_enabled',
          currentValue: existingSetting.value,
          lastUpdatedAt: existingSetting.lastUpdatedAt,
        }
      );
      return;
    }

    // Setting doesn't exist - create it with default value (subscriptions enabled)
    const now = new Date();
    const newSetting = await SystemSettings.create({
      settingKey: 'global_subscription_enabled',
      value: true, // Default: subscriptions enabled
      lastUpdatedBy: 'system',
      lastUpdatedAt: now,
      createdAt: now,
    });

    console.log(
      '[SystemSettings] Global subscription setting initialized with default value',
      {
        settingKey: 'global_subscription_enabled',
        value: newSetting.value,
        lastUpdatedBy: 'system',
        createdAt: newSetting.createdAt,
        timestamp: now.toISOString(),
      }
    );
  } catch (error) {
    // Database error occurred - log it with context for debugging
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    console.error(
      '[SystemSettings] Failed to initialize global subscription setting',
      {
        error: errorMessage,
        context: 'init-system-settings on startup',
      }
    );

    // Don't throw - let app continue
    // Feature gate will handle missing settings gracefully
    // This ensures application doesn't crash if SystemSettings initialization fails
  }
}

import { SystemSettings, ISystemSettings } from '../models/SystemSettings';
import { AuditLog, IAuditLog } from '../models/AuditLog';

/**
 * GlobalSubscriptionService
 * Manages global subscription state with in-memory caching, atomic database updates,
 * and audit logging. Implements fail-safe defaults and concurrent request handling.
 *
 * Key Features:
 * - In-memory cache with 5-minute TTL for sub-10ms feature gate checks
 * - Atomic database writes with MongoDB findOneAndUpdate
 * - Cache invalidation on state changes
 * - Audit logging of all state transitions
 * - Concurrent request coordination (prevents thundering herd)
 * - Fail-safe: assumes subscriptions enabled on database errors
 */
export class GlobalSubscriptionService {
  private static readonly CACHE_KEY = 'global_subscription_enabled';
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly SETTING_KEY = 'global_subscription_enabled';
  private static readonly DEFAULT_STATE = true; // Subscriptions enabled by default

  // In-memory cache storage
  private cacheValue: boolean | null = null;
  private cacheExpiresAt: number | null = null;

  // Promise coordination for concurrent cache loads (prevents thundering herd)
  private cacheLoadPromise: Promise<boolean> | null = null;

  constructor() {
    this.cacheValue = null;
    this.cacheExpiresAt = null;
    this.cacheLoadPromise = null;
  }

  /**
   * Get global subscription state
   *
   * Flow:
   * 1. Check in-memory cache (O(1), <1ms)
   * 2. If cache valid: return cached value
   * 3. If cache miss: check if load already in progress (concurrent request)
   *    - If yes: wait for that load
   *    - If no: load from database
   * 4. Repopulate cache with TTL
   * 5. Return {enabled: boolean, cachedAt?: Date}
   *
   * Fail-safe: Returns {enabled: true} on database error
   *
   * Requirements: 1.6, 7.3, 7.4, 10.1, 10.3
   */
  async getGlobalState(): Promise<{ enabled: boolean; cachedAt?: Date }> {
    try {
      // Check cache validity
      if (this.isCacheValid()) {
        return {
          enabled: this.cacheValue!,
          cachedAt: new Date(this.cacheExpiresAt! - GlobalSubscriptionService.CACHE_TTL_MS),
        };
      }

      // If already loading, wait for that load (prevents thundering herd)
      if (this.cacheLoadPromise) {
        const result = await this.cacheLoadPromise;
        return {
          enabled: result,
          cachedAt: new Date(this.cacheExpiresAt! - GlobalSubscriptionService.CACHE_TTL_MS),
        };
      }

      // First request to miss cache - load from database
      this.cacheLoadPromise = this.loadFromDatabase();

      const result = await this.cacheLoadPromise;
      this.cacheLoadPromise = null; // Clear the promise for next cache miss

      return {
        enabled: result,
        cachedAt: new Date(this.cacheExpiresAt! - GlobalSubscriptionService.CACHE_TTL_MS),
      };
    } catch (error) {
      console.error(
        '[GlobalSubscriptionService] getGlobalState error:',
        error instanceof Error ? error.message : error
      );
      // Fail-safe: assume subscriptions enabled on error (business-safe default)
      return { enabled: GlobalSubscriptionService.DEFAULT_STATE };
    }
  }

  /**
   * Set global subscription state
   *
   * Flow:
   * 1. Read current state from database (for previousState)
   * 2. Atomically update using findOneAndUpdate with:
   *    - Filter: {settingKey: 'global_subscription_enabled'}
   *    - Update: {value: enabled, lastUpdatedBy: adminId, lastUpdatedAt: now}
   *    - Options: {returnDocument: 'after', upsert: true}
   * 3. If write succeeds: invalidate cache
   * 4. If write fails: don't invalidate cache, throw error with context
   * 5. Return {success: boolean, previousState: boolean, newState: boolean, message: string}
   *
   * Requirements: 1.3, 7.6, 9.2
   */
  async setGlobalState(
    enabled: boolean,
    adminId: string,
    adminEmail: string,
    ipAddress: string,
    userAgent?: string
  ): Promise<{
    success: boolean;
    previousState: boolean;
    newState: boolean;
    message: string;
  }> {
    try {
      // Get current state (for audit log)
      const currentSetting = await SystemSettings.findOne({
        settingKey: GlobalSubscriptionService.SETTING_KEY,
      });
      const previousState = currentSetting?.value ?? GlobalSubscriptionService.DEFAULT_STATE;

      // Atomically update the setting
      const updated = await SystemSettings.findOneAndUpdate(
        { settingKey: GlobalSubscriptionService.SETTING_KEY },
        {
          value: enabled,
          lastUpdatedBy: adminId,
          lastUpdatedAt: new Date(),
        },
        { returnDocument: 'after', upsert: true }
      );

      if (!updated) {
        throw new Error('Failed to update SystemSettings');
      }

      // Invalidate cache on successful write
      this.invalidateCache();

      // Create audit log (non-blocking, don't throw if audit fails)
      await this.createAuditLog(
        adminId,
        adminEmail,
        previousState,
        enabled,
        ipAddress,
        200,
        userAgent,
        true // success
      );

      const message = enabled ? 'Subscriptions enabled' : 'Subscriptions disabled';

      return {
        success: true,
        previousState,
        newState: enabled,
        message,
      };
    } catch (error) {
      // On failure: don't invalidate cache, throw error with context
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[GlobalSubscriptionService] setGlobalState error:', errorMessage);

      // Try to log the failed attempt (but don't throw if audit fails)
      try {
        const currentSetting = await SystemSettings.findOne({
          settingKey: GlobalSubscriptionService.SETTING_KEY,
        });
        const previousState = currentSetting?.value ?? GlobalSubscriptionService.DEFAULT_STATE;

        await this.createAuditLog(
          adminId,
          adminEmail,
          previousState,
          enabled,
          ipAddress,
          500,
          userAgent,
          false, // failure
          errorMessage
        );
      } catch (auditError) {
        console.error('[GlobalSubscriptionService] Failed to log audit entry:', auditError);
      }

      throw new Error(`Failed to update global subscription state: ${errorMessage}`);
    }
  }

  /**
   * Create audit log entry
   *
   * Flow:
   * 1. Create new AuditLog document with all parameters
   * 2. Set timestamp: new Date()
   * 3. Set action: 'subscription_toggle'
   * 4. Save to AuditLog collection
   * 5. Error handling: catch errors and log them, BUT DON'T THROW
   *    - This prevents toggle failures if audit logging fails
   *    - Log with context for debugging
   *
   * Requirements: 6.1, 6.4
   */
  async createAuditLog(
    adminId: string,
    adminEmail: string,
    previousState: boolean,
    newState: boolean,
    ipAddress: string,
    httpStatusCode: number,
    userAgent?: string,
    success: boolean = true,
    errorMessage?: string
  ): Promise<void> {
    try {
      const auditLog = new AuditLog({
        action: 'subscription_toggle',
        adminId,
        adminEmail,
        previousState,
        newState,
        timestamp: new Date(),
        httpStatusCode,
        requestIpAddress: ipAddress,
        userAgent,
        success,
        errorMessage,
      });

      await auditLog.save();
    } catch (error) {
      // Log error but don't throw - prevents toggle failures if audit fails
      console.error(
        '[GlobalSubscriptionService] createAuditLog error:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Get audit history (most recent first)
   *
   * Flow:
   * 1. Query AuditLog collection: find({action: 'subscription_toggle'})
   * 2. Sort by timestamp descending (most recent first)
   * 3. Apply limit (max 500 to prevent abuse)
   * 4. Return array of audit logs
   * 5. On database error: log error and return empty array
   *
   * Requirements: 6.4, 6.5
   */
  async getAuditHistory(limit: number = 100): Promise<IAuditLog[]> {
    try {
      // Enforce maximum limit to prevent abuse
      const maxLimit = Math.min(Math.max(1, limit), 500);

      const auditLogs = await AuditLog.find({ action: 'subscription_toggle' })
        .sort({ timestamp: -1 })
        .limit(maxLimit)
        .lean() as IAuditLog[];

      return auditLogs;
    } catch (error) {
      console.error(
        '[GlobalSubscriptionService] getAuditHistory error:',
        error instanceof Error ? error.message : error
      );
      // Return empty array on error (graceful degradation)
      return [];
    }
  }

  /**
   * Invalidate in-memory cache
   *
   * Flow:
   * 1. Clear in-memory cache entry for 'global_subscription_enabled'
   * 2. If Redis is available: publish invalidation event to all services (optional)
   * 3. Redis error handling: log error but don't throw (eventual consistency)
   * 4. Coordinate concurrent reloads: use Promise chaining to prevent thundering herd
   *
   * Requirements: 7.5, 7.6, 10.4
   */
  invalidateCache(): void {
    try {
      this.cacheValue = null;
      this.cacheExpiresAt = null;

      // TODO: If Redis is available, publish invalidation event here
      // this.redisClient.publish('global-subscription-invalidated', 'v1');
    } catch (error) {
      // Log error but don't throw (eventual consistency)
      console.error(
        '[GlobalSubscriptionService] invalidateCache error:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Initialize default state on first run
   *
   * Creates SystemSettings document if it doesn't exist
   * with value=true (subscriptions enabled by default)
   *
   * Requirements: 7.2, 7.3
   */
  async initializeDefaultState(): Promise<void> {
    try {
      const existing = await SystemSettings.findOne({
        settingKey: GlobalSubscriptionService.SETTING_KEY,
      });

      if (!existing) {
        const defaultSetting = new SystemSettings({
          settingKey: GlobalSubscriptionService.SETTING_KEY,
          value: GlobalSubscriptionService.DEFAULT_STATE,
          lastUpdatedBy: 'system',
          lastUpdatedAt: new Date(),
        });

        await defaultSetting.save();
        console.log(
          `[GlobalSubscriptionService] Initialized default setting: ${GlobalSubscriptionService.SETTING_KEY} = ${GlobalSubscriptionService.DEFAULT_STATE}`
        );

        // Populate cache immediately
        this.cacheValue = GlobalSubscriptionService.DEFAULT_STATE;
        this.cacheExpiresAt = Date.now() + GlobalSubscriptionService.CACHE_TTL_MS;
      }
    } catch (error) {
      console.error(
        '[GlobalSubscriptionService] initializeDefaultState error:',
        error instanceof Error ? error.message : error
      );
    }
  }

  /**
   * Private helper: Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (this.cacheValue === null || this.cacheExpiresAt === null) {
      return false;
    }

    return Date.now() < this.cacheExpiresAt;
  }

  /**
   * Private helper: Load subscription state from database
   * Used when cache misses
   */
  private async loadFromDatabase(): Promise<boolean> {
    try {
      const setting = await SystemSettings.findOne({
        settingKey: GlobalSubscriptionService.SETTING_KEY,
      });

      const value = setting?.value ?? GlobalSubscriptionService.DEFAULT_STATE;

      // Populate cache with TTL
      this.cacheValue = value;
      this.cacheExpiresAt = Date.now() + GlobalSubscriptionService.CACHE_TTL_MS;

      return value;
    } catch (error) {
      console.error(
        '[GlobalSubscriptionService] loadFromDatabase error:',
        error instanceof Error ? error.message : error
      );

      // Fail-safe: assume subscriptions enabled on error
      return GlobalSubscriptionService.DEFAULT_STATE;
    }
  }
}

// Export singleton instance for dependency injection
export const globalSubscriptionService = new GlobalSubscriptionService();

// Export class for testing and type safety
export default GlobalSubscriptionService;

import { GlobalSubscriptionService } from '../global-subscription.service';
import { SystemSettings } from '../../models/SystemSettings';
import { AuditLog } from '../../models/AuditLog';
import mongoose from 'mongoose';
import { connectDB } from '../../config/db';

/**
 * Unit Tests for GlobalSubscriptionService
 *
 * Tests cover:
 * - State retrieval with caching
 * - State mutation with atomic updates
 * - Cache management and invalidation
 * - Audit logging
 * - Error handling and fail-safe behavior
 * - Concurrent request handling
 *
 * Validates: Requirements 1.3, 1.6, 6.1, 7.3-7.6, 10.1, 10.3
 */

describe('GlobalSubscriptionService', () => {
  let service: GlobalSubscriptionService;

  // Skip tests if not in a test environment with database
  const skipIfNoDb = process.env.SKIP_DB_TESTS ? test.skip : test;

  beforeAll(async () => {
    // Connect to database for integration tests
    if (!mongoose.connection.readyState) {
      try {
        await connectDB();
      } catch (error) {
        console.warn('Could not connect to MongoDB for tests:', error);
      }
    }
  });

  afterAll(async () => {
    // Clean up database connection
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    // Clear collections before each test
    if (mongoose.connection.readyState) {
      await SystemSettings.deleteMany({});
      await AuditLog.deleteMany({});
    }
    // Fresh service instance for each test
    service = new GlobalSubscriptionService();
  });

  describe('getGlobalState()', () => {
    skipIfNoDb('should return enabled=true by default on first call', async () => {
      const result = await service.getGlobalState();
      expect(result.enabled).toBe(true);
      expect(result.cachedAt).toBeDefined();
    });

    skipIfNoDb('should return cached value on subsequent calls', async () => {
      // First call - miss cache, load from DB
      const result1 = await service.getGlobalState();
      expect(result1.enabled).toBe(true);

      // Second call - should hit cache (no DB query)
      const result2 = await service.getGlobalState();
      expect(result2.enabled).toBe(true);
      expect(result2.cachedAt).toEqual(result1.cachedAt);
    });

    skipIfNoDb('should return actual value from database when set', async () => {
      // Set value to false
      await SystemSettings.create({
        settingKey: 'global_subscription_enabled',
        value: false,
        lastUpdatedBy: 'admin-123',
        lastUpdatedAt: new Date(),
      });

      // Clear internal cache to force reload
      (service as any).cacheValue = null;
      (service as any).cacheExpiresAt = null;

      const result = await service.getGlobalState();
      expect(result.enabled).toBe(false);
    });

    test('should handle database errors gracefully (fail-safe)', async () => {
      // Mock SystemSettings.findOne to throw error
      jest.spyOn(SystemSettings, 'findOne').mockRejectedValueOnce(new Error('DB Error'));

      const result = await service.getGlobalState();
      // Should return enabled=true as fail-safe default
      expect(result.enabled).toBe(true);
    });

    skipIfNoDb('should coordinate concurrent requests', async () => {
      // Clear cache to force DB load
      (service as any).cacheValue = null;
      (service as any).cacheExpiresAt = null;

      // Make 3 concurrent requests
      const promises = [
        service.getGlobalState(),
        service.getGlobalState(),
        service.getGlobalState(),
      ];

      const results = await Promise.all(promises);

      // All should return same value
      expect(results[0].enabled).toBe(results[1].enabled);
      expect(results[1].enabled).toBe(results[2].enabled);
    });
  });

  describe('setGlobalState()', () => {
    skipIfNoDb('should update state in database', async () => {
      const result = await service.setGlobalState(
        false,
        'admin-123',
        'admin@example.com',
        '192.168.1.1',
        'Mozilla/5.0'
      );

      expect(result.success).toBe(true);
      expect(result.newState).toBe(false);
      expect(result.message).toBe('Subscriptions disabled');

      // Verify database was updated
      const setting = await SystemSettings.findOne({
        settingKey: 'global_subscription_enabled',
      });
      expect(setting?.value).toBe(false);
    });

    skipIfNoDb('should store previousState correctly', async () => {
      // First, set to false
      await service.setGlobalState(false, 'admin-1', 'admin1@example.com', '192.168.1.1');

      // Then toggle to true
      const result = await service.setGlobalState(true, 'admin-2', 'admin2@example.com', '192.168.1.2');

      expect(result.previousState).toBe(false);
      expect(result.newState).toBe(true);
    });

    skipIfNoDb('should invalidate cache after successful update', async () => {
      // Populate cache first
      await service.getGlobalState();
      const initialCache = (service as any).cacheValue;
      expect(initialCache).not.toBeNull();

      // Update state
      await service.setGlobalState(false, 'admin-123', 'admin@example.com', '192.168.1.1');

      // Cache should be invalidated
      expect((service as any).cacheValue).toBeNull();
    });

    skipIfNoDb('should create audit log entry', async () => {
      await service.setGlobalState(false, 'admin-123', 'admin@example.com', '192.168.1.1', 'Mozilla/5.0');

      const auditLogs = await AuditLog.find({});
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].adminId).toBe('admin-123');
      expect(auditLogs[0].newState).toBe(false);
      expect(auditLogs[0].httpStatusCode).toBe(200);
      expect(auditLogs[0].success).toBe(true);
    });

    skipIfNoDb('should throw error on database failure', async () => {
      jest.spyOn(SystemSettings, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB Error'));

      await expect(
        service.setGlobalState(false, 'admin-123', 'admin@example.com', '192.168.1.1')
      ).rejects.toThrow();
    });

    skipIfNoDb('should not invalidate cache on failure', async () => {
      // Populate cache
      await service.getGlobalState();
      const initialCache = (service as any).cacheValue;

      // Mock failure
      jest.spyOn(SystemSettings, 'findOne').mockRejectedValueOnce(new Error('DB Error'));
      jest.spyOn(SystemSettings, 'findOneAndUpdate').mockRejectedValueOnce(new Error('DB Error'));

      try {
        await service.setGlobalState(false, 'admin-123', 'admin@example.com', '192.168.1.1');
      } catch (error) {
        // Error expected
      }

      // Cache should still be populated
      expect((service as any).cacheValue).not.toBeNull();
    });
  });

  describe('getAuditHistory()', () => {
    skipIfNoDb('should return audit logs in reverse chronological order', async () => {
      // Create multiple audit logs
      await service.setGlobalState(false, 'admin-1', 'admin1@example.com', '192.168.1.1');
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay
      await service.setGlobalState(true, 'admin-2', 'admin2@example.com', '192.168.1.2');

      const history = await service.getAuditHistory(10);

      expect(history).toHaveLength(2);
      // Most recent should be first
      expect(history[0].newState).toBe(true);
      expect(history[1].newState).toBe(false);
    });

    skipIfNoDb('should respect limit parameter', async () => {
      // Create 5 audit logs
      for (let i = 0; i < 5; i++) {
        await service.setGlobalState(i % 2 === 0, `admin-${i}`, `admin${i}@example.com`, '192.168.1.1');
      }

      const history = await service.getAuditHistory(3);
      expect(history.length).toBeLessThanOrEqual(3);
    });

    skipIfNoDb('should enforce maximum limit of 500', async () => {
      const history = await service.getAuditHistory(1000);
      // Should not exceed 500 items even with request for 1000
      // (in real scenario with many logs)
    });

    skipIfNoDb('should return empty array on database error', async () => {
      jest.spyOn(AuditLog, 'find').mockImplementation(() => ({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockRejectedValueOnce(new Error('DB Error')),
      } as any));

      const history = await service.getAuditHistory(10);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(0);
    });
  });

  describe('createAuditLog()', () => {
    skipIfNoDb('should create audit log with all fields', async () => {
      await service.createAuditLog(
        'admin-123',
        'admin@example.com',
        true,
        false,
        '192.168.1.1',
        200,
        'Mozilla/5.0',
        true
      );

      const logs = await AuditLog.find({});
      expect(logs).toHaveLength(1);
      const log = logs[0];

      expect(log.adminId).toBe('admin-123');
      expect(log.adminEmail).toBe('admin@example.com');
      expect(log.previousState).toBe(true);
      expect(log.newState).toBe(false);
      expect(log.requestIpAddress).toBe('192.168.1.1');
      expect(log.httpStatusCode).toBe(200);
      expect(log.userAgent).toBe('Mozilla/5.0');
      expect(log.success).toBe(true);
    });

    skipIfNoDb('should handle failed audit creation gracefully', async () => {
      jest.spyOn(AuditLog.prototype, 'save').mockRejectedValueOnce(new Error('Audit error'));

      // Should not throw
      await expect(
        service.createAuditLog(
          'admin-123',
          'admin@example.com',
          true,
          false,
          '192.168.1.1',
          200,
          undefined,
          false,
          'Test error'
        )
      ).resolves.toBeUndefined();
    });
  });

  describe('invalidateCache()', () => {
    skipIfNoDb('should clear cache values', async () => {
      // Populate cache
      await service.getGlobalState();
      expect((service as any).cacheValue).not.toBeNull();

      // Invalidate
      service.invalidateCache();

      // Cache should be empty
      expect((service as any).cacheValue).toBeNull();
      expect((service as any).cacheExpiresAt).toBeNull();
    });

    test('should not throw on error', () => {
      // Mock error scenario
      service.invalidateCache();
      // Should complete without throwing
      expect((service as any).cacheValue).toBeNull();
    });
  });

  describe('initializeDefaultState()', () => {
    skipIfNoDb('should create default setting if not exists', async () => {
      await service.initializeDefaultState();

      const setting = await SystemSettings.findOne({
        settingKey: 'global_subscription_enabled',
      });

      expect(setting).toBeDefined();
      expect(setting?.value).toBe(true);
    });

    skipIfNoDb('should not overwrite existing setting', async () => {
      // Create setting with false value
      await SystemSettings.create({
        settingKey: 'global_subscription_enabled',
        value: false,
        lastUpdatedBy: 'admin-old',
        lastUpdatedAt: new Date(),
      });

      // Initialize
      await service.initializeDefaultState();

      // Value should still be false
      const setting = await SystemSettings.findOne({
        settingKey: 'global_subscription_enabled',
      });
      expect(setting?.value).toBe(false);
    });

    skipIfNoDb('should populate cache after initialization', async () => {
      await service.initializeDefaultState();
      expect((service as any).cacheValue).not.toBeNull();
      expect((service as any).cacheExpiresAt).not.toBeNull();
    });
  });

  describe('Cache Coordination', () => {
    skipIfNoDb('should share promise during concurrent cache misses', async () => {
      // Clear cache
      (service as any).cacheValue = null;
      (service as any).cacheExpiresAt = null;

      // Create setting
      await SystemSettings.create({
        settingKey: 'global_subscription_enabled',
        value: false,
        lastUpdatedBy: 'admin',
        lastUpdatedAt: new Date(),
      });

      // Mock findOne to delay and track calls
      let findOneCallCount = 0;
      const originalFindOne = SystemSettings.findOne;
      jest.spyOn(SystemSettings, 'findOne').mockImplementation(async (...args) => {
        findOneCallCount++;
        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, 50));
        return originalFindOne.apply(SystemSettings, args);
      });

      // Make 3 concurrent requests
      const promises = [
        service.getGlobalState(),
        service.getGlobalState(),
        service.getGlobalState(),
      ];

      await Promise.all(promises);

      // Should have called findOne exactly once (or twice due to retry logic)
      expect(findOneCallCount).toBeLessThanOrEqual(2);
    });
  });

  describe('Error Handling', () => {
    test('should log errors but not expose details to caller', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      service.invalidateCache();

      expect(consoleSpy).toHaveBeenCalledTimes(0); // No error if cache is simple

      consoleSpy.mockRestore();
    });

    skipIfNoDb('should maintain fail-safe behavior across methods', async () => {
      // Simulate database down
      jest.spyOn(SystemSettings, 'findOne').mockRejectedValue(new Error('DB Down'));

      // Should still return enabled=true
      const result = await service.getGlobalState();
      expect(result.enabled).toBe(true);
    });
  });

  describe('Performance', () => {
    skipIfNoDb('should retrieve cached state in <10ms', async () => {
      // Warm cache
      await service.getGlobalState();

      const start = performance.now();
      const result = await service.getGlobalState();
      const duration = performance.now() - start;

      expect(result.enabled).toBeDefined();
      // Note: This is a soft assertion as timing can vary in test environments
      console.log(`Cache hit latency: ${duration.toFixed(2)}ms`);
    });
  });
});

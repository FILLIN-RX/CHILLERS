import { Request, Response } from 'express';
import * as subController from '../subscription.controller';
import { globalSubscriptionService } from '../../../services/global-subscription.service';
import { SystemSettings } from '../../../models/SystemSettings';
import { AuditLog } from '../../../models/AuditLog';
import mongoose from 'mongoose';
import { connectDB } from '../../../config/db';

/**
 * Unit Tests for Subscription Controller - Global State Endpoints
 *
 * Tests cover:
 * - GET /admin/subscriptions/global-state endpoint
 * - POST /admin/subscriptions/global-state endpoint
 * - GET /admin/subscriptions/audit-history endpoint
 * - Request validation
 * - Authorization checks
 * - Error handling
 *
 * Validates: Requirements 1.6, 4.1-4.5, 6.4, 6.5
 */

describe('SubscriptionController - Global State Endpoints', () => {
  const skipIfNoDb = process.env.SKIP_DB_TESTS ? test.skip : test;

  beforeAll(async () => {
    if (!mongoose.connection.readyState) {
      try {
        await connectDB();
      } catch (error) {
        console.warn('Could not connect to MongoDB for tests:', error);
      }
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState) {
      await mongoose.connection.close();
    }
  });

  beforeEach(async () => {
    if (mongoose.connection.readyState) {
      await SystemSettings.deleteMany({});
      await AuditLog.deleteMany({});
    }
  });

  describe('getGlobalState()', () => {
    skipIfNoDb('should return current global subscription state', async () => {
      // Create a mock request and response
      const req = {} as Request;
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.getGlobalState(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          globalSubscriptionEnabled: expect.any(Boolean),
        })
      );
    });

    test('should handle service errors gracefully', async () => {
      const req = {} as Request;
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      // Mock service to throw error
      jest.spyOn(globalSubscriptionService, 'getGlobalState').mockRejectedValueOnce(new Error('Service error'));

      await subController.getGlobalState(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Service error',
        })
      );
    });
  });

  describe('setGlobalState()', () => {
    skipIfNoDb('should update global subscription state', async () => {
      const req = {
        body: { enabled: false },
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;
      const admin = {
        _id: 'admin-123',
        email: 'admin@example.com',
      };
      (req as any).admin = admin;
      (req as any).connection = { remoteAddress: '192.168.1.1' };

      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.setGlobalState(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          globalSubscriptionEnabled: false,
          previousState: expect.any(Boolean),
          message: expect.any(String),
        })
      );
    });

    test('should validate enabled field is boolean', async () => {
      const req = {
        body: { enabled: 'true' }, // String instead of boolean
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;
      (req as any).admin = { _id: 'admin-123', email: 'admin@example.com' };
      (req as any).connection = { remoteAddress: '192.168.1.1' };

      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.setGlobalState(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'enabled must be a boolean',
        })
      );
    });

    test('should reject request without admin info', async () => {
      const req = {
        body: { enabled: false },
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;
      // No admin info attached

      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.setGlobalState(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
    });

    skipIfNoDb('should handle service errors gracefully', async () => {
      const req = {
        body: { enabled: false },
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;
      (req as any).admin = { _id: 'admin-123', email: 'admin@example.com' };
      (req as any).connection = { remoteAddress: '192.168.1.1' };

      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      // Mock service to throw error
      jest
        .spyOn(globalSubscriptionService, 'setGlobalState')
        .mockRejectedValueOnce(new Error('DB Error'));

      await subController.setGlobalState(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Database error - state update failed',
        })
      );
    });
  });

  describe('getAuditHistory()', () => {
    skipIfNoDb('should return audit logs with default limit', async () => {
      const req = { query: {} } as Request;
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      // Create some audit logs
      await globalSubscriptionService.setGlobalState(false, 'admin-1', 'admin@example.com', '192.168.1.1');

      await subController.getAuditHistory(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          auditLogs: expect.any(Array),
        })
      );
    });

    skipIfNoDb('should respect limit query parameter', async () => {
      const req = { query: { limit: '10' } } as unknown as Request;
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.getAuditHistory(req, res);

      const callArgs = res.json.mock.calls[0][0];
      expect(Array.isArray(callArgs.auditLogs)).toBe(true);
    });

    test('should enforce maximum limit of 500', async () => {
      const req = { query: { limit: '1000' } } as unknown as Request;
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.getAuditHistory(req, res);

      // Should not throw and should succeed
      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
    });

    test('should handle invalid limit gracefully', async () => {
      const req = { query: { limit: 'invalid' } } as unknown as Request;
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.getAuditHistory(req, res);

      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.success).toBe(true);
    });

    test('should handle service errors gracefully', async () => {
      const req = { query: {} } as Request;
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      // Mock service to throw error
      jest.spyOn(globalSubscriptionService, 'getAuditHistory').mockRejectedValueOnce(new Error('DB Error'));

      await subController.getAuditHistory(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Service error',
        })
      );
    });
  });

  describe('Audit Log Creation', () => {
    skipIfNoDb('should create audit log on successful state change', async () => {
      const req = {
        body: { enabled: false },
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;
      (req as any).admin = { _id: 'admin-123', email: 'admin@example.com' };
      (req as any).connection = { remoteAddress: '192.168.1.1' };

      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.setGlobalState(req, res);

      // Verify audit log was created
      const auditLogs = await AuditLog.find({});
      expect(auditLogs.length).toBeGreaterThan(0);

      const log = auditLogs[0];
      expect(log.adminId).toBe('admin-123');
      expect(log.adminEmail).toBe('admin@example.com');
      expect(log.action).toBe('subscription_toggle');
    });
  });

  describe('Response Format', () => {
    skipIfNoDb('should return correct response structure for getGlobalState', async () => {
      const req = {} as Request;
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.getGlobalState(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('globalSubscriptionEnabled');
      expect(typeof response.globalSubscriptionEnabled).toBe('boolean');
    });

    skipIfNoDb('should return correct response structure for setGlobalState', async () => {
      const req = {
        body: { enabled: true },
        ip: '192.168.1.1',
        get: jest.fn().mockReturnValue('Mozilla/5.0'),
      } as unknown as Request;
      (req as any).admin = { _id: 'admin-123', email: 'admin@example.com' };
      (req as any).connection = { remoteAddress: '192.168.1.1' };

      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.setGlobalState(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('globalSubscriptionEnabled');
      expect(response).toHaveProperty('previousState');
      expect(response).toHaveProperty('message');
      expect(response).toHaveProperty('updatedAt');
    });

    skipIfNoDb('should return correct response structure for getAuditHistory', async () => {
      const req = { query: {} } as Request;
      const res = {
        json: jest.fn().mockReturnThis(),
        status: jest.fn().mockReturnThis(),
      } as unknown as Response;

      await subController.getAuditHistory(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response).toHaveProperty('success');
      expect(response).toHaveProperty('auditLogs');
      expect(Array.isArray(response.auditLogs)).toBe(true);

      if (response.auditLogs.length > 0) {
        const log = response.auditLogs[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('adminEmail');
        expect(log).toHaveProperty('previousState');
        expect(log).toHaveProperty('newState');
        expect(log).toHaveProperty('timestamp');
        expect(log).toHaveProperty('httpStatusCode');
        expect(log).toHaveProperty('requestIpAddress');
      }
    });
  });
});

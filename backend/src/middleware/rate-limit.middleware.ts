import { Request, Response, NextFunction } from 'express';

/**
 * Rate Limiting Middleware
 * Implements token bucket algorithm for API protection
 * Tracks requests per IP address
 */

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later.',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

// Store for rate limit data (in production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Create rate limiter middleware
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}) {
  const finalConfig: RateLimitConfig = { ...defaultConfig, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const key = `${req.ip}-${req.path}`;
      const now = Date.now();

      let entry = rateLimitStore.get(key);

      // Initialize or reset if window expired
      if (!entry || entry.resetTime < now) {
        entry = {
          count: 0,
          resetTime: now + finalConfig.windowMs,
        };
      }

      entry.count++;
      rateLimitStore.set(key, entry);

      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', finalConfig.maxRequests);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, finalConfig.maxRequests - entry.count));
      res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000));

      // Check if limit exceeded
      if (entry.count > finalConfig.maxRequests) {
        res.status(429).json({
          success: false,
          message: finalConfig.message,
          retryAfter: Math.ceil((entry.resetTime - now) / 1000),
        });
        return;
      }

      next();
    } catch (error) {
      console.error('[RateLimit] Error:', error);
      next(); // Allow request to proceed on error
    }
  };
}

/**
 * Strict rate limiter for sensitive endpoints (admin, auth)
 * Lower thresholds and shorter windows
 */
export function strictRateLimiter(req: Request, res: Response, next: NextFunction): void {
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // Only 10 requests per window
    message: 'Too many requests to this endpoint. Please try again later.',
  })(req, res, next);
}

/**
 * Login rate limiter
 * Strict limits to prevent brute force attacks
 */
export function loginRateLimiter(req: Request, res: Response, next: NextFunction): void {
  createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // Only 5 login attempts per window
    message: 'Too many login attempts. Please try again after 15 minutes.',
  })(req, res, next);
}

/**
 * API rate limiter for general endpoints
 * Standard limits for public API
 */
export function apiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  })(req, res, next);
}

/**
 * Streaming rate limiter
 * More generous for video streaming
 */
export function streamingRateLimiter(req: Request, res: Response, next: NextFunction): void {
  createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300, // 300 requests per minute (for file downloads)
  })(req, res, next);
}

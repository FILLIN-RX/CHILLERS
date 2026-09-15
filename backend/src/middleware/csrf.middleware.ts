import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * CSRF Protection Middleware
 * Implements double-submit cookie pattern with additional verification
 * Safe for API-first apps, tokens in headers instead of forms
 */

interface CsrfRequest extends Request {
  csrfToken?: string;
  csrfValid?: boolean;
}

// In-memory store for CSRF tokens (in production, use Redis)
const csrfTokenStore = new Map<string, { token: string; expires: number }>();

// Clean expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of csrfTokenStore.entries()) {
    if (value.expires < now) {
      csrfTokenStore.delete(key);
    }
  }
}, 10 * 60 * 1000);

/**
 * Generate CSRF token for client
 * Should be called once per session
 */
export function generateCsrfToken(req: CsrfRequest, res: Response, next: NextFunction): void {
  try {
    const sessionId = req.sessionID || req.headers['x-session-id'] || crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresIn = 24 * 60 * 60 * 1000; // 24 hours

    csrfTokenStore.set(sessionId, {
      token,
      expires: Date.now() + expiresIn,
    });

    // Set CSRF token in response header
    res.setHeader('X-CSRF-Token', token);
    res.setHeader('X-Session-ID', sessionId);

    req.csrfToken = token;
    next();
  } catch (error) {
    console.error('[CSRF] Token generation error:', error);
    res.status(500).json({ success: false, message: 'CSRF token generation failed' });
  }
}

/**
 * Verify CSRF token
 * Apply to state-changing endpoints (POST, PUT, DELETE)
 */
export function verifyCsrfToken(req: CsrfRequest, res: Response, next: NextFunction): void {
  try {
    // Skip CSRF verification for GET requests
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      next();
      return;
    }

    const sessionId = (req.headers['x-session-id'] as string) || req.sessionID;
    const clientToken = (req.headers['x-csrf-token'] as string) || req.body?.csrfToken;

    if (!sessionId || !clientToken) {
      res.status(403).json({
        success: false,
        message: 'CSRF verification failed: missing token or session',
      });
      return;
    }

    const storedData = csrfTokenStore.get(sessionId);

    if (!storedData) {
      res.status(403).json({
        success: false,
        message: 'CSRF verification failed: invalid session',
      });
      return;
    }

    // Verify token matches
    if (!crypto.timingSafeEqual(Buffer.from(storedData.token), Buffer.from(clientToken))) {
      console.warn(`[CSRF] Token mismatch for session ${sessionId}`);
      res.status(403).json({
        success: false,
        message: 'CSRF verification failed: invalid token',
      });
      return;
    }

    // Check expiration
    if (storedData.expires < Date.now()) {
      csrfTokenStore.delete(sessionId);
      res.status(403).json({
        success: false,
        message: 'CSRF verification failed: token expired',
      });
      return;
    }

    req.csrfValid = true;
    next();
  } catch (error) {
    console.error('[CSRF] Verification error:', error);
    res.status(500).json({ success: false, message: 'CSRF verification error' });
  }
}

/**
 * Rotate CSRF token after successful state change
 * Call after handling POST/PUT/DELETE
 */
export function rotateCsrfToken(req: CsrfRequest, res: Response): void {
  try {
    const sessionId = (req.headers['x-session-id'] as string) || req.sessionID;
    if (sessionId) {
      csrfTokenStore.delete(sessionId);
      const newToken = crypto.randomBytes(32).toString('hex');
      const expiresIn = 24 * 60 * 60 * 1000;

      csrfTokenStore.set(sessionId, {
        token: newToken,
        expires: Date.now() + expiresIn,
      });

      res.setHeader('X-CSRF-Token', newToken);
    }
  } catch (error) {
    console.error('[CSRF] Token rotation error:', error);
  }
}

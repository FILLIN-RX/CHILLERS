import { Request, Response, NextFunction } from 'express';
import { globalSubscriptionService } from '../services/global-subscription.service';

export interface PremiumGateRequest extends Request {
  user?: {
    id: string;
    role: string;
    subscription?: {
      plan: 'free' | 'standard' | 'premium';
      status: 'active' | 'inactive' | 'cancelled';
      expiresAt?: Date;
    };
  };
  userCanAccessPremium?: boolean;
}

/**
 * Premium Feature Gate Middleware
 * 
 * Checks if a user can access premium features based on:
 * 1. Global subscription system state (must be ON)
 * 2. User's individual subscription status (must be active premium)
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.6, 2.7, 10.1
 */
export const premiumFeatureGate = async (
  req: PremiumGateRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // 1. Get global subscription state from cache (<10ms)
    const globalState = await globalSubscriptionService.getGlobalState();

    // 2. If global state is OFF, deny access to all premium features
    if (!globalState.enabled) {
      req.userCanAccessPremium = false;
      res.status(403).json({
        success: false,
        message: 'Premium features are currently disabled',
      });
      return;
    }

    // 3. If global state is ON, check user subscription
    if (!req.user?.subscription) {
      req.userCanAccessPremium = false;
      res.status(403).json({
        success: false,
        message: 'Premium subscription required',
      });
      return;
    }

    // 4. Check if user has active premium subscription
    const subscription = req.user.subscription;
    const hasActivePremium =
      subscription.plan !== 'free' &&
      subscription.status === 'active' &&
      (!subscription.expiresAt || new Date(subscription.expiresAt) > new Date());

    if (!hasActivePremium) {
      req.userCanAccessPremium = false;
      res.status(403).json({
        success: false,
        message: 'Premium subscription required',
      });
      return;
    }

    // 5. User has active premium - allow access
    req.userCanAccessPremium = true;
    next();
  } catch (error) {
    // On service error: log error and deny access (fail-safe)
    console.error('Premium feature gate error:', error);
    req.userCanAccessPremium = false;
    res.status(403).json({
      success: false,
      message: 'Unable to verify access',
    });
  }
};

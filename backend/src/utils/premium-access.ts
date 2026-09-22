import { IUser } from '../models/User';

/**
 * Checks if a user has active premium access.
 * Premium access is granted if:
 * 1. The user is an admin.
 * 2. The user has an active premium subscription (not free) that hasn't expired.
 * 3. The user has an active promo code that hasn't expired.
 */
export function hasPremiumAccess(user: Partial<IUser> | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;

  // 1. Check classic subscription
  if (user.subscription?.status === 'active' && user.subscription?.plan !== 'free') {
    if (!user.subscription.expiresAt || new Date(user.subscription.expiresAt) > new Date()) {
      return true;
    }
  }

  // 2. Check active promo period
  if (user.promo?.isActive && user.promo?.expiresAt) {
    if (new Date(user.promo.expiresAt) > new Date()) {
      return true;
    }
  }

  return false;
}

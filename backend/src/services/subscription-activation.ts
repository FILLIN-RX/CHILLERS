import { User } from '../models/User';
import { SubscriptionPlan } from '../models/SubscriptionPlan';

/**
 * Activation d'abonnement — helper partagé (paiement SasPay, validation admin…).
 *
 * Idempotent : si l'utilisateur a DÉJÀ ce plan actif (expiresAt dans le futur),
 * rien n'est modifié et `alreadyActive: true` est renvoyé. Un webhook + un
 * polling qui arrivent pour le même paiement n'activent donc qu'une fois.
 *
 * Durée = `SubscriptionPlan.durationMonths` (1 par défaut si plan inconnu).
 */
export interface ActivationResult {
  activated: boolean;
  alreadyActive: boolean;
  plan: string;
  expiresAt: Date | null;
}

export async function activateSubscription(
  userId: string,
  planCode: string
): Promise<ActivationResult | null> {
  const code = (planCode || '').toLowerCase().trim();
  if (!code || code === 'free') return null;

  const plan = await SubscriptionPlan.findOne({ code });
  const months = plan?.durationMonths && plan.durationMonths > 0 ? plan.durationMonths : 1;

  const user = await User.findById(userId);
  if (!user) return null;

  const now = new Date();
  const current = user.subscription;
  const currentActive =
    current?.status === 'active' &&
    !!current.expiresAt &&
    new Date(current.expiresAt).getTime() > now.getTime();

  if (currentActive && current.plan === code) {
    // Déjà actif sur ce plan — pas de double extension (paiement déjà honoré).
    return { activated: false, alreadyActive: true, plan: code, expiresAt: current.expiresAt! };
  }

  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  user.subscription = {
    plan: code as 'free' | 'standard' | 'premium',
    status: 'active',
    expiresAt,
  } as typeof user.subscription;
  await user.save();

  return { activated: true, alreadyActive: false, plan: code, expiresAt };
}

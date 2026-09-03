import { Request, Response } from 'express';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { User } from '../../models/User';

export const getPlans = async (req: Request, res: Response) => {
  try {
    const plans = await SubscriptionPlan.find();
    res.json({ success: true, plans });
  } catch (error) {
    console.error('[Admin] getPlans error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createPlan = async (req: Request, res: Response) => {
  try {
    const plan = new SubscriptionPlan(req.body);
    await plan.save();
    res.json({ success: true, plan });
  } catch (error) {
    console.error('[Admin] createPlan error:', error);
    res.status(500).json({ success: false, message: 'Server error', error: (error as Error).message });
  }
};

export const updatePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findByIdAndUpdate(id, req.body, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, plan });
  } catch (error) {
    console.error('[Admin] updatePlan error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deletePlan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const plan = await SubscriptionPlan.findByIdAndDelete(id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, message: 'Plan deleted' });
  } catch (error) {
    console.error('[Admin] deletePlan error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

/* ───────── Gestion des Utilisateurs et de leurs Abonnements ───────── */

export const getUsers = async (req: Request, res: Response) => {
  try {
    const { search, limit = '100', page = '1' } = req.query as Record<string, string>;
    const query: any = {};
    if (search) {
      query.$or = [
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }
    const lim = parseInt(limit, 10) || 100;
    const skip = ((parseInt(page, 10) || 1) - 1) * lim;

    const [users, total] = await Promise.all([
      User.find(query, '-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(lim)
        .lean(),
      User.countDocuments(query)
    ]);

    res.json({ success: true, users, total, page: parseInt(page, 10) || 1 });
  } catch (error: any) {
    console.error('[Admin] getUsers error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des utilisateurs' });
  }
};

export const updateUserSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { plan, status, expiresAt, role } = req.body;

    const updateFields: any = {};

    if (plan || status !== undefined || expiresAt !== undefined) {
      if (plan) updateFields['subscription.plan'] = plan;
      if (status) updateFields['subscription.status'] = status;
      if (expiresAt !== undefined) {
        updateFields['subscription.expiresAt'] = expiresAt ? new Date(expiresAt) : null;
      }
    }
    if (role) {
      updateFields.role = role;
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { returnDocument: 'after', select: '-passwordHash' }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'Utilisateur non trouvé' });
    }

    res.json({ success: true, user: updatedUser, message: 'Abonnement utilisateur mis à jour avec succès' });
  } catch (error: any) {
    console.error('[Admin] updateUserSubscription error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la modification de l\'abonnement' });
  }
};

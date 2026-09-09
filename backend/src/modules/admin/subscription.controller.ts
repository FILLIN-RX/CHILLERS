import { Request, Response } from 'express';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';
import { User } from '../../models/User';
import { globalSubscriptionService } from '../../services/global-subscription.service';

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

/* ───────── Preuves de Paiement (Orange Money / MTN Mobile Money) ───────── */

export const submitPaymentProof = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Non authentifié' });
    }

    const { planCode, planName, amount, paymentMethod, senderPhone, transactionRef, screenshotUrl } = req.body;

    if (!planCode || !amount || !paymentMethod || !screenshotUrl) {
      return res.status(400).json({ success: false, message: 'Données de paiement incomplètes' });
    }

    const { PaymentProof } = await import('../../models/PaymentProof');
    const proof = new PaymentProof({
      userId: user._id || user.id,
      userEmail: user.email,
      planCode,
      planName: planName || planCode,
      amount: Number(amount),
      paymentMethod,
      senderPhone,
      transactionRef,
      screenshotUrl,
      status: 'pending',
    });

    await proof.save();
    res.json({ success: true, proof, message: 'Preuve de paiement reçue ! Activation sous peu après vérification.' });
  } catch (error: any) {
    console.error('[PaymentProof] submit error:', error);
    res.status(500).json({ success: false, message: 'Erreur enregistrement preuve' });
  }
};

export const getPaymentProofs = async (req: Request, res: Response) => {
  try {
    const { PaymentProof } = await import('../../models/PaymentProof');
    const proofs = await PaymentProof.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, proofs });
  } catch (error: any) {
    console.error('[PaymentProof] getProofs error:', error);
    res.status(500).json({ success: false, message: 'Erreur récupération preuves' });
  }
};

export const reviewPaymentProof = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body; // 'approved' | 'rejected'

    const { PaymentProof } = await import('../../models/PaymentProof');
    const proof = await PaymentProof.findById(id);
    if (!proof) {
      return res.status(404).json({ success: false, message: 'Preuve introuvable' });
    }

    proof.status = status;
    if (adminNotes) proof.adminNotes = adminNotes;
    proof.reviewedAt = new Date();
    await proof.save();

    // Si approuvé, activer automatiquement l'abonnement du user !
    if (status === 'approved') {
      const planDurationMonths = proof.planCode === 'premium' ? 1 : 1;
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + planDurationMonths);

      await User.findByIdAndUpdate(proof.userId, {
        $set: {
          'subscription.plan': proof.planCode === 'premium' ? 'premium' : 'standard',
          'subscription.status': 'active',
          'subscription.expiresAt': expiresAt,
        }
      });
      console.log(`[PaymentProof] ✅ Abonnement activé pour ${proof.userEmail} (Plan: ${proof.planCode})`);
    }

    res.json({ success: true, proof, message: `Paiement ${status === 'approved' ? 'validé et abonnement activé' : 'rejeté'}` });
  } catch (error: any) {
    console.error('[PaymentProof] review error:', error);
    res.status(500).json({ success: false, message: 'Erreur traitement preuve' });
  }
};

/* ───────── Global Subscription State Management ───────── */

/**
 * GET /admin/subscriptions/global-state
 * Retrieve current global subscription state
 * 
 * Response: { success: boolean, globalSubscriptionEnabled: boolean, cachedAt?: Date }
 * Validates: Requirements 1.6, 4.1, 4.2
 */
export const getGlobalState = async (req: Request, res: Response) => {
  try {
    const result = await globalSubscriptionService.getGlobalState();
    res.json({
      success: true,
      globalSubscriptionEnabled: result.enabled,
      cachedAt: result.cachedAt,
    });
  } catch (error: any) {
    console.error('[Admin] getGlobalState error:', error);
    res.status(500).json({
      success: false,
      message: 'Service error',
    });
  }
};

/**
 * POST /admin/subscriptions/global-state
 * Update global subscription state
 * 
 * Body: { enabled: boolean }
 * Response: { success: boolean, globalSubscriptionEnabled: boolean, previousState: boolean, message: string, updatedAt: Date }
 * Validates: Requirements 1.3, 4.3, 4.4, 4.5, 6.1
 */
export const setGlobalState = async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;

    // Validate that enabled is boolean
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'enabled must be a boolean',
      });
    }

    // Extract admin info from request (set by adminMiddleware)
    const admin = (req as any).admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé: Admin not found',
      });
    }

    const adminId = admin._id || admin.id;
    const adminEmail = admin.email || 'unknown@example.com';
    const ipAddress = req.ip || req.connection.remoteAddress || '0.0.0.0';
    const userAgent = req.get('user-agent');

    // Update global state
    const result = await globalSubscriptionService.setGlobalState(
      enabled,
      String(adminId),
      adminEmail,
      ipAddress,
      userAgent
    );

    res.json({
      success: result.success,
      globalSubscriptionEnabled: result.newState,
      previousState: result.previousState,
      message: result.message,
      updatedAt: new Date(),
    });
  } catch (error: any) {
    console.error('[Admin] setGlobalState error:', error);
    res.status(500).json({
      success: false,
      message: 'Database error - state update failed',
    });
  }
};

/**
 * GET /admin/subscriptions/audit-history
 * Retrieve audit log of subscription state changes
 * 
 * Query: limit (default 100, max 500)
 * Response: { success: boolean, auditLogs: Array<{id, adminEmail, previousState, newState, timestamp, httpStatusCode, requestIpAddress}> }
 * Validates: Requirements 6.4, 6.5
 */
export const getAuditHistory = async (req: Request, res: Response) => {
  try {
    const { limit = '100' } = req.query;
    const limitNum = Math.min(Math.max(1, parseInt(String(limit), 10) || 100), 500);

    const auditLogs = await globalSubscriptionService.getAuditHistory(limitNum);

    const formattedLogs = auditLogs.map((log) => ({
      id: log._id,
      adminEmail: log.adminEmail,
      previousState: log.previousState,
      newState: log.newState,
      timestamp: log.timestamp,
      httpStatusCode: log.httpStatusCode,
      requestIpAddress: log.requestIpAddress,
    }));

    res.json({
      success: true,
      auditLogs: formattedLogs,
    });
  } catch (error: any) {
    console.error('[Admin] getAuditHistory error:', error);
    res.status(500).json({
      success: false,
      message: 'Service error',
    });
  }
};

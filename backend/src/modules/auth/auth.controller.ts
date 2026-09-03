import { Request, Response } from 'express';
import { authService } from './auth.service';
import { SubscriptionPlan } from '../../models/SubscriptionPlan';

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, username, deviceId, deviceName } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'L\'email et le mot de passe sont requis' });
      return;
    }

    const result = await authService.register(email, password, username, deviceId, deviceName);
    res.status(201).json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Auth] Erreur lors de l\'inscription:', error);
    const message = error.message === 'Un utilisateur existe déjà avec cet email' ? error.message : 'Erreur serveur lors de l\'inscription';
    res.status(error.message === 'Un utilisateur existe déjà avec cet email' ? 400 : 500).json({ success: false, message });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, deviceId, deviceName, forceDisconnectOthers } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'L\'email et le mot de passe sont requis' });
      return;
    }

    const result = await authService.login(email, password, deviceId, deviceName, !!forceDisconnectOthers);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[Auth] Erreur lors de la connexion:', error);
    if (error.message === 'LIMITE_CONNEXIONS_ATTEINTE') {
      res.status(403).json({
        success: false,
        code: 'DEVICE_LIMIT_REACHED',
        message: 'Limite d\'appareils connectés atteinte pour votre abonnement.',
      });
      return;
    }
    const message = error.message === 'Identifiants invalides' ? error.message : 'Erreur serveur lors de la connexion';
    res.status(error.message === 'Identifiants invalides' ? 401 : 500).json({ success: false, message });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const user = await authService.getProfile(userId);
    res.json({ success: true, user });
  } catch (error: any) {
    console.error('[Auth] Erreur lors de la récupération du profil:', error);
    const message = error.message === 'Utilisateur non trouvé' ? error.message : 'Erreur serveur';
    res.status(error.message === 'Utilisateur non trouvé' ? 404 : 500).json({ success: false, message });
  }
};

export const getPlans = async (req: Request, res: Response): Promise<void> => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ price: 1 });
    res.json({ success: true, plans });
  } catch (error: any) {
    console.error('[Auth] Erreur lors de la récupération des plans:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const revokeSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { deviceId } = req.body;
    if (!deviceId) {
      res.status(400).json({ success: false, message: 'deviceId requis' });
      return;
    }
    await authService.revokeSession(userId, deviceId);
    res.json({ success: true, message: 'Session révoquée avec succès' });
  } catch (error: any) {
    console.error('[Auth] Erreur lors de la révocation:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

export const revokeOtherSessions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const currentDeviceId = (req as any).user.deviceId;
    await authService.revokeAllOtherSessions(userId, currentDeviceId);
    res.json({ success: true, message: 'Toutes les autres sessions ont été déconnectées avec succès' });
  } catch (error: any) {
    console.error('[Auth] Erreur lors de la déconnexion des autres sessions:', error);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
};

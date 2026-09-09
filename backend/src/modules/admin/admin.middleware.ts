import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../../models/Admin';

const JWT_SECRET = process.env.JWT_SECRET || 'chiller-admin-secret-change-me';

export interface AuthRequest extends Request {
    admin?: { username: string; _id?: string; id?: string; email?: string };
}

async function verifyToken(token: string | undefined, req: AuthRequest, res: Response, next: NextFunction) {
    if (!token) {
        res.status(401).json({ success: false, data: null, message: 'Non autorisé: Token manquant' });
        return;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { username: string; id?: string };
        
        // Fetch full admin details from database
        const admin = await Admin.findOne({ username: decoded.username });
        if (!admin) {
            res.status(401).json({ success: false, data: null, message: 'Non autorisé: Admin not found' });
            return;
        }

        req.admin = {
            username: admin.username,
            _id: admin._id?.toString(),
            id: admin._id?.toString(),
            email: admin.email || `${admin.username}@admin.local`,
        };
        next();
    } catch {
        res.status(401).json({ success: false, data: null, message: 'Non autorisé: Token invalide ou expiré' });
    }
}

/**
 * Auth admin standard : token dans l'en-tête Authorization uniquement.
 * On n'accepte PAS le token en query string (fuite via logs/Referer/historique).
 */
export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : undefined;
    verifyToken(token, req, res, next);
}

/**
 * Auth pour les endpoints SSE (EventSource) qui ne peuvent pas envoyer
 * d'en-tête Authorization : on tolère le token en query string, limité
 * à ces seules routes de flux.
 */
export function adminSseMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const header = req.headers.authorization;
    const headerToken = header?.startsWith('Bearer ') ? header.split(' ')[1] : undefined;
    const token = headerToken || (req.query.token as string | undefined);
    verifyToken(token, req, res, next);
}

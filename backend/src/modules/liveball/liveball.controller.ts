import type { Request, Response, NextFunction } from 'express';
import { getLiveBallMatches, getLiveBallLeagueMatches, getLiveBallAvailableMatches, resolveLiveBallStream } from './liveball.service';

export const getMatches = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await getLiveBallMatches();
    if (!matches) {
      res.status(502).json({ success: false, data: null, message: 'LiveBall injoignable' });
      return;
    }
    res.json({ success: true, data: matches, message: null });
  } catch (error) {
    next(error);
  }
};

export const getAvailableMatches = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await getLiveBallAvailableMatches();
    if (!matches) {
      res.status(502).json({ success: false, data: null, message: 'LiveBall injoignable' });
      return;
    }
    res.json({ success: true, data: matches, message: null });
  } catch (error) {
    next(error);
  }
};

export const getLeagueMatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const matches = await getLiveBallLeagueMatches(String(req.params.league));
    if (!matches) {
      res.status(502).json({ success: false, data: null, message: 'LiveBall injoignable' });
      return;
    }
    res.json({ success: true, data: matches, message: null });
  } catch (error) {
    next(error);
  }
};

export const getMatchStream = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const url = await resolveLiveBallStream(String(req.params.matchId));
    if (!url) {
      res.status(404).json({ success: false, data: null, message: 'Flux liveball introuvable' });
      return;
    }
    res.json({ success: true, data: { url, type: 'hls' }, message: null });
  } catch (error) {
    next(error);
  }
};
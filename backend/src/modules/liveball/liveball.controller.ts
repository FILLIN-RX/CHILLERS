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
    const matchId = String(req.params.matchId);
    console.log(`[LiveBall] Stream request for match ${matchId}`);
    
    const stream = await resolveLiveBallStream(matchId);
    if (!stream) {
      console.warn(`[LiveBall] No stream found for match ${matchId}`);
      res.status(404).json({ success: false, data: null, message: 'Flux liveball introuvable' });
      return;
    }
    
    console.log(`[LiveBall] ✓ Stream resolved for match ${matchId}`);
    res.json({ success: true, data: { url: stream.url, type: stream.type }, message: null });
  } catch (error) {
    console.error(`[LiveBall] Error resolving stream:`, error);
    next(error);
  }
};
import { Request, Response, NextFunction } from 'express';
import * as tvService from './tv.service';
import { AppError } from '../../types';

export const getPopular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const data = await tvService.getPopular(page);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getTrending = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await tvService.getTrending();
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id) throw new AppError('TV show ID is required', 400);
    const data = await tvService.getDetails(id);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getSeasonDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const seasonNumber = req.params.seasonNumber as string;
    if (!id || !seasonNumber) throw new AppError('TV show ID and season number are required', 400);
    const data = await tvService.getSeasonDetails(id, seasonNumber);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

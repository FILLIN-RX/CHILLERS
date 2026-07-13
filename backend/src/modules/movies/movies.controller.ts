import { Request, Response, NextFunction } from 'express';
import * as moviesService from './movies.service';
import { AppError } from '../../types';

export const getPopular = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const data = await moviesService.getPopular(page);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getTrending = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await moviesService.getTrending();
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getUpcoming = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const data = await moviesService.getUpcoming(page);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getTopRated = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const data = await moviesService.getTopRated(page);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getDetails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id) throw new AppError('Movie ID is required', 400);
    const data = await moviesService.getDetails(id);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getRecommendations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id) throw new AppError('Movie ID is required', 400);
    const data = await moviesService.getRecommendations(id);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getTrailer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    if (!id) throw new AppError('Movie ID is required', 400);
    const data = await moviesService.getTrailer(id);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getByGenre = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const genreId = req.params.genreId as string;
    const page = Number(req.query.page) || 1;
    if (!genreId) throw new AppError('Genre ID is required', 400);
    const data = await moviesService.getByGenre(genreId, page);
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

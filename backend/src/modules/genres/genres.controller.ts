import { Request, Response, NextFunction } from 'express';
import * as genresService from './genres.service';

export const getMovieGenres = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await genresService.getMovieGenres();
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

export const getTvGenres = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await genresService.getTvGenres();
    res.json({ success: true, data, message: null });
  } catch (error) {
    next(error);
  }
};

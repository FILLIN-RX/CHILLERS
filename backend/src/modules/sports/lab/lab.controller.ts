import type { Request, Response, NextFunction } from 'express';
import { findFixture, listChannels, listFixtures, loadSnapshot } from './lab-store';

export const getLabReport = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const snapshot = loadSnapshot();
    res.json({
      success: true,
      data: {
        generatedAt: snapshot.generatedAt,
        totals: snapshot.totals,
        fixtures: snapshot.fixtures,
      },
      message: null,
    });
  } catch (error) {
    next(error);
  }
};

export const getLabFixture = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.fixtureId || '');
    const fixture = findFixture(id);
    if (!fixture) {
      res.status(404).json({ success: false, data: null, message: 'Fixture absente du snapshot' });
      return;
    }
    res.json({ success: true, data: fixture, message: null });
  } catch (error) {
    next(error);
  }
};

export const getLabFixtureChannels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = String(req.params.fixtureId || '');
    const fixture = findFixture(id);
    const channels = listChannels(id);
    if (!fixture || !channels) {
      res.status(404).json({ success: false, data: null, message: 'Fixture absente du snapshot' });
      return;
    }
    res.json({ success: true, data: { fixture, channels }, message: null });
  } catch (error) {
    next(error);
  }
};

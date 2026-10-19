import type { Request, Response, NextFunction } from 'express';
import { findFixture, listChannels, loadSnapshot } from './lab-store';
import { getLabStatus as readSchedulerStatus, precheckLabSnapshot, triggerLabScan } from './lab-scheduler';

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

/** État de l'ordonnanceur : dernier / prochain run, cron, ancienneté du snapshot. */
export const getLabStatus = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: readSchedulerStatus(), message: null });
  } catch (error) {
    next(error);
  }
};

/** Déclenche un snapshot immédiat : 202, le run dure 1-3 min → poll /status. */
export const postLabScan = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pre = precheckLabSnapshot();
    if (pre === 'busy') {
      res.status(409).json({ success: false, data: null, message: 'Un snapshot est déjà en cours' });
      return;
    }
    if (pre === 'disabled') {
      res.status(503).json({ success: false, data: null, message: 'Ordonnanceur du lab désactivé' });
      return;
    }
    void triggerLabScan('manuel');
    res.status(202).json({ success: true, data: readSchedulerStatus(), message: 'Snapshot lancé' });
  } catch (error) {
    next(error);
  }
};

import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { TrafficDaily, TrafficMarker } from './traffic.model';

const DAY_MS = 24 * 60 * 60 * 1000;
const MARKER_TTL_MS = 30 * DAY_MS;
const AGGREGATE_TTL_MS = 365 * DAY_MS;
const clean = (value: unknown, max: number) => typeof value === 'string'
  ? value.trim().replace(/[<>\u0000-\u001f]/g, '').slice(0, max)
  : '';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');

async function markOnce(day: string, scope: string, kind: 'visitor' | 'session', key: string, expiry: Date) {
  try {
    await TrafficMarker.create({ day, scope, kind, key: hash(key), expiresAt: expiry });
    return true;
  } catch (error: any) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

export async function recordVisit(req: Request, res: Response) {
  const visitorId = clean(req.body?.visitorId, 80);
  const sessionId = clean(req.body?.sessionId, 80);
  const pagePath = clean(req.body?.pagePath, 180);
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(visitorId) || !/^[a-zA-Z0-9-]{8,80}$/.test(sessionId)
    || !pagePath.startsWith('/') || pagePath.startsWith('/admin') || pagePath.startsWith('/api')) {
    res.status(400).json({ success: false, data: null, message: 'Visite invalide' });
    return;
  }

  const source = clean(req.body?.source, 80) || 'direct';
  const medium = clean(req.body?.medium, 80);
  const campaign = clean(req.body?.campaign, 120);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const markerExpiry = new Date(now.getTime() + MARKER_TTL_MS);
  const aggregateExpiry = new Date(now.getTime() + AGGREGATE_TTL_MS);
  const campaignScope = `campaign:${hash(`${source}\n${medium}\n${campaign}`)}`;

  try {
    const [newVisitor, newSession, newCampaignVisitor, newCampaignSession] = await Promise.all([
      markOnce(day, 'total', 'visitor', visitorId, markerExpiry),
      markOnce(day, 'total', 'session', sessionId, markerExpiry),
      markOnce(day, campaignScope, 'visitor', visitorId, markerExpiry),
      markOnce(day, campaignScope, 'session', sessionId, markerExpiry),
    ]);
    const insertExpiry = { $setOnInsert: { day, expiresAt: aggregateExpiry } };
    await Promise.all([
      TrafficDaily.updateOne(
        { day, scope: 'total', pagePath: '', source: '', medium: '', campaign: '' },
        { $inc: { pageViews: 1, visitors: newVisitor ? 1 : 0, sessions: newSession ? 1 : 0 }, ...insertExpiry },
        { upsert: true },
      ),
      TrafficDaily.updateOne(
        { day, scope: 'page', pagePath, source: '', medium: '', campaign: '' },
        { $inc: { pageViews: 1 }, ...insertExpiry },
        { upsert: true },
      ),
      TrafficDaily.updateOne(
        { day, scope: 'campaign', pagePath: '', source, medium, campaign },
        { $inc: { pageViews: 1, visitors: newCampaignVisitor ? 1 : 0, sessions: newCampaignSession ? 1 : 0 }, ...insertExpiry },
        { upsert: true },
      ),
    ]);
    res.status(202).json({ success: true, data: null, message: null });
  } catch {
    // Keep analytics failures isolated from browsing and avoid logging request IDs.
    res.status(202).json({ success: true, data: null, message: null });
  }
}

export async function getTrafficReport(req: Request, res: Response) {
  const allowed = [7, 30, 90];
  const days = allowed.includes(Number(req.query.days)) ? Number(req.query.days) : 30;
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - (days - 1));
  const from = start.toISOString().slice(0, 10);
  const match = { day: { $gte: from } };
  try {
    const [daily, pages, campaigns] = await Promise.all([
      TrafficDaily.find({ ...match, scope: 'total' }).sort({ day: 1 }).select('day pageViews visitors sessions -_id').lean(),
      TrafficDaily.aggregate([
        { $match: { ...match, scope: 'page' } },
        { $group: { _id: '$pagePath', pageViews: { $sum: '$pageViews' } } },
        { $sort: { pageViews: -1 } }, { $limit: 20 },
        { $project: { _id: 0, pagePath: '$_id', pageViews: 1 } },
      ]),
      TrafficDaily.aggregate([
        { $match: { ...match, scope: 'campaign' } },
        { $group: { _id: { source: '$source', medium: '$medium', campaign: '$campaign' }, pageViews: { $sum: '$pageViews' }, visitors: { $sum: '$visitors' }, sessions: { $sum: '$sessions' } } },
        { $sort: { sessions: -1, pageViews: -1 } }, { $limit: 20 },
        { $project: { _id: 0, source: '$_id.source', medium: '$_id.medium', campaign: '$_id.campaign', pageViews: 1, visitors: 1, sessions: 1 } },
      ]),
    ]);
    res.json({ success: true, data: { days, daily, pages, campaigns }, message: null });
  } catch {
    res.status(500).json({ success: false, data: null, message: 'Rapport de visites indisponible' });
  }
}

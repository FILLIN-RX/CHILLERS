import type { Request, Response, NextFunction } from 'express';
import { listOhaCatalogChannels } from './oha-catalog.service';
import { getEpgGuide } from './epg.service';
import { rankChannelsForMatch } from './match-channels';
import { resolveOhaStream } from './oha-resolve';
import type { OhaChannel } from './oha.types';

function parseTime(value: unknown): number | null {
  if (value == null || value === '') return null;
  const raw = String(value);
  const ms = /^\d+$/.test(raw) ? Number(raw) : Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

export const getOhaChannels = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const channels = await listOhaCatalogChannels();
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=1800');
    res.json({ success: true, data: channels, message: null });
  } catch (error) {
    next(error);
  }
};

export const getEpg = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = parseTime(req.query.from) ?? Date.now() - 6 * 60 * 60_000;
    const requestedTo = parseTime(req.query.to) ?? from + 24 * 60 * 60_000;
    const to = Math.min(requestedTo, from + 8 * 24 * 60 * 60_000);
    const channelIds =
      typeof req.query.channels === 'string'
        ? req.query.channels.split(',').map((id) => id.trim()).filter(Boolean)
        : undefined;
    const guide = await getEpgGuide({ from, to, channelIds });
    res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600');
    res.json({ success: true, data: guide, message: null });
  } catch (error) {
    next(error);
  }
};

/** Chaînes CHILLERS susceptibles de diffuser un match, EPG confirmé d'abord. */
export const getMatchChannels = async (req: Request, res: Response, next: NextFunction) => {
  const league = typeof req.query.league === 'string' ? req.query.league : '';
  const home = typeof req.query.home === 'string' ? req.query.home : '';
  const away = typeof req.query.away === 'string' ? req.query.away : '';
  const sport = typeof req.query.sport === 'string' ? req.query.sport : 'football';
  const startMs = parseTime(req.query.start) ?? Date.now();

  try {
    const guidePromise = getEpgGuide({
      from: startMs - 60 * 60_000,
      to: startMs + 3 * 60 * 60_000,
    }).catch(() => null);
    const [rawChannels, guide] = await Promise.all([listOhaCatalogChannels(), guidePromise]);
    const channels = rawChannels as unknown as OhaChannel[];
    const programsByChannel = new Map(
      (guide?.channels ?? []).map((channel) => [channel.id, channel.programs]),
    );
    const ranked = rankChannelsForMatch(
      channels,
      { sport, league, home, away, title: `${home} ${away}`.trim() },
      startMs,
      guide ? (channel) => programsByChannel.get(channel.id) ?? [] : undefined,
    );

    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.json({ success: true, data: ranked, message: null });
  } catch (error) {
    next(error);
  }
};

export const resolveOha = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = typeof req.query.id === 'string' ? req.query.id : '';
    if (!/^\d{1,12}$/u.test(id)) {
      res.status(400).json({ success: false, message: 'invalid id' });
      return;
    }
    const alts = (typeof req.query.alts === 'string' ? req.query.alts : '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => /^\d{1,12}$/u.test(value));

    const stream = await resolveOhaStream(id, alts);
    if (!stream) {
      res.status(502).setHeader('Cache-Control', 'no-store');
      res.json({ success: false, message: 'all sources dead' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.json({
      success: true,
      data: { url: stream.url, live: stream.live, format: stream.format },
      message: null,
    });
  } catch (error) {
    next(error);
  }
};

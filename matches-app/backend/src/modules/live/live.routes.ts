import { Router } from 'express';
import { getEpg, getMatchChannels, getOhaChannels, resolveOha } from './live.controller';
import { embedProxy } from './embed-proxy';
import { liveProxy, liveProxyOptions } from './stream-proxy';

const router = Router();

router.get('/oha/channels', getOhaChannels);
router.get('/epg', getEpg);
router.get('/match-channels', getMatchChannels);
router.get('/oha/resolve', resolveOha);

router.get('/embed-proxy', embedProxy);
router.get('/proxy', liveProxy);
router.options('/proxy', liveProxyOptions);

export default router;

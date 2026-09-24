import { Router, Request, Response } from 'express';
import { getPlexCatalog, PlexResult } from './plex.service';

const router = Router();

function normalize(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const { type } = req.query as { type?: string };
    let items = await getPlexCatalog();
    if (type === 'movie' || type === 'show') {
      items = items.filter(i => i.type === type);
    }
    return res.json({ success: true, data: items });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search', async (req: Request, res: Response) => {
  try {
    const { title, type } = req.query as { title?: string; type?: string };
    if (!title) {
      return res.status(400).json({ success: false, message: 'Paramètre ?title= requis' });
    }
    let items = await getPlexCatalog();
    const normQuery = normalize(title);
    items = items.filter(i => normalize(i.title).includes(normQuery));
    if (type === 'movie' || type === 'show') {
      items = items.filter(i => i.type === type);
    }
    return res.json({ success: true, data: items });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
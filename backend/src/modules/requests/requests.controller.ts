import { Request, Response } from 'express';
import {
  createOrUpdateRequest,
  fulfillRequest,
  getAdminRequests,
  getUserRequests,
  dispatchToGoSearcher,
} from './requests.service';
import MediaRequest from '../../models/MediaRequest';

export async function submitRequestHandler(req: Request, res: Response) {
  try {
    const { tmdbId, title, type, season, episode, year, posterUrl } = req.body;

    if (!title || !type) {
      return res.status(400).json({
        success: false,
        message: 'Le titre et le type (movie/series) sont obligatoires.',
      });
    }

    const userId = (req as any).user?.id || (req as any).user?._id;
    const email = (req as any).user?.email;

    const request = await createOrUpdateRequest({
      tmdbId: tmdbId ? Number(tmdbId) : undefined,
      title,
      type,
      season: season ? Number(season) : undefined,
      episode: episode ? Number(episode) : undefined,
      year: year ? Number(year) : undefined,
      posterUrl,
      userId: userId?.toString(),
      email,
    });

    return res.status(201).json({
      success: true,
      data: request,
      message: 'Demande enregistrée avec succès. La recherche automatique a été lancée.',
    });
  } catch (error: any) {
    console.error('[RequestsController] Erreur submit:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de l’enregistrement de la demande.',
    });
  }
}

export async function getUserRequestsHandler(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id || (req as any).user?._id;
    const email = (req as any).user?.email;

    const requests = await getUserRequests(userId?.toString(), email);
    return res.json({
      success: true,
      data: requests,
    });
  } catch (error: any) {
    console.error('[RequestsController] Erreur getUserRequests:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de vos demandes.',
    });
  }
}

export async function fulfillRequestHandler(req: Request, res: Response) {
  try {
    const requestId = req.params.id;
    const payload = {
      requestId,
      ...req.body,
    };

    const updated = await fulfillRequest(payload);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée.',
      });
    }

    return res.json({
      success: true,
      data: updated,
      message: 'Demande mise à jour avec succès.',
    });
  } catch (error: any) {
    console.error('[RequestsController] Erreur fulfill:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement du résultat de recherche.',
    });
  }
}

export async function getAdminRequestsHandler(req: Request, res: Response) {
  try {
    const { status, type, search, page, limit } = req.query;

    const result = await getAdminRequests({
      status: status as string,
      type: type as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    return res.json({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error('[RequestsController] Erreur admin list:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des demandes admin.',
    });
  }
}

export async function retrySearchHandler(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const request = await MediaRequest.findById(id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Demande introuvable.' });
    }

    await dispatchToGoSearcher(request);

    return res.json({
      success: true,
      message: `Recherche relancée pour "${request.title}".`,
    });
  } catch (error: any) {
    console.error('[RequestsController] Erreur retry:', error);
    return res.status(500).json({ success: false, message: 'Erreur lors de la relance de recherche.' });
  }
}

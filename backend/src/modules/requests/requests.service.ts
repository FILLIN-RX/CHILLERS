import axios from 'axios';
import MediaRequest, { IMediaRequest } from '../../models/MediaRequest';
import Movie from '../../models/Movie';
import Serie from '../../models/Serie';
import { autoLink } from '../../scraping/maintenance/auto-link';

const GO_SEARCHER_URL = process.env.GO_SEARCHER_URL || 'http://localhost:8095';

export interface CreateRequestInput {
  tmdbId?: number;
  title: string;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
  year?: number;
  posterUrl?: string;
  userId?: string;
  email?: string;
}

export interface FulfillRequestPayload {
  requestId: string;
  tmdbId?: number;
  type: 'movie' | 'series';
  found: boolean;
  sources?: Array<{
    source: string;
    streamUrl: string;
    quality?: string;
    language?: string;
    server?: string;
    season?: number;
    episode?: number;
  }>;
  durationMs?: number;
}

/**
 * Enregistre ou incrémente une demande de contenu
 */
export async function createOrUpdateRequest(input: CreateRequestInput): Promise<IMediaRequest> {
  const query: any = {
    title: new RegExp(`^${input.title.trim()}$`, 'i'),
    type: input.type,
  };

  if (input.tmdbId) query.tmdbId = input.tmdbId;
  if (input.type === 'series') {
    query.season = input.season || 1;
    query.episode = input.episode || 1;
  }

  let existing = await MediaRequest.findOne(query);

  if (existing) {
    // Si l'utilisateur n'a pas encore demandé ce contenu, l'ajouter
    const alreadyRequestedByUser = existing.requestedBy.some(
      (u) => (input.userId && u.userId === input.userId) || (input.email && u.email === input.email)
    );

    if (!alreadyRequestedByUser) {
      existing.requestedBy.push({
        userId: input.userId,
        email: input.email,
        requestedAt: new Date(),
      });
      existing.requestCount += 1;
    }

    if (input.posterUrl && !existing.posterUrl) {
      existing.posterUrl = input.posterUrl;
    }

    // Si la demande était 'not_found' et qu'un nouvel utilisateur la demande, on la repasse en 'pending'
    if (existing.status === 'not_found') {
      existing.status = 'pending';
    }

    await existing.save();
    
    // Déclencher la recherche Go si non trouvée
    if (existing.status === 'pending') {
      dispatchToGoSearcher(existing).catch((err) =>
        console.warn(`[RequestsService] Erreur appel searcher Go:`, err.message)
      );
    }

    return existing;
  }

  // Nouvelle demande
  const newRequest = await MediaRequest.create({
    tmdbId: input.tmdbId,
    title: input.title.trim(),
    type: input.type,
    season: input.season || (input.type === 'series' ? 1 : undefined),
    episode: input.episode || (input.type === 'series' ? 1 : undefined),
    year: input.year,
    posterUrl: input.posterUrl,
    status: 'pending',
    requestCount: 1,
    requestedBy: [
      {
        userId: input.userId,
        email: input.email,
        requestedAt: new Date(),
      },
    ],
    searchAttempts: 0,
  });

  // Déclencher la recherche parallèle sur le microservice Go
  dispatchToGoSearcher(newRequest).catch((err) =>
    console.warn(`[RequestsService] Erreur appel searcher Go:`, err.message)
  );

  return newRequest;
}

/**
 * Envoie un travail de recherche au microservice Go en arrière-plan
 */
export async function dispatchToGoSearcher(request: IMediaRequest): Promise<void> {
  try {
    request.status = 'searching';
    request.lastSearchAt = new Date();
    request.searchAttempts += 1;
    await request.save();

    const payload = {
      requestId: request._id.toString(),
      tmdbId: request.tmdbId,
      title: request.title,
      type: request.type,
      season: request.season,
      episode: request.episode,
      year: request.year,
    };

    console.log(`[RequestsService] 🚀 Envoi recherche à Go Searcher (:8090) pour "${request.title}"...`);
    await axios.post(`${GO_SEARCHER_URL}/search`, payload, { timeout: 5000 });
  } catch (error: any) {
    console.warn(`[RequestsService] Impossible de contacter Go Searcher (${GO_SEARCHER_URL}):`, error.message);
  }
}

/**
 * Traite le callback de fulfillment envoyé par le microservice Go
 */
export async function fulfillRequest(payload: FulfillRequestPayload): Promise<IMediaRequest | null> {
  const request = await MediaRequest.findById(payload.requestId);
  if (!request) {
    console.warn(`[RequestsService] Callback reçu pour demande inconnue ID: ${payload.requestId}`);
    return null;
  }

  if (!payload.found || !payload.sources || payload.sources.length === 0) {
    request.status = 'not_found';
    await request.save();
    console.log(`[RequestsService] Recherche infructueuse pour "${request.title}" (durée: ${payload.durationMs}ms)`);
    return request;
  }

  // Contenu trouvé ! Mettre à jour la demande
  request.status = 'fulfilled';
  request.fulfilledAt = new Date();
  request.streamSources = payload.sources;
  await request.save();

  // Injecter automatiquement dans la base de données Movies / Series pour disponibilité immédiate
  const bestSource = payload.sources[0];
  try {
    if (request.type === 'movie') {
      const updatedMovie = await Movie.findOneAndUpdate(
        { titre: new RegExp(`^${request.title}$`, 'i') },
        {
          $set: {
            titre: request.title,
            lien: bestSource.streamUrl,
            disponible: true,
            source: bestSource.source,
            quality: bestSource.quality || '1080p',
          },
        },
        { upsert: true, returnDocument: 'after' }
      );
      if (updatedMovie?._id) autoLink('movie', updatedMovie._id.toString());
    } else if (request.type === 'series') {
      const targetSeason = request.season || 1;
      const targetEpisode = request.episode || 1;
      const canonicalEp = `S${String(targetSeason).padStart(2, '0')}E${String(targetEpisode).padStart(2, '0')}`;

      const epData = {
        episode: canonicalEp,
        season: targetSeason,
        episodeNumber: targetEpisode,
        lien: bestSource.streamUrl,
      };

      const existingSerie = await Serie.findOne({ titre: new RegExp(`^${request.title}$`, 'i') });
      if (existingSerie) {
        const epIndex = existingSerie.episodes?.findIndex(
          (e: any) => Number(e.season) === targetSeason && Number(e.episodeNumber) === targetEpisode
        );
        if (epIndex !== undefined && epIndex >= 0) {
          await Serie.updateOne(
            { _id: existingSerie._id, 'episodes.season': targetSeason, 'episodes.episodeNumber': targetEpisode },
            { $set: { 'episodes.$.lien': bestSource.streamUrl, 'episodes.$.episode': canonicalEp } }
          );
        } else {
          await Serie.updateOne(
            { _id: existingSerie._id },
            { $push: { episodes: epData } }
          );
        }
      } else {
        const newSerie = await Serie.create({
          titre: request.title,
          pageUrl: '',
          episodes: [epData],
        });
        if (newSerie?._id) autoLink('series', newSerie._id.toString());
      }
    }
  } catch (dbErr: any) {
    console.error(`[RequestsService] Erreur insertion média dans Movies/Series:`, dbErr.message);
  }

  console.log(`[RequestsService] ✅ Demande comblée avec succès pour "${request.title}" via source "${bestSource.source}"`);
  return request;
}

/**
 * Récupère les demandes avec filtres pour l'admin
 */
export async function getAdminRequests(params: {
  status?: string;
  type?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(50, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const query: any = {};
  if (params.status && params.status !== 'all') {
    query.status = params.status;
  }
  if (params.type && params.type !== 'all') {
    query.type = params.type;
  }
  if (params.search) {
    query.title = { $regex: params.search, $options: 'i' };
  }

  const [items, total] = await Promise.all([
    MediaRequest.find(query).sort({ requestCount: -1, updatedAt: -1 }).skip(skip).limit(limit).lean(),
    MediaRequest.countDocuments(query),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Récupère les demandes faites par un utilisateur
 */
export async function getUserRequests(userId?: string, email?: string) {
  if (!userId && !email) return [];
  const query: any = {
    $or: [],
  };
  if (userId) query.$or.push({ 'requestedBy.userId': userId });
  if (email) query.$or.push({ 'requestedBy.email': email });

  return MediaRequest.find(query).sort({ createdAt: -1 }).limit(30).lean();
}

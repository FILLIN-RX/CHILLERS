import { Response } from 'express';
import mongoose from 'mongoose';
import tmdbClient from '../../config/tmdb';
import ProviderCatalogItem, { CatalogItemType, CatalogProvider, normalizeCatalogTitle } from '../../models/ProviderCatalogItem';
import { AuthRequest } from '../admin/admin.middleware';

const PAGE_SIZE = 30;
const VALID_TYPES: CatalogItemType[] = ['movie', 'tv', 'anime'];
const VALID_PROVIDERS: CatalogProvider[] = ['frenchstream', 'otaku', 'afroland'];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Liste paginée, admin seulement, des titres fournisseurs qui attendent un choix TMDB. */
export async function listUnmatched(req: AuthRequest, res: Response) {
  const type = VALID_TYPES.includes(req.query.type as CatalogItemType) ? req.query.type as CatalogItemType : undefined;
  const provider = VALID_PROVIDERS.includes(req.query.provider as CatalogProvider) ? req.query.provider as CatalogProvider : undefined;
  const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
  const q = String(req.query.q || '').trim();
  const filter: Record<string, any> = { active: true, matchStatus: 'unmatched' };
  if (type) filter.type = type;
  if (provider) filter.provider = provider;
  const normalized = normalizeCatalogTitle(q);
  if (normalized) filter.normalizedTitle = { $regex: new RegExp(escapeRegex(normalized), 'i') };

  const [items, total] = await Promise.all([
    ProviderCatalogItem.find(filter)
      .select('provider sourceId type title year description season pageUrl posterUrl language quality')
      // Priorité aux œuvres les plus récentes; les années inconnues restent
      // après celles datées, puis on départage par dernière apparition.
      .sort({ year: -1, lastSeenAt: -1, _id: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    ProviderCatalogItem.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: {
      items: items.map((item: any) => ({ ...item, id: String(item._id), _id: undefined })),
      total,
      page,
      limit: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    },
    message: null,
  });
}

/** Lie une fiche non résolue après sélection explicite de l'administrateur. */
export async function linkUnmatched(req: AuthRequest, res: Response) {
  const itemId = String(req.params.id || '');
  const tmdbId = Number(req.body?.tmdbId);
  const mediaType = req.body?.mediaType;
  const confirmYearMismatch = req.body?.confirmYearMismatch === true;

  if (!mongoose.isValidObjectId(itemId)) {
    res.status(400).json({ success: false, data: null, message: 'Fiche catalogue invalide.' });
    return;
  }
  if (!Number.isInteger(tmdbId) || tmdbId <= 0 || !['movie', 'tv'].includes(mediaType)) {
    res.status(400).json({ success: false, data: null, message: 'Sélection TMDB invalide.' });
    return;
  }

  const item = await ProviderCatalogItem.findOne({ _id: itemId, active: true, matchStatus: 'unmatched' }).lean();
  if (!item) {
    res.status(409).json({ success: false, data: null, message: 'Cette fiche a déjà été traitée ou n’est plus active. Actualise la liste.' });
    return;
  }
  if ((item.type === 'movie' && mediaType !== 'movie') || (item.type === 'tv' && mediaType !== 'tv')) {
    res.status(400).json({ success: false, data: null, message: `Une fiche ${item.type === 'movie' ? 'film' : 'série'} doit être liée au même type TMDB.` });
    return;
  }

  try {
    const { data } = await tmdbClient.get(`/${mediaType}/${tmdbId}`, { params: { language: 'fr-FR' } });
    if (data?.id !== tmdbId) {
      res.status(404).json({ success: false, data: null, message: 'Fiche TMDB introuvable.' });
      return;
    }

    const genreIds = (data.genres || []).map((genre: any) => Number(genre.id)).filter(Number.isFinite);
    if (item.type === 'anime' && !genreIds.includes(16)) {
      res.status(400).json({ success: false, data: null, message: 'Une fiche anime doit porter le genre Animation sur TMDB.' });
      return;
    }

    const rawYear = mediaType === 'movie' ? data.release_date : data.first_air_date;
    const tmdbYear = Number.parseInt(String(rawYear || '').slice(0, 4), 10) || undefined;
    const yearMismatch = Boolean(item.year && tmdbYear && Math.abs(item.year - tmdbYear) > 1);
    if (yearMismatch && !confirmYearMismatch) {
      res.status(409).json({
        success: false,
        data: { sourceYear: item.year, tmdbYear },
        message: `Années différentes (${item.year} / ${tmdbYear}). Confirme explicitement cette différence pour continuer.`,
      });
      return;
    }

    // Une série FrenchStream est publiée en fiches séparées (une par saison),
    // mais toutes partagent le même titre normalisé. Une liaison choisie sur
    // une saison doit donc être appliquée aux autres saisons non résolues.
    // On ne remplace jamais un match déjà existant.
    const matchFilter: Record<string, any> = {
      provider: item.provider,
      type: item.type,
      active: true,
      matchStatus: 'unmatched',
    };
    if (item.type === 'tv') {
      matchFilter.normalizedTitle = item.normalizedTitle;
    } else {
      matchFilter._id = item._id;
    }

    const result = await ProviderCatalogItem.updateMany(
      matchFilter,
      {
        $set: {
          tmdbId,
          card: { ...data, media_type: mediaType, genre_ids: genreIds },
          matchStatus: 'matched',
          matchMethod: 'manual',
          manualMatchBy: req.admin?.username || 'admin',
          manualMatchAt: new Date(),
        },
        $unset: { imdbId: '' },
      }
    );

    if (!result.modifiedCount) {
      res.status(409).json({ success: false, data: null, message: 'Cette fiche vient d’être modifiée. Actualise la liste.' });
      return;
    }

    res.json({
      success: true,
      data: { id: itemId, tmdbId, mediaType, tmdbYear, linkedCount: result.modifiedCount || 1 },
      message: 'Liaison manuelle enregistrée.',
    });
  } catch (error: any) {
    res.status(502).json({ success: false, data: null, message: error?.response?.data?.status_message || 'Recherche de la fiche TMDB impossible.' });
  }
}

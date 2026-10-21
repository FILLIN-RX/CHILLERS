import mongoose, { Schema, Document } from 'mongoose';
import { normalizeTitle } from '../utils/title-match';

export type CatalogProvider = 'frenchstream' | 'otaku' | 'afroland';
export type CatalogItemType = 'movie' | 'tv' | 'anime';
export type CatalogMatchStatus = 'pending' | 'matched' | 'unmatched';

/** Réponse brute d'un listing TMDB — même formes de champs, même côté client. */
export interface CatalogCard {
  id: number;
  media_type?: 'movie' | 'tv';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string;
  backdrop_path?: string;
  overview?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  genre_ids?: number[];
  [key: string]: unknown;
}

/**
 * Index de catalogue provider : ce que les sites proposent RÉELLEMENT,
 * scrapé en batch (cron GitHub Actions) et stocké en base.
 * L'app n'interroge jamais les providers en temps réel — elle lit cet index.
 */
export interface IProviderCatalogItem extends Document {
  provider: CatalogProvider;
  sourceId: string;
  type: CatalogItemType;
  title: string;
  normalizedTitle: string;
  year?: number;
  description?: string;
  season?: number;
  pageUrl: string;
  posterUrl?: string;
  language?: string;
  country?: string;
  quality?: string;
  imdbId?: string;
  tmdbId?: number;
  /**
   * Carte TMDB telle quelle (résultat de search/find, ou détail complet quand
   * le match vient de l'IMDb) : sert les rangées du catalogue sans TMDB.
   */
  card?: CatalogCard;
  matchStatus: CatalogMatchStatus;
  matchMethod?: 'search' | 'imdb' | 'manual';
  manualMatchBy?: string;
  manualMatchAt?: Date;
  active: boolean;
  firstSeenAt: Date;
  lastSeenAt: Date;
  missingCount: number;
}

const ProviderCatalogItemSchema: Schema = new Schema(
  {
    provider: { type: String, required: true, enum: ['frenchstream', 'otaku', 'afroland'], index: true },
    sourceId: { type: String, required: true },
    type: { type: String, required: true, enum: ['movie', 'tv', 'anime'], index: true },
    title: { type: String, required: true },
    normalizedTitle: { type: String, required: true, index: true },
    year: { type: Number },
    description: { type: String },
    season: { type: Number },
    pageUrl: { type: String, required: true },
    posterUrl: { type: String },
    language: { type: String },
    country: { type: String, index: true },
    quality: { type: String },
    imdbId: { type: String },
    tmdbId: { type: Number },
  card: {
    id: Number,
    media_type: String,
    title: String,
    name: String,
    original_title: String,
    original_name: String,
    poster_path: String,
    backdrop_path: String,
    overview: String,
    vote_average: Number,
    vote_count: Number,
    popularity: Number,
    release_date: String,
    first_air_date: String,
    original_language: String,
    genre_ids: [Number],
  },
    matchStatus: { type: String, enum: ['pending', 'matched', 'unmatched'], default: 'pending', index: true },
    matchMethod: { type: String, enum: ['search', 'imdb', 'manual'] },
    manualMatchBy: { type: String },
    manualMatchAt: { type: Date },
    active: { type: Boolean, default: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    missingCount: { type: Number, default: 0 },
  },
  { timestamps: false }
);

// Un item par (provider, sourceId) — le newsId du site source.
ProviderCatalogItemSchema.index({ provider: 1, sourceId: 1 }, { unique: true });
ProviderCatalogItemSchema.index({ tmdbId: 1 }, { sparse: true });
ProviderCatalogItemSchema.index({ provider: 1, type: 1, matchStatus: 1, active: 1 });
ProviderCatalogItemSchema.index({ matchStatus: 1, active: 1, firstSeenAt: 1 });

/**
 * Même normalisation que le rapprochement titre-TMDB du catalogue (title-match) :
 * deux implémentations qui divergent font un normalizedTitle introuvable par la
 * recherche, et un matching qui ne retombe pas sur les mêmes ids.
 */
export function normalizeCatalogTitle(value: string): string {
  return normalizeTitle(value);
}

export default mongoose.model<IProviderCatalogItem>('ProviderCatalogItem', ProviderCatalogItemSchema);

import type { MovieOrShow } from "@/types/media";

/**
 * Les tableaux passés aux composants clients de l'accueil sont sérialisés
 * intégralement dans le HTML (payload React Flight) : `synopsis` + `description`
 * sont les mêmes textes et représentaient ~59 % des octets envoyés, au prix
 * d'un LCP retardé (le balisage du hero arrive après des centaines de Ko de
 * props). On ne garde que ce que les rangées affichent réellement.
 *
 * La modale refait un `getMediaDetails` complet à l'ouverture, donc les champs
 * lourds (casting, saisons, similaires…) ne sont jamais lus depuis ces objets.
 */

type HeavyKey =
  | "synopsis"
  | "cast"
  | "castDetails"
  | "similar"
  | "seasons"
  | "networks"
  | "directors"
  | "creators"
  | "tagline"
  | "status"
  | "statusLabel"
  | "numberOfEpisodes"
  | "numberOfSeasons"
  | "contentRating"
  | "videoUrl";

const HEAVY_KEYS: readonly HeavyKey[] = [
  "synopsis",
  "cast",
  "castDetails",
  "similar",
  "seasons",
  "networks",
  "directors",
  "creators",
  "tagline",
  "status",
  "statusLabel",
  "numberOfEpisodes",
  "numberOfSeasons",
  "contentRating",
  "videoUrl",
];

/** Rangées de cartes : aucun texte long n'est affiché. */
export function trimRowItems<T extends MovieOrShow>(items: readonly T[] | undefined | null): T[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => trimItem(item, true));
}

/** Items visibles en grand (hero, spotlight, "le plus regardé") : garde `description`. */
export function trimShowcaseItems<T extends MovieOrShow>(items: readonly T[] | undefined | null): T[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => trimItem(item, false));
}

function trimItem<T extends MovieOrShow>(item: T, dropDescription: boolean): T {
  if (!item || typeof item !== "object") return item;
  const clone = { ...item } as Record<string, unknown>;
  for (const key of HEAVY_KEYS) delete clone[key];
  // `synopsis` est toujours retiré : il duplique `description`
  // (voir mapTMDBToMovieOrShow) et les composants lisent `synopsis || description`.
  delete clone.synopsis;
  if (dropDescription) delete clone.description;
  return clone as T;
}

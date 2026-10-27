export type OhaCategory = 'general' | 'sport' | 'cine' | 'kids' | 'musique';

export interface OhaEpgEntry {
  title: string;
  start: string;
  end: string;
}

export interface OhaSourceVariant {
  id: string;
  epgNow?: OhaEpgEntry;
  epgNext?: OhaEpgEntry;
}

export interface OhaChannel {
  id: string;
  altIds?: string[];
  sourceVariants?: OhaSourceVariant[];
  name: string;
  category: OhaCategory;
  tvg?: string;
  logo?: string | null;
  epgNow?: OhaEpgEntry;
  epgNext?: OhaEpgEntry;
  streamUrl?: string;
  epgUpdatedAt?: string;
  epgSource?: 'oha' | 'epgshare';
}

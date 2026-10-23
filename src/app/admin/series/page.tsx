'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { adminGetCollection } from '@/services/admin';
import { resolveImageUrl } from '@/services/http';
import { Alert, Button, Empty, Typography, message } from '@/components/admin/ui';
import { ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, FolderOpenOutlined, PlaySquareOutlined, ReloadOutlined, SearchOutlined } from '@/components/admin/icons';

const { Text } = Typography;
type Episode = { episode: string; season?: number; episodeNumber?: number; lien?: string; uqloadCode?: string; uqloadLink?: string; fileCode?: string; streamtapeCode?: string; streamtapeLink?: string };
type Serie = { _id: string; titre: string; pageUrl?: string; episodes: Episode[]; tmdbId?: number; createdAt?: string; year?: number; posterUrl?: string };
const PAGE_SIZE = 24;

export default function AdminSeries() {
  const [items, setItems] = useState<Serie[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setSearch(query.trim()); }, 250); return () => window.clearTimeout(timer); }, [query]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminGetCollection('series', search, page, PAGE_SIZE);
      if (!res.success || !res.data) throw new Error(res.message || 'Le catalogue séries n’a pas répondu.');
      const data = res.data as { items?: Serie[]; total?: number };
      setItems(data.items || []); setTotal(data.total || 0);
    } catch (cause) { const text = cause instanceof Error ? cause.message : 'Chargement des séries impossible.'; setError(text); message.error(text); }
    finally { setLoading(false); }
  }, [page, search]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const stats = useMemo(() => items.reduce((acc, serie) => {
    acc.episodes += serie.episodes?.length || 0;
    acc.linked += serie.tmdbId ? 1 : 0;
    acc.needsLinks += (serie.episodes || []).filter(ep => !ep.lien || ep.lien === '#' ? !(ep.uqloadCode || ep.uqloadLink || ep.fileCode || ep.streamtapeCode || ep.streamtapeLink) : false).length;
    return acc;
  }, { episodes: 0, linked: 0, needsLinks: 0 }), [items]);

  return <main className="catalog-page">
    <header className="catalog-heading series-heading">
      <div><Text className="catalog-eyebrow">BIBLIOTHÈQUE · ÉPISODIQUE</Text><h1>Séries</h1><p>Suivez la couverture des saisons, l’état des sources et la liaison de chaque fiche.</p></div>
      <div className="catalog-count"><PlaySquareOutlined /><div><strong>{total.toLocaleString('fr-FR')}</strong><span>séries au catalogue</span></div></div>
    </header>
    <section className="catalog-toolbar">
      <label className="catalog-search-wrap"><SearchOutlined /><input aria-label="Rechercher une série" placeholder="Rechercher une série…" value={query} onChange={event => setQuery(event.target.value)} /><button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')} hidden={!query}>×</button></label>
      <div className="catalog-toolbar-meta"><span><FolderOpenOutlined /> {stats.episodes} épisodes sur cette page</span><span><CloseCircleOutlined /> {stats.needsLinks} sans source</span><Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Actualiser</Button></div>
    </section>
    {error && <Alert type="error" showIcon message="Le catalogue n’a pas pu être chargé"><div className="catalog-alert-details">{error}<Button size="small" onClick={() => void load()}>Réessayer</Button></div></Alert>}
    {loading && !items.length ? <div className="catalog-loading"><span className="ad-spinner" /> Récupération du catalogue…</div> : !items.length ? <div className="catalog-empty"><Empty description={search ? 'Aucune série ne correspond à cette recherche.' : 'Aucune série dans le catalogue.'} /></div> : <>
      <section className="series-grid" aria-label="Séries du catalogue">{items.map(serie => {
        const episodes = serie.episodes || [];
        const missing = episodes.filter(ep => (!ep.lien || ep.lien === '#') && !(ep.uqloadCode || ep.uqloadLink || ep.fileCode || ep.streamtapeCode || ep.streamtapeLink)).length;
        const seasons = new Set(episodes.map(ep => ep.season).filter(Boolean)).size;
        const coverage = episodes.length ? Math.round(((episodes.length - missing) / episodes.length) * 100) : 0;
        return <article className="series-card" key={serie._id}>
          <div className="series-card-art">{serie.posterUrl ? <Image src={resolveImageUrl(serie.posterUrl)} alt="" fill sizes="(max-width: 580px) 45vw, (max-width: 950px) 30vw, 20vw" style={{ objectFit: 'cover' }} /> : <div className="movie-artwork-fallback"><PlaySquareOutlined /><span>SÉRIE</span></div>}<div className="series-card-art-shade" /><div className="series-card-pills"><span>{serie.year || 'Catalogue'}</span>{serie.tmdbId ? <span className="is-linked"><CheckCircleOutlined /> TMDB</span> : <span className="is-missing"><CloseCircleOutlined /> À lier</span>}</div><button type="button" className="series-card-open" aria-label={`Ouvrir ${serie.titre}`} onClick={() => router.push(`/admin/series/${serie._id}`)}><ArrowRightOutlined /></button></div>
          <div className="series-card-body"><div className="series-card-title"><h2 title={serie.titre}>{serie.titre}</h2><span>{seasons} saison{seasons > 1 ? 's' : ''}</span></div>
            <div className="series-card-stats"><div><strong>{episodes.length}</strong><span>épisodes</span></div><div><strong className={missing ? 'has-issue' : 'is-good'}>{missing}</strong><span>sans source</span></div><div><strong>{coverage}%</strong><span>couverture</span></div></div>
            <div className="series-progress"><span style={{ width: `${coverage}%` }} /></div>
            <button type="button" className="series-card-link" onClick={() => router.push(`/admin/series/${serie._id}`)}>Gérer les épisodes <ArrowRightOutlined /></button>
          </div>
        </article>;
      })}</section>
      {total > PAGE_SIZE && <div className="catalog-pagination"><span>{((page - 1) * PAGE_SIZE + 1).toLocaleString('fr-FR')}–{Math.min(page * PAGE_SIZE, total).toLocaleString('fr-FR')} sur {total.toLocaleString('fr-FR')}</span><div className="catalog-page-controls"><button type="button" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Précédent</button><span>{page} / {Math.ceil(total / PAGE_SIZE)}</span><button type="button" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(current => Math.min(Math.ceil(total / PAGE_SIZE), current + 1))}>Suivant</button></div></div>}
    </>}
  </main>;
}

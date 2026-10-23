'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { adminGetCollection } from '@/services/admin';
import { resolveImageUrl } from '@/services/http';
import TmdbLinkModal from '../components/TmdbLinkModal';
import { Alert, Button, Empty, Modal, Typography, message } from '@/components/admin/ui';
import { ArrowRightOutlined, CheckCircleOutlined, CloseCircleOutlined, PlayCircleOutlined, ReloadOutlined, SearchOutlined, VideoCameraOutlined } from '@/components/admin/icons';

const { Text } = Typography;
type Movie = { _id: string; titre: string; pageUrl?: string; lien?: string; tmdbId?: number; createdAt?: string; year?: number; posterUrl?: string; disponible?: boolean; uqloadCode?: string; uqloadLink?: string; fileCode?: string };
const PAGE_SIZE = 24;

export default function AdminMovies() {
  const [items, setItems] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linkModal, setLinkModal] = useState<Movie | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);

  useEffect(() => { const timer = window.setTimeout(() => { setPage(1); setSearch(query.trim()); }, 250); return () => window.clearTimeout(timer); }, [query]);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await adminGetCollection('movies', search, page, PAGE_SIZE);
      if (!res.success || !res.data) throw new Error(res.message || 'Le catalogue films n’a pas répondu.');
      const data = res.data as { items?: Movie[]; total?: number; page?: number };
      setItems(data.items || []); setTotal(data.total || 0);
    } catch (cause) { const text = cause instanceof Error ? cause.message : 'Chargement des films impossible.'; setError(text); message.error(text); }
    finally { setLoading(false); }
  }, [page, search]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  const stats = useMemo(() => ({ linked: items.filter(item => item.tmdbId).length, ready: items.filter(item => item.uqloadCode || item.uqloadLink || item.fileCode).length }), [items]);

  return <main className="catalog-page">
    <header className="catalog-heading">
      <div><Text className="catalog-eyebrow">BIBLIOTHÈQUE · CINÉMA</Text><h1>Films</h1><p>Un espace clair pour maintenir vos fiches prêtes à être découvertes.</p></div>
      <div className="catalog-count"><VideoCameraOutlined /><div><strong>{total.toLocaleString('fr-FR')}</strong><span>films au catalogue</span></div></div>
    </header>
    <section className="catalog-toolbar">
      <label className="catalog-search-wrap"><SearchOutlined /><input aria-label="Rechercher un film" placeholder="Rechercher un titre…" value={query} onChange={event => setQuery(event.target.value)} /><button type="button" aria-label="Effacer la recherche" onClick={() => setQuery('')} hidden={!query}>×</button></label>
      <div className="catalog-toolbar-meta"><span><CheckCircleOutlined /> {stats.linked} liés à TMDB sur cette page</span><span><PlayCircleOutlined /> {stats.ready} avec une source</span><Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Actualiser</Button></div>
    </section>
    {error && <Alert type="error" showIcon message="Le catalogue n’a pas pu être chargé"><div className="catalog-alert-details">{error}<Button size="small" onClick={() => void load()}>Réessayer</Button></div></Alert>}
    {loading && !items.length ? <div className="catalog-loading"><span className="ad-spinner" /> Récupération du catalogue…</div> : !items.length ? <div className="catalog-empty"><Empty description={search ? 'Aucun film ne correspond à cette recherche.' : 'Aucun film dans le catalogue.'} /></div> : <>
      <section className="movie-grid" aria-label="Films du catalogue">{items.map(movie => {
        const hasSource = Boolean(movie.uqloadCode || movie.uqloadLink || movie.fileCode);
        return <article className="movie-card" key={movie._id}>
          <div className="movie-artwork">{movie.posterUrl ? <Image src={resolveImageUrl(movie.posterUrl)} alt="" fill sizes="(max-width: 580px) 45vw, (max-width: 950px) 30vw, 20vw" style={{ objectFit: 'cover' }} /> : <div className="movie-artwork-fallback"><VideoCameraOutlined /><span>CHILLERS</span></div>}<div className="movie-artwork-shade" />{movie.year && <span className="movie-year">{movie.year}</span>}<button type="button" className="movie-play" aria-label={`Lire ${movie.titre}`} onClick={() => setPlayerUrl(`/watch/${movie.tmdbId || movie._id}?type=movie`)}><PlayCircleOutlined /></button></div>
          <div className="movie-card-content"><div className="movie-card-title-row"><h2 title={movie.titre}>{movie.titre}</h2><span className={`catalog-dot ${hasSource ? 'is-ready' : ''}`} title={hasSource ? 'Source vidéo renseignée' : 'Source vidéo absente'} /></div>
            <div className="movie-card-meta"><span>{movie.tmdbId ? <><CheckCircleOutlined /> TMDB lié</> : <><CloseCircleOutlined /> TMDB manquant</>}</span><span>{hasSource ? 'Disponible' : 'Source à ajouter'}</span></div>
            <div className="movie-card-actions"><Button size="small" onClick={() => setLinkModal(movie)}>{movie.tmdbId ? 'Modifier TMDB' : 'Lier à TMDB'}</Button><Button size="small" type="text" aria-label={`Ouvrir la fiche de ${movie.titre}`} onClick={() => setPlayerUrl(`/watch/${movie.tmdbId || movie._id}?type=movie`)} icon={<ArrowRightOutlined />} /></div>
          </div>
        </article>;
      })}</section>
      {total > PAGE_SIZE && <div className="catalog-pagination"><span>{((page - 1) * PAGE_SIZE + 1).toLocaleString('fr-FR')}–{Math.min(page * PAGE_SIZE, total).toLocaleString('fr-FR')} sur {total.toLocaleString('fr-FR')}</span><div className="catalog-page-controls"><button type="button" disabled={page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>Précédent</button><span>{page} / {Math.ceil(total / PAGE_SIZE)}</span><button type="button" disabled={page >= Math.ceil(total / PAGE_SIZE)} onClick={() => setPage(current => Math.min(Math.ceil(total / PAGE_SIZE), current + 1))}>Suivant</button></div></div>}
    </>}
    {linkModal && <TmdbLinkModal type="movies" docId={linkModal._id} currentTmdbId={linkModal.tmdbId} onClose={() => setLinkModal(null)} onLinked={tmdbId => { setItems(prev => prev.map(item => item._id === linkModal._id ? { ...item, tmdbId } : item)); setLinkModal(null); }} />}
    <Modal open={!!playerUrl} onCancel={() => setPlayerUrl(null)} footer={null} width="min(900px, 94vw)" styles={{ body: { padding: 0, height: 'min(70vh, 620px)' } }} destroyOnClose>{playerUrl && <iframe title="Aperçu du film" src={playerUrl} style={{ width: '100%', height: '100%', border: 0 }} allowFullScreen />}</Modal>
  </main>;
}

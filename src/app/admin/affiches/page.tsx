'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  adminAffichesList,
  adminAffichesGenerate,
  adminAffichesStatus,
  adminAvailabilityScan,
  adminAvailabilityStatus,
  adminAffichesCardUrl,
  resolveImageUrl,
  AfficheItem,
} from '@/app/api';

interface JobProgress {
  running: boolean;
  total: number;
  processed: number;
  ok: number;
  ko: number;
  lastMessage: string;
  errors: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  tmdb: 'TMDB',
  web: 'Web',
  ai: 'IA',
  none: 'Aucune',
};

export default function AdminAffiches() {
  const [items, setItems] = useState<AfficheItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'all' | 'movie' | 'series'>('all');
  const [disponible, setDisponible] = useState('');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [scanProgress, setScanProgress] = useState<JobProgress | null>(null);
  const [genProgress, setGenProgress] = useState<JobProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminAffichesList({
      type,
      disponible: disponible === '' ? undefined : disponible === 'true',
      source: source || undefined,
      q: searchInput || undefined,
      page,
      limit: 50,
    });
    if (res.success) {
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    }
    setLoading(false);
  }, [type, disponible, source, searchInput, page]);

  // Charge la liste affiches + statut des jobs. Pattern identique à
  // dead-links/page.tsx : fetch serveur puis mise à jour de l'état.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const pollStatus = useCallback(async () => {
    const [scan, gen] = await Promise.all([adminAvailabilityStatus(), adminAffichesStatus()]);
    if (scan.success) setScanProgress(scan.data);
    if (gen.success) setGenProgress(gen.data);
  }, []);

  useEffect(() => {
    const t = setTimeout(pollStatus, 0);
    pollRef.current = setInterval(pollStatus, 2500);
    return () => { clearTimeout(t); if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollStatus]);

  const handleScan = async () => {
    setMessage(null);
    const res = await adminAvailabilityScan('all');
    setMessage(res.message || (res.success ? 'Scan lancé' : 'Erreur'));
  };

  const handleGenerateAll = async () => {
    setMessage(null);
    const res = await adminAffichesGenerate({ type: 'all' });
    setMessage(res.message || (res.success ? 'Génération lancée' : 'Erreur'));
  };

  const handleGenerateOne = async (item: AfficheItem) => {
    setMessage(null);
    const res = await adminAffichesGenerate({ type: item.mediaType, id: item._id });
    setMessage(res.message || (res.success ? 'Affiche générée' : 'Erreur'));
    if (res.success) load();
  };

  const handleCopyLink = async (item: AfficheItem) => {
    if (!item.link) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${item.link}`);
      setCopiedId(item._id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setMessage('Copie impossible');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 50));

  return (
    <div>
      <style>{`
        .affiches-table { width: 100%; border-collapse: collapse; }
        .affiches-table th { text-align: left; color: #888; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; padding: 0.75rem 1rem; background: #2a2a2a; }
        .affiches-table td { padding: 0.75rem 1rem; border-bottom: 1px solid #2a2a2a; color: #ccc; font-size: 0.8125rem; vertical-align: middle; }
      `}</style>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Affiches & Partage
          <span style={{ color: '#6b6b80', fontSize: '0.875rem', fontWeight: 400, marginLeft: '0.5rem' }}>
            {total} titres
          </span>
        </h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleScan} disabled={scanProgress?.running}
            style={{ padding: '0.5rem 1rem', background: scanProgress?.running ? '#555' : '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: scanProgress?.running ? 'default' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
            {scanProgress?.running ? 'Scan en cours...' : '🔍 Scan disponibilité'}
          </button>
          <button onClick={handleGenerateAll} disabled={genProgress?.running}
            style={{ padding: '0.5rem 1rem', background: genProgress?.running ? '#555' : '#22c55e', color: '#000', border: 'none', borderRadius: 8, cursor: genProgress?.running ? 'default' : 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>
            {genProgress?.running ? 'Génération en cours...' : '✨ Générer tout (affiches + speech)'}
          </button>
        </div>
      </div>

      {message && (
        <div style={{ background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 8, padding: '0.75rem 1rem', color: '#a5b4fc', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {message}
        </div>
      )}

      {(scanProgress?.running || genProgress?.running) && (
        <div style={{ background: '#0d0d1a', border: '1px solid #2a2a4e', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: '0.8125rem', marginBottom: '0.5rem' }}>
            <span>{scanProgress?.running ? 'Scan' : 'Génération'} en cours...</span>
            <span>{scanProgress?.processed ?? genProgress?.processed ?? 0} / {scanProgress?.total ?? genProgress?.total ?? 0}</span>
          </div>
          <div style={{ height: 6, background: '#1e1e2a', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${((scanProgress?.processed || 0) / Math.max(1, scanProgress?.total || 1)) * 100}%`,
              background: '#6366f1', transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ color: '#6b6b80', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            {scanProgress?.lastMessage || genProgress?.lastMessage}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={type} onChange={e => { setType(e.target.value as 'all' | 'movie' | 'series'); setPage(1); }}
          style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '0.8125rem' }}>
          <option value="all">Tous</option>
          <option value="movie">Films</option>
          <option value="series">Séries</option>
        </select>

        <select value={disponible} onChange={e => { setDisponible(e.target.value); setPage(1); }}
          style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '0.8125rem' }}>
          <option value="">Disponibilité: tous</option>
          <option value="true">Disponible</option>
          <option value="false">Indisponible</option>
        </select>

        <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }}
          style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '0.8125rem' }}>
          <option value="">Source: toutes</option>
          <option value="tmdb">TMDB</option>
          <option value="web">Web</option>
          <option value="ai">IA</option>
          <option value="none">Aucune</option>
        </select>

        <form onSubmit={e => { e.preventDefault(); setSearchInput(q); setPage(1); }} style={{ display: 'flex', gap: '0.5rem', flex: 1, minWidth: 200 }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un titre..."
            style={{ flex: 1, padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #333', background: '#1a1a1a', color: '#fff', fontSize: '0.8125rem', outline: 'none' }} />
          <button type="submit" style={{ padding: '0.5rem 1rem', background: '#333', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.8125rem' }}>
            Chercher
          </button>
        </form>
      </div>

      {loading ? (
        <p style={{ color: '#888' }}>Chargement...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#888' }}>Aucun titre trouvé</p>
      ) : (
        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'auto' }}>
          <table className="affiches-table">
            <thead>
              <tr>
                <th style={{ width: 70 }}>Affiche</th>
                <th>Titre</th>
                <th style={{ width: 90 }}>Source</th>
                <th style={{ width: 110 }}>Dispo</th>
                <th>Speech</th>
                <th style={{ width: 250 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={`${item.mediaType}-${item._id}`}>
                  <td>
                    {item.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={resolveImageUrl(item.posterUrl)} alt={item.titre}
                        style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 6, border: '1px solid #333', display: 'block' }} />
                    ) : (
                      <div style={{ width: 44, height: 66, borderRadius: 6, background: '#2a2a2a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.625rem', color: '#666' }}>
                        Aucune
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ color: '#fff', fontWeight: 600 }}>{item.titre}</div>
                    <div style={{ color: '#6b6b80', fontSize: '0.75rem' }}>
                      {item.mediaType === 'movie' ? 'Film' : 'Série'}{item.year ? ` · ${item.year}` : ''}
                    </div>
                  </td>
                  <td>
                    <span style={{
                      padding: '0.25rem 0.5rem', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
                      background: item.posterSource === 'tmdb' ? 'rgba(99,102,241,0.2)' : item.posterSource === 'web' ? 'rgba(34,197,94,0.2)' : item.posterSource === 'ai' ? 'rgba(168,85,247,0.2)' : 'rgba(100,100,120,0.2)',
                      color: item.posterSource === 'tmdb' ? '#a5b4fc' : item.posterSource === 'web' ? '#22c55e' : item.posterSource === 'ai' ? '#c084fc' : '#888',
                    }}>
                      {SOURCE_LABELS[item.posterSource || 'none']}
                    </span>
                  </td>
                  <td>
                    {item.disponible === null || item.disponible === undefined ? (
                      <span style={{ color: '#888' }}>—</span>
                    ) : item.disponible ? (
                      <span style={{ color: '#22c55e', fontWeight: 700 }}>● Disponible</span>
                    ) : (
                      <span style={{ color: '#ef4444', fontWeight: 700 }}>● Non dispo</span>
                    )}
                  </td>
                  <td style={{ color: '#9a9ab0', fontSize: '0.75rem', lineHeight: 1.5, maxWidth: 320 }}>
                    {item.speech ? (
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.speech}</span>
                    ) : (
                      <span style={{ color: '#555' }}>Aucun speech — générer</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <button onClick={() => handleGenerateOne(item)} disabled={genProgress?.running}
                          style={{ padding: '0.3rem 0.5rem', background: genProgress?.running ? '#555' : '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: genProgress?.running ? 'default' : 'pointer', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                          ✨ Générer
                        </button>
                        <a href={adminAffichesCardUrl(item._id, item.mediaType)} download
                          style={{ padding: '0.3rem 0.5rem', background: '#22c55e', color: '#000', border: 'none', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          🖼 Carte
                        </a>
                        <a href={`/api/affiches/${item._id}/poster?type=${item.mediaType}`} download target="_blank" rel="noreferrer"
                          style={{ padding: '0.3rem 0.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, fontSize: '0.7rem', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          ⬇ Affiche
                        </a>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                        {item.link && (
                          <a href={item.link} target="_blank" rel="noreferrer"
                            style={{ color: '#a5b4fc', fontSize: '0.7rem', textDecoration: 'underline', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {item.link}
                          </a>
                        )}
                        {item.link && (
                          <button onClick={() => handleCopyLink(item)}
                            style={{ padding: '0.25rem 0.5rem', background: copiedId === item._id ? '#22c55e' : '#333', color: copiedId === item._id ? '#000' : '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                            {copiedId === item._id ? '✓ Copié' : 'Copier'}
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
          style={{ padding: '0.4rem 0.9rem', background: page <= 1 ? '#2a2a2a' : '#333', color: '#fff', border: 'none', borderRadius: 8, cursor: page <= 1 ? 'default' : 'pointer', fontSize: '0.8125rem' }}>
          ← Précédent
        </button>
        <span style={{ color: '#888', fontSize: '0.8125rem' }}>Page {page} / {totalPages}</span>
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
          style={{ padding: '0.4rem 0.9rem', background: page >= totalPages ? '#2a2a2a' : '#333', color: '#fff', border: 'none', borderRadius: 8, cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '0.8125rem' }}>
          Suivant →
        </button>
      </div>
    </div>
  );
}

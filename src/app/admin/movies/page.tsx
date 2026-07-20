'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminGetCollection, startDownload, triggerDownload } from '@/app/api';
import TmdbLinkModal from '../components/TmdbLinkModal';

interface Movie {
  _id: string;
  titre: string;
  pageUrl: string;
  lien: string;
  tmdbId?: number;
  createdAt: string;
  uqloadCode?: string;
  uqloadLink?: string;
  fileCode?: string;
}

export default function AdminMovies() {
  const [items, setItems] = useState<Movie[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{ docId: string; tmdbId?: number } | null>(null);
  const limit = 50;

  const fetch = useCallback(async (search: string, p: number) => {
    setLoading(true);
    try {
      const res = await adminGetCollection('movies', search, p, limit);
      if (res.success) {
        setItems(res.data.items);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
        setPage(res.data.page);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(q, page); }, [fetch, q, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetch(q, 1);
  };

  const inputStyle: React.CSSProperties = {
    padding: '0.625rem',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#222',
    color: '#fff',
    fontSize: '0.875rem',
    flex: 1,
  };

  return (
    <div>
      <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>
        Films ({total})
      </h1>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          placeholder="Rechercher un film..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={inputStyle}
        />
        <button type="submit" style={{ padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>
          Rechercher
        </button>
      </form>

      {loading ? (
        <p style={{ color: '#888' }}>Chargement...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#888' }}>Aucun film trouvé</p>
      ) : (
        <>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a', color: '#888', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Titre</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>TMDB</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Uqload</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>DoodStream</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Lien</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Ajouté</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(m => (
                  <tr key={m._id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#fff' }}>{m.titre}</td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <button onClick={() => setLinkModal({ docId: m._id, tmdbId: m.tmdbId })} style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        color: m.tmdbId ? '#22c55e' : '#ef4444', fontSize: '0.75rem', textDecoration: 'underline',
                        textDecorationColor: m.tmdbId ? '#22c55e' : '#ef4444',
                      }}>
                        {m.tmdbId ? `✓ ${m.tmdbId}` : '✗ Lier'}
                      </button>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span style={{ color: m.uqloadCode ? '#22c55e' : '#6b6b80', fontSize: '0.75rem' }}>
                        {m.uqloadCode ? '✓' : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span style={{ color: m.fileCode ? '#22c55e' : '#6b6b80', fontSize: '0.75rem' }}>
                        {m.fileCode ? '✓' : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <a href={m.lien} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'none', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {m.lien.substring(0, 60)}...
                      </a>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#888', fontSize: '0.75rem' }}>
                      {new Date(m.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                        <a
                          href={m.lien && m.lien !== '#' ? m.lien : `/watch/${m.tmdbId || m._id}?type=movie`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Lire"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 8, border: 'none',
                            background: '#1a1a2e', color: '#6366f1', cursor: 'pointer', fontSize: '0.875rem',
                            textDecoration: 'none',
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3" />
                          </svg>
                        </a>
                        <button
                          onClick={async () => {
                            setDownloadingId(m._id);
                            try {
                              const result = await startDownload(m.tmdbId ? String(m.tmdbId) : m._id, 'movie', m.titre);
                              if (result?.downloadUrl) {
                                triggerDownload(result.downloadUrl, `${m.titre}.mp4`);
                              }
                            } catch { } finally { setDownloadingId(null); }
                          }}
                          disabled={downloadingId === m._id}
                          title="Télécharger"
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 32, height: 32, borderRadius: 8, border: 'none',
                            background: '#1a1a2e', color: '#22c55e', cursor: downloadingId === m._id ? 'default' : 'pointer',
                            fontSize: '0.875rem', opacity: downloadingId === m._id ? 0.5 : 1,
                          }}
                        >
                          {downloadingId === m._id ? (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                          ) : (
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #333', background: '#222', color: page <= 1 ? '#555' : '#fff', cursor: page <= 1 ? 'default' : 'pointer', fontSize: '0.8125rem' }}>
                ←
              </button>
              <span style={{ color: '#888', padding: '0.5rem', fontSize: '0.8125rem' }}>
                {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #333', background: '#222', color: page >= totalPages ? '#555' : '#fff', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '0.8125rem' }}>
                →
              </button>
            </div>
          )}
        </>
      )}

      {linkModal && (
        <TmdbLinkModal
          type="movies"
          docId={linkModal.docId}
          currentTmdbId={linkModal.tmdbId}
          onClose={() => setLinkModal(null)}
          onLinked={(tmdbId) => {
            setItems(prev => prev.map(it => it._id === linkModal.docId ? { ...it, tmdbId } : it));
            setLinkModal(null);
          }}
        />
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminGetCollection } from '@/app/api';
import { IconFolder } from '@/components/Icons';

interface Serie {
  _id: string;
  titre: string;
  pageUrl: string;
  episodes: { episode: string; lien: string }[];
  tmdbId?: number;
  createdAt: string;
}

export default function AdminSeries() {
  const [items, setItems] = useState<Serie[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const limit = 50;

  const fetch = useCallback(async (search: string, p: number) => {
    setLoading(true);
    try {
      const res = await adminGetCollection('series', search, p, limit);
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
    padding: '0.625rem 0.875rem',
    borderRadius: 10,
    border: '1px solid #2a2a3a',
    background: '#181825',
    color: '#fff',
    fontSize: '0.875rem',
    flex: 1,
    outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Séries <span style={{ color: '#6b6b80', fontSize: '1rem', fontWeight: 400 }}>({total})</span>
        </h1>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          placeholder="Rechercher une série..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={inputStyle}
        />
        <button type="submit" style={{ padding: '0.625rem 1.25rem', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600 }}>
          Rechercher
        </button>
      </form>

      {loading ? (
        <p style={{ color: '#6b6b80' }}>Chargement...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#6b6b80' }}>Aucune série trouvée</p>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
            {items.map(s => {
              const deadCount = s.episodes.filter(e => !e.lien || e.lien === '#').length;
              const tmdbOk = !!s.tmdbId;
              return (
                <div
                  key={s._id}
                  onClick={() => router.push(`/admin/series/${s._id}`)}
                  style={{
                    background: '#181825',
                    border: '1px solid #252535',
                    borderRadius: 14,
                    padding: '1.125rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#1c1c2e'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#252535'; e.currentTarget.style.background = '#181825'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <span style={{ flexShrink: 0, marginRight: '0.75rem', color: '#6366f1', display: 'flex' }}>
                      <IconFolder />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h3 style={{ color: '#fff', fontSize: '0.9375rem', fontWeight: 600, margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.titre}
                      </h3>
                    </div>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      padding: '0.2rem 0.5rem',
                      borderRadius: 6,
                      background: tmdbOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                      color: tmdbOk ? '#22c55e' : '#ef4444',
                      flexShrink: 0,
                    }}>
                      {tmdbOk ? 'TMDB' : '—'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem' }}>
                    <div>
                      <p style={{ color: '#6b6b80', margin: 0, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Épisodes</p>
                      <p style={{ color: '#fff', margin: '0.125rem 0 0 0', fontWeight: 600 }}>{s.episodes.length}</p>
                    </div>
                    <div>
                      <p style={{ color: '#6b6b80', margin: 0, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liens morts</p>
                      <p style={{ color: deadCount > 0 ? '#ef4444' : '#22c55e', margin: '0.125rem 0 0 0', fontWeight: 600 }}>
                        {deadCount > 0 ? `${deadCount}` : '0'}
                      </p>
                    </div>
                    <div>
                      <p style={{ color: '#6b6b80', margin: 0, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouté</p>
                      <p style={{ color: '#aaa', margin: '0.125rem 0 0 0' }}>{new Date(s.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '2rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #2a2a3a', background: '#181825', color: page <= 1 ? '#3a3a4a' : '#fff', cursor: page <= 1 ? 'default' : 'pointer', fontSize: '0.8125rem' }}>
                ←
              </button>
              <span style={{ color: '#6b6b80', padding: '0.5rem', fontSize: '0.8125rem' }}>
                {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '0.5rem 1rem', borderRadius: 8, border: '1px solid #2a2a3a', background: '#181825', color: page >= totalPages ? '#3a3a4a' : '#fff', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '0.8125rem' }}>
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

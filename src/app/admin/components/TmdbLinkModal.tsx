'use client';

import { useState, useEffect, useRef } from 'react';
import { searchMedia, adminLinkTmdb } from '@/app/api';

interface TmdbSearchResult {
  id: string;
  title: string;
  type: string;
  year: number;
  posterUrl: string;
  genres: string[];
}

interface TmdbLinkModalProps {
  type: 'movies' | 'series';
  docId: string;
  currentTmdbId?: number | null;
  onClose: () => void;
  onLinked: (tmdbId: number) => void;
}

export default function TmdbLinkModal({ type, docId, currentTmdbId, onClose, onLinked }: TmdbLinkModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchMedia(query, 1);
        const filtered = data
          .filter(r => r.type === (type === 'movies' ? 'movie' : 'series') && !isNaN(Number(r.id)) && Number(r.id) > 0)
          .slice(0, 8)
          .map(r => ({ id: r.id, title: r.title, type: r.type, year: r.year, posterUrl: r.posterUrl, genres: r.genres }));
        setResults(filtered);
      } catch { } finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, type]);

  const handleLink = async (tmdbId: number) => {
    setLinking(true);
    try {
      const res = await adminLinkTmdb(type, docId, tmdbId);
      if (res.success) {
        onLinked(tmdbId);
        onClose();
      }
    } catch { } finally { setLinking(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div style={{
        background: '#1a1a2e', border: '1px solid #2a2a4e', borderRadius: 16,
        padding: '1.5rem', width: 520, maxWidth: '90vw', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ color: '#fff', fontSize: '1.125rem', margin: 0 }}>
            Lier à TMDB
          </h2>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#6b6b80', cursor: 'pointer',
            fontSize: '1.25rem', padding: '0.25rem',
          }}>✕</button>
        </div>

        <input
          ref={inputRef}
          placeholder="Rechercher sur TMDB..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            padding: '0.75rem', borderRadius: 10, border: '1px solid #333', background: '#111',
            color: '#fff', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box',
            outline: 'none', marginBottom: '1rem',
          }}
        />

        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {loading ? (
            <p style={{ color: '#6b6b80', textAlign: 'center', padding: '2rem' }}>Recherche...</p>
          ) : results.length === 0 ? (
            <p style={{ color: '#6b6b80', textAlign: 'center', padding: '2rem' }}>
              {query ? 'Aucun résultat' : 'Tapez un titre pour chercher'}
            </p>
          ) : (
            results.map(r => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem',
                borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s',
                background: Number(r.id) === currentTmdbId ? '#1a3a2e' : 'transparent',
              }}
                onMouseEnter={e => { if (Number(r.id) !== currentTmdbId) e.currentTarget.style.background = '#222'; }}
                onMouseLeave={e => { if (Number(r.id) !== currentTmdbId) e.currentTarget.style.background = 'transparent'; }}
                onClick={() => handleLink(Number(r.id))}
              >
                <img src={r.posterUrl} alt="" style={{ width: 40, height: 60, borderRadius: 6, objectFit: 'cover', background: '#222' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.title}
                  </div>
                  <div style={{ color: '#6b6b80', fontSize: '0.75rem' }}>
                    {r.year} · {r.genres.slice(0, 2).join(', ')}
                  </div>
                </div>
                {Number(r.id) === currentTmdbId ? (
                  <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: 600 }}>LIÉ</span>
                ) : (
                  <span style={{ color: '#6366f1', fontSize: '0.75rem', fontWeight: 600 }}>
                    {linking ? '...' : 'Lier'}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

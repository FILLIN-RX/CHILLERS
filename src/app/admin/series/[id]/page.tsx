'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminGetSerie, startDownload, triggerDownload } from '@/app/api';
import { IconFolderOpen, IconBack } from '@/components/Icons';

interface Episode {
  episode: string;
  season: number;
  episodeNumber: number;
  lien: string;
  fileCode?: string;
  fldId?: string;
  tmdbId?: number;
}

interface SerieDetail {
  _id: string;
  titre: string;
  pageUrl: string;
  episodes: Episode[];
  tmdbId?: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminSerieDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [serie, setSerie] = useState<SerieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingEp, setDownloadingEp] = useState<string | null>(null);

  useEffect(() => {
    adminGetSerie(id).then(res => {
      if (res.success) setSerie(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return <p style={{ color: '#6b6b80' }}>Chargement...</p>;
  if (!serie) return <p style={{ color: '#ef4444' }}>Série introuvable</p>;

  const grouped: Record<number, Episode[]> = {};
  for (const ep of serie.episodes) {
    if (!grouped[ep.season]) grouped[ep.season] = [];
    grouped[ep.season].push(ep);
  }

  const deadCount = serie.episodes.filter(e => !e.lien || e.lien === '#').length;

  return (
    <div>
      <button
        onClick={() => router.push('/admin/series')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.375rem',
          padding: '0.375rem 0.75rem',
          borderRadius: 8,
          border: '1px solid #2a2a3a',
          background: '#181825',
          color: '#6b6b80',
          fontSize: '0.8125rem',
          cursor: 'pointer',
          marginBottom: '1rem',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#222235'; e.currentTarget.style.color = '#fff'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#181825'; e.currentTarget.style.color = '#6b6b80'; }}
      >
        <IconBack /> Retour aux séries
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ flexShrink: 0, color: '#6366f1', display: 'flex' }}>
          <IconFolderOpen />
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>{serie.titre}</h1>
          <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.5rem', fontSize: '0.8125rem' }}>
            <span style={{ color: '#6b6b80' }}>
              <span style={{ color: '#aaa' }}>{serie.episodes.length}</span> épisodes
            </span>
            <span style={{ color: '#6b6b80' }}>
              <span style={{ color: '#aaa' }}>{Object.keys(grouped).length}</span> saisons
            </span>
            <span style={{ color: deadCount > 0 ? '#ef4444' : '#22c55e' }}>
              {deadCount > 0 ? `${deadCount} lien(s) mort(s)` : '✓ tous OK'}
            </span>
            {serie.tmdbId && (
              <span style={{ color: '#22c55e' }}>✓ Lié TMDB (#{serie.tmdbId})</span>
            )}
          </div>
          <a href={serie.pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', fontSize: '0.8125rem', textDecoration: 'none', marginTop: '0.25rem', display: 'inline-block' }}>
            Voir sur open-otaku.me →
          </a>
        </div>
      </div>

      {Object.entries(grouped)
        .sort(([a], [b]) => Number(b) - Number(a))
        .map(([season, eps]) => (
          <div key={season} style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              Saison {season}
              <span style={{ color: '#6b6b80', fontWeight: 400, fontSize: '0.8125rem', marginLeft: '0.5rem' }}>
                ({eps.length} épisodes)
              </span>
            </h2>
            <div style={{ background: '#181825', border: '1px solid #252535', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #252535', color: '#6b6b80', textTransform: 'uppercase', fontSize: '0.6875rem', letterSpacing: '0.05em' }}>
                    <th style={{ padding: '0.625rem 1rem', textAlign: 'left' }}>Épisode</th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: 'left' }}>Lien</th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: 'left' }}>Doodstream</th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: 'left' }}>TMDB</th>
                    <th style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {eps
                    .sort((a, b) => a.episodeNumber - b.episodeNumber)
                    .map((ep, i) => {
                      const isDead = !ep.lien || ep.lien === '#';
                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #1e1e2e' }}>
                          <td style={{ padding: '0.625rem 1rem', color: '#fff', fontWeight: 500 }}>{ep.episode}</td>
                          <td style={{ padding: '0.625rem 1rem' }}>
                            {isDead ? (
                              <span style={{ color: '#ef4444', fontSize: '0.75rem' }}>✗ Mort</span>
                            ) : (
                              <a href={ep.lien} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'none', fontSize: '0.75rem' }}>
                                Voir le lien
                              </a>
                            )}
                          </td>
                          <td style={{ padding: '0.625rem 1rem' }}>
                            <span style={{ color: ep.fileCode ? '#22c55e' : '#6b6b80', fontSize: '0.75rem' }}>
                              {ep.fileCode ? '✓ Uploadé' : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '0.625rem 1rem' }}>
                            <span style={{ color: ep.tmdbId ? '#22c55e' : '#6b6b80', fontSize: '0.75rem' }}>
                              {ep.tmdbId ? '✓ Lié' : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '0.625rem 1rem', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center' }}>
                              <a
                                href={isDead ? (ep.tmdbId || serie.tmdbId ? `/watch/${ep.tmdbId || serie.tmdbId}?type=tv` : '#') : ep.lien}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Lire"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: 30, height: 30, borderRadius: 6, border: 'none',
                                  background: '#1a1a2e', color: isDead ? '#444' : '#6366f1',
                                  cursor: isDead ? 'default' : 'pointer', fontSize: '0.8125rem',
                                  opacity: isDead ? 0.3 : 1, textDecoration: 'none',
                                  pointerEvents: isDead ? 'none' : 'auto',
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                              </a>
                              <button
                                onClick={async () => {
                                  setDownloadingEp(ep.episode);
                                  try {
                                    const result = await startDownload(
                                      ep.tmdbId ? String(ep.tmdbId) : serie._id,
                                      'series',
                                      serie.titre,
                                      ep.season,
                                      ep.episodeNumber,
                                    );
                                    if (result?.downloadUrl) {
                                      triggerDownload(result.downloadUrl, `${serie.titre}-${ep.episode}.mp4`);
                                    }
                                  } catch { } finally { setDownloadingEp(null); }
                                }}
                                disabled={downloadingEp === ep.episode || isDead}
                                title="Télécharger"
                                style={{
                                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                  width: 30, height: 30, borderRadius: 6, border: 'none',
                                  background: '#1a1a2e', color: isDead ? '#444' : '#22c55e',
                                  cursor: (downloadingEp === ep.episode || isDead) ? 'default' : 'pointer',
                                  fontSize: '0.8125rem', opacity: (downloadingEp === ep.episode || isDead) ? 0.3 : 1,
                                }}
                              >
                                {downloadingEp === ep.episode ? (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                  </svg>
                                ) : (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

    </div>
  );
}

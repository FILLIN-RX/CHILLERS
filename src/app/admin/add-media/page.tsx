'use client';

import { useId, useRef, useState } from 'react';
import { adminCreateManualMedia, adminCreateManualMediaUpload, adminTmdbSearch } from '@/app/api';

interface SeasonGroup {
  season: string;
  episodes: { episodeNumber: string; lien: string; file: File | null }[];
}

interface TmdbCandidate {
  id: number;
  title: string;
  year: number | null;
  poster: string | null;
}

const card: React.CSSProperties = { background: '#181825', border: '1px solid #252535', borderRadius: 12, padding: '1.25rem' };
const label: React.CSSProperties = { display: 'block', color: '#6b6b80', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' };
const input: React.CSSProperties = { width: '100%', background: '#1f1f2e', border: '1px solid #252535', borderRadius: 8, padding: '0.6rem 0.75rem', color: '#fff', fontSize: '0.875rem', outline: 'none' };
const btnBase: React.CSSProperties = { padding: '0.55rem 1.1rem', borderRadius: 8, border: 'none', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s ease', color: '#fff' };
const sectionTitle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 700, margin: 0, color: '#e4e4f0', display: 'flex', alignItems: 'center', gap: '0.5rem' };
const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: '50%', background: '#6366f1', flexShrink: 0 };

function newSeason(season = ''): SeasonGroup {
  return { season, episodes: [{ episodeNumber: '', lien: '', file: null }] };
}

function FilePicker({ file, onSelect, onClear, labelText = 'Choisir un fichier' }: {
  file: File | null;
  onSelect: (f: File | null) => void;
  onClear?: () => void;
  labelText?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', minWidth: 0 }}>
      <input
        ref={ref}
        id={id}
        type="file"
        accept="video/*"
        style={{ display: 'none' }}
        onChange={e => onSelect(e.target.files?.[0] || null)}
      />
      <label
        htmlFor={id}
        style={{
          flex: 1, minWidth: 0, background: '#1f1f2e', border: '1px solid #252535', borderRadius: 8,
          padding: '0.5rem 0.75rem', color: file ? '#4ade80' : '#9d9db5', fontSize: '0.8125rem',
          cursor: 'pointer', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transition: 'border-color 0.15s ease',
        }}
        title={file ? file.name : labelText}
      >
        {file ? `🎬 ${file.name}` : labelText}
      </label>
      {file && (
        <button
          type="button"
          onClick={() => { onSelect(null); onClear?.(); if (ref.current) ref.current.value = ''; }}
          style={{ ...btnBase, background: '#ef4444', padding: '0.45rem 0.6rem', fontSize: '0.8rem', flexShrink: 0 }}
          title="Retirer le fichier"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function AdminAddMedia() {
  const [type, setType] = useState<'movie' | 'serie'>('movie');
  const [titre, setTitre] = useState('');
  const [lien, setLien] = useState('');
  const [movieFile, setMovieFile] = useState<File | null>(null);
  const [tmdbId, setTmdbId] = useState('');
  const [year, setYear] = useState('');
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbCandidate | null>(null);
  const [seasons, setSeasons] = useState<SeasonGroup[]>([newSeason('1')]);

  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<TmdbCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [searched, setSearched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; upload?: string } | null>(null);

  const switchType = (t: 'movie' | 'serie') => {
    setType(t);
    setTmdbResults([]);
    setSearched(false);
    setSearchMsg('');
    setSelectedTmdb(null);
    setTmdbId('');
  };

  const searchTmdb = async () => {
    if (!tmdbQuery.trim() || tmdbQuery.trim().length < 2) return;
    setSearching(true);
    setSearchMsg('');
    setSearched(false);
    try {
      const res = await adminTmdbSearch(tmdbQuery.trim(), type === 'serie' ? 'tv' : 'movie', year ? parseInt(year, 10) : undefined);
      setSearched(true);
      if (res.success) {
        setTmdbResults(res.data);
        if (res.data.length === 0) setSearchMsg('Aucun résultat sur TMDB');
      } else {
        setSearchMsg(res.message || 'Erreur recherche TMDB');
      }
    } catch {
      setSearchMsg('Erreur réseau pendant la recherche');
    } finally {
      setSearching(false);
    }
  };

  const pickTmdb = (c: TmdbCandidate) => {
    setTmdbId(String(c.id));
    setSelectedTmdb(c);
    setTitre(prev => prev || c.title);
    if (c.year && !year) setYear(String(c.year));
    setTmdbResults([]);
    setSearched(false);
    setSearchMsg('');
  };

  const addSeason = () => {
    const next = seasons.length + 1;
    setSeasons(prev => [...prev, newSeason(String(next))]);
  };

  const updateSeason = (sIdx: number, season: string) => {
    setSeasons(prev => prev.map((s, i) => (i === sIdx ? { ...s, season } : s)));
  };

  const updateEpisode = (sIdx: number, eIdx: number, patch: Partial<SeasonGroup['episodes'][0]>) => {
    setSeasons(prev => prev.map((s, i) => (i === sIdx ? { ...s, episodes: s.episodes.map((ep, j) => (j === eIdx ? { ...ep, ...patch } : ep)) } : s)));
  };

  const addEpisode = (sIdx: number) => {
    setSeasons(prev => prev.map((s, i) => (i === sIdx ? { ...s, episodes: [...s.episodes, { episodeNumber: '', lien: '', file: null }] } : s)));
  };

  const removeEpisode = (sIdx: number, eIdx: number) => {
    setSeasons(prev => prev.map((s, i) => (i === sIdx ? { ...s, episodes: s.episodes.filter((_, j) => j !== eIdx) } : s)));
  };

  const removeSeason = (sIdx: number) => {
    setSeasons(prev => prev.filter((_, i) => i !== sIdx));
  };

  const validateCommon = (): string | null => {
    if (!titre.trim()) return 'Le titre est requis';
    if (!tmdbId.trim() || isNaN(parseInt(tmdbId, 10))) return 'Le TMDB ID est requis (utilise la recherche TMDB)';
    return null;
  };

  const submit = async () => {
    setResult(null);
    const err = validateCommon();
    if (err) { setResult({ success: false, message: err }); return; }

    const common: { type: 'movie' | 'serie'; titre: string; tmdbId: number; year?: number } = { type, titre: titre.trim(), tmdbId: parseInt(tmdbId, 10) };
    if (year && !isNaN(parseInt(year, 10))) common.year = parseInt(year, 10);

    if (type === 'movie') {
      if (!lien.trim() && !movieFile) { setResult({ success: false, message: 'Ajoute un lien direct ou sélectionne un fichier vidéo' }); return; }
      setSubmitting(true);
      try {
        const res = movieFile
          ? await adminCreateManualMediaUpload(movieFormData(common))
          : await adminCreateManualMedia({ ...common, lien: lien.trim() });
        handleResult(res);
      } catch {
        setResult({ success: false, message: 'Erreur réseau lors de la création' });
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const flat = seasons.flatMap(s => s.episodes.map(ep => ({ ...ep, season: s.season })));
    const valid = flat.filter(ep => ep.episodeNumber && (ep.lien.trim() || ep.file));
    if (valid.length === 0) { setResult({ success: false, message: 'Ajoute au moins un épisode (numéro + lien ou fichier)' }); return; }
    if (valid.some(ep => !ep.season)) { setResult({ success: false, message: 'Chaque saison doit avoir un numéro' }); return; }

    const hasFiles = valid.some(ep => ep.file);
    setSubmitting(true);
    try {
      const res = hasFiles
        ? await adminCreateManualMediaUpload(serieFormData(common, valid))
        : await adminCreateManualMedia({
            ...common,
            episodes: valid.map(ep => ({ season: parseInt(ep.season, 10), episodeNumber: parseInt(ep.episodeNumber, 10), lien: ep.lien.trim() })),
          });
      handleResult(res);
    } catch {
      setResult({ success: false, message: 'Erreur réseau lors de la création' });
    } finally {
      setSubmitting(false);
    }
  };

  const movieFormData = (common: { type: 'movie' | 'serie'; titre: string; tmdbId: number; year?: number }) => {
    const fd = new FormData();
    fd.append('type', common.type);
    fd.append('titre', common.titre);
    fd.append('tmdbId', String(common.tmdbId));
    if (common.year) fd.append('year', String(common.year));
    fd.append('files', movieFile as File);
    return fd;
  };

  const serieFormData = (common: { type: 'movie' | 'serie'; titre: string; tmdbId: number; year?: number }, episodes: { episodeNumber: string; lien: string; file: File | null; season: string }[]) => {
    const fd = new FormData();
    fd.append('type', common.type);
    fd.append('titre', common.titre);
    fd.append('tmdbId', String(common.tmdbId));
    if (common.year) fd.append('year', String(common.year));
    fd.append('episodesMeta', JSON.stringify(episodes.map(ep => ({
      season: parseInt(ep.season, 10),
      episodeNumber: parseInt(ep.episodeNumber, 10),
      ...(ep.lien.trim() ? { lien: ep.lien.trim() } : {}),
    }))));
    episodes.forEach(ep => { if (ep.file) fd.append('files', ep.file); });
    return fd;
  };

  const handleResult = (res: { success: boolean; message?: string; data?: { upload?: { message?: string } } }) => {
    if (res.success) {
      setResult({ success: true, message: res.message || 'Créé avec succès', upload: res.data?.upload?.message });
      setTitre(''); setLien(''); setTmdbId(''); setYear(''); setMovieFile(null); setSelectedTmdb(null);
      setSeasons([newSeason('1')]);
    } else {
      setResult({ success: false, message: res.message || 'Erreur lors de la création' });
    }
  };

  const episodeCount = seasons.reduce((acc, s) => acc + s.episodes.length, 0);

  return (
    <div style={{ padding: '1.5rem 2rem', color: '#fff', maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Ajouter un média</h1>
          <p style={{ color: '#6b6b80', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            Film ou série — lien direct ou fichier vidéo, upload Uqload lancé automatiquement
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', background: '#1f1f2e', border: '1px solid #252535', borderRadius: 10, padding: '0.25rem' }}>
          {(['movie', 'serie'] as const).map(t => (
            <button
              key={t}
              onClick={() => switchType(t)}
              style={{ ...btnBase, padding: '0.5rem 1.25rem', background: type === t ? '#6366f1' : 'transparent', borderRadius: 8 }}
            >
              {t === 'movie' ? '🎬 Film' : '📺 Série'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* ── Informations ── */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: '1rem' }}>
            <span style={dot} /> Informations
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={label}>Titre</label>
              <input style={input} value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre du film / de la série" />
            </div>
            <div>
              <label style={label}>Année</label>
              <input style={input} value={year} onChange={e => setYear(e.target.value)} placeholder="2024" inputMode="numeric" />
            </div>
            <div>
              <label style={label}>TMDB ID</label>
              <input style={input} value={tmdbId} onChange={e => setTmdbId(e.target.value)} placeholder="ex: 12345" inputMode="numeric" />
            </div>
          </div>
          {selectedTmdb && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.75rem', background: '#1f1f2e', border: '1px solid #22c55e55', borderRadius: 8, padding: '0.5rem 0.75rem' }}>
              {selectedTmdb.poster ? (
                <img src={selectedTmdb.poster} alt="" style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 4 }} />
              ) : (
                <div style={{ width: 32, height: 48, background: '#252535', borderRadius: 4 }} />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4ade80' }}>✓ {selectedTmdb.title}{selectedTmdb.year ? ` (${selectedTmdb.year})` : ''}</div>
                <div style={{ fontSize: '0.75rem', color: '#6b6b80' }}>TMDB ID: {selectedTmdb.id}</div>
              </div>
              <button
                onClick={() => { setSelectedTmdb(null); setTmdbId(''); }}
                style={{ marginLeft: 'auto', ...btnBase, background: '#252535', padding: '0.35rem 0.7rem', fontSize: '0.75rem' }}
              >
                Retirer
              </button>
            </div>
          )}
          {type === 'movie' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem', alignItems: 'end' }}>
              <div>
                <label style={label}>Lien direct (vidéo)</label>
                <input style={input} value={lien} onChange={e => setLien(e.target.value)} placeholder="https://... mp4 ou lien direct" />
              </div>
              <div>
                <label style={label}>Ou fichier vidéo (prioritaire)</label>
                <FilePicker file={movieFile} onSelect={setMovieFile} labelText="Choisir un fichier vidéo..." />
              </div>
            </div>
          )}
        </div>

        {/* ── Recherche TMDB ── */}
        <div style={card}>
          <div style={{ ...sectionTitle, marginBottom: '1rem' }}>
            <span style={dot} /> Recherche TMDB
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              style={input}
              value={tmdbQuery}
              onChange={e => setTmdbQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') searchTmdb(); }}
              placeholder={`Chercher un ${type === 'movie' ? 'film' : 'série'} sur TMDB...`}
            />
            <button onClick={searchTmdb} disabled={searching} style={{ ...btnBase, background: '#252535', whiteSpace: 'nowrap', minWidth: 110 }}>
              {searching ? 'Recherche...' : '🔍 Rechercher'}
            </button>
          </div>
          {searching && <p style={{ color: '#6b6b80', fontSize: '0.8125rem', margin: '0.6rem 0 0 0' }}>Recherche en cours...</p>}
          {!searching && searched && searchMsg && <p style={{ color: '#fca5a5', fontSize: '0.8125rem', margin: '0.6rem 0 0 0' }}>{searchMsg}</p>}
          {tmdbResults.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
              {tmdbResults.map(c => (
                <button
                  key={c.id}
                  onClick={() => pickTmdb(c)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#1f1f2e',
                    border: '1px solid #252535', borderRadius: 10, padding: '0.5rem 0.75rem', cursor: 'pointer', color: '#fff', textAlign: 'left',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#23233a'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#252535'; e.currentTarget.style.background = '#1f1f2e'; }}
                >
                  {c.poster ? (
                    <img src={c.poster} alt="" style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: 44, height: 66, background: '#252535', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b4b63', fontSize: '1.2rem' }}>?</div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</div>
                    <div style={{ color: '#6b6b80', fontSize: '0.75rem', marginTop: '0.15rem' }}>ID: {c.id}{c.year ? ` — ${c.year}` : ''}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Épisodes par saison ── */}
        {type === 'serie' && (
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ ...sectionTitle }}>
                <span style={dot} /> Épisodes par saison
                <span style={{ background: '#252535', borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.72rem', color: '#9d9db5', fontWeight: 600 }}>
                  {seasons.length} saison{seasons.length > 1 ? 's' : ''} · {episodeCount} épisode{episodeCount > 1 ? 's' : ''}
                </span>
              </div>
              <button onClick={addSeason} style={{ ...btnBase, background: '#6366f1' }}>+ Ajouter une saison</button>
            </div>

            <div style={{ display: 'grid', gap: '1rem' }}>
              {seasons.map((s, sIdx) => (
                <div key={sIdx} style={{ background: '#1f1f2e', border: '1px solid #252535', borderRadius: 10, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span style={{ background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: '0.78rem', borderRadius: 8, padding: '0.25rem 0.6rem' }}>
                        S{s.season || '?'}
                      </span>
                      <input
                        style={{ ...input, width: 60, padding: '0.4rem 0.6rem' }}
                        value={s.season}
                        onChange={e => updateSeason(sIdx, e.target.value)}
                        placeholder="N°"
                        inputMode="numeric"
                        title="Numéro de saison"
                      />
                      <span style={{ color: '#6b6b80', fontSize: '0.8rem' }}>
                        {s.episodes.length} épisode{s.episodes.length > 1 ? 's' : ''}
                        {s.episodes.filter(ep => ep.file).length > 0 && ` · ${s.episodes.filter(ep => ep.file).length} fichier(s)`}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button onClick={() => addEpisode(sIdx)} style={{ ...btnBase, background: '#22c55e', padding: '0.4rem 0.9rem' }}>+ Épisode</button>
                      {seasons.length > 1 && (
                        <button onClick={() => removeSeason(sIdx)} style={{ ...btnBase, background: '#ef4444', padding: '0.4rem 0.9rem' }}>Suppr. saison</button>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1.1fr) minmax(0, 1fr) 36px', gap: '0.5rem', marginBottom: '0.4rem', padding: '0 0.25rem' }}>
                    <span style={{ ...label, margin: 0 }}>N°</span>
                    <span style={{ ...label, margin: 0 }}>Lien direct (optionnel)</span>
                    <span style={{ ...label, margin: 0 }}>Fichier vidéo (optionnel)</span>
                    <span />
                  </div>

                  <div style={{ display: 'grid', gap: '0.55rem' }}>
                    {s.episodes.map((ep, eIdx) => (
                      <div key={eIdx} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1.1fr) minmax(0, 1fr) 36px', gap: '0.5rem', alignItems: 'center' }}>
                        <input
                          style={{ ...input, padding: '0.5rem 0.6rem', textAlign: 'center' }}
                          placeholder="1"
                          value={ep.episodeNumber}
                          onChange={e => updateEpisode(sIdx, eIdx, { episodeNumber: e.target.value })}
                          inputMode="numeric"
                        />
                        <input
                          style={{ ...input, padding: '0.5rem 0.6rem' }}
                          placeholder="https://... lien direct"
                          value={ep.lien}
                          onChange={e => updateEpisode(sIdx, eIdx, { lien: e.target.value })}
                        />
                        <FilePicker
                          file={ep.file}
                          onSelect={f => updateEpisode(sIdx, eIdx, { file: f })}
                          labelText="Choisir un fichier..."
                        />
                        <button
                          onClick={() => removeEpisode(sIdx, eIdx)}
                          disabled={s.episodes.length === 1}
                          style={{ ...btnBase, background: '#ef4444', padding: '0.45rem 0', fontSize: '0.9rem', opacity: s.episodes.length === 1 ? 0.4 : 1 }}
                          title="Supprimer l'épisode"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p style={{ color: '#6b6b80', fontSize: '0.75rem', margin: '0.85rem 0 0 0' }}>
              Chaque épisode : un lien direct ou un fichier vidéo (le fichier est prioritaire). Les lignes sans numéro, lien ou fichier sont ignorées.
            </p>
          </div>
        )}
      </div>

      {/* ── Submit ── */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button onClick={submit} disabled={submitting} style={{ ...btnBase, background: '#6366f1', fontSize: '0.9rem', padding: '0.65rem 1.6rem' }}>
          {submitting ? 'Création en cours...' : type === 'movie' ? '➕ Ajouter le film' : '➕ Ajouter la série'}
        </button>
        {result && (
          <div style={{ ...card, padding: '0.75rem 1rem', flex: 1, borderColor: result.success ? '#22c55e55' : '#ef444455' }}>
            <div style={{ color: result.success ? '#4ade80' : '#fca5a5', fontSize: '0.875rem', fontWeight: 600 }}>{result.message}</div>
            {result.upload && <div style={{ color: '#6b6b80', fontSize: '0.8125rem', marginTop: '0.25rem' }}>{result.upload}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

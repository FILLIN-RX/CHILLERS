'use client';

import { useEffect, useState } from 'react';
import { adminCreateManualMedia, adminCreateManualMediaUpload, adminTmdbSearch } from '@/services/admin';
import {
  Card, Input, Button, Space, Typography, Alert, Segmented, Upload, Tag, Divider,
} from '@/components/admin/ui';
import {
  SearchOutlined, PlusOutlined, DeleteOutlined, CloseOutlined,
  VideoCameraOutlined, PlaySquareOutlined,   UploadOutlined, FileOutlined,
} from '@/components/admin/icons';
import type { UploadFile } from '@/components/admin/ui';

const { Title, Text } = Typography;

interface SeasonGroup {
  season: string;
  episodes: { episodeNumber: string; lien: string; file: File | null }[];
}

interface TmdbCandidate {
  id: number;
  title: string;
  year: number | null;
  poster: string | null;
  overview?: string;
}

function newSeason(season = ''): SeasonGroup {
  return { season, episodes: [{ episodeNumber: '', lien: '', file: null }] };
}

function FilePicker({ file, onSelect, labelText = 'Choisir un fichier' }: {
  file: File | null;
  onSelect: (f: File | null) => void;
  labelText?: React.ReactNode;
}) {
  const fileList: UploadFile[] = file
    ? [{ uid: '-1', name: file.name, status: 'done' }]
    : [];
  return (
    <Upload
      accept="video/*"
      maxCount={1}
      fileList={fileList}
      beforeUpload={(f: File) => { onSelect(f); return false; }}
      onRemove={() => onSelect(null)}
    >
      <Button icon={<UploadOutlined />} block>
        {labelText}
      </Button>
    </Upload>
  );
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '1rem', color: '#f1edf0' }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F42A7C', flexShrink: 0 }} />
    {children}
  </div>
);

export default function AdminAddMedia() {
  const [type, setType] = useState<'movie' | 'serie'>('movie');
  const [titre, setTitre] = useState('');
  const [lien, setLien] = useState('');
  const [movieFile, setMovieFile] = useState<File | null>(null);
  const [tmdbId, setTmdbId] = useState('');
  const [year, setYear] = useState('');
  const [synopsis, setSynopsis] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [backdropUrl, setBackdropUrl] = useState('');
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [backdropFile, setBackdropFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [audioLanguage, setAudioLanguage] = useState('VF');
  const [quality, setQuality] = useState('HD');
  const [sourceName, setSourceName] = useState('Direct');
  const [isPremium, setIsPremium] = useState(false);
  const [selectedTmdb, setSelectedTmdb] = useState<TmdbCandidate | null>(null);
  const [seasons, setSeasons] = useState<SeasonGroup[]>([newSeason('1')]);

  const [tmdbQuery, setTmdbQuery] = useState('');
  const [tmdbResults, setTmdbResults] = useState<TmdbCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchMsg, setSearchMsg] = useState('');
  const [searched, setSearched] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; upload?: string; catalogUrl?: string } | null>(null);

  useEffect(() => {
    const suggestedTitle = new URLSearchParams(window.location.search).get('q');
    if (!suggestedTitle) return;
    const timer = window.setTimeout(() => { setTitre(suggestedTitle); setTmdbQuery(suggestedTitle); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const switchType = (t: 'movie' | 'serie') => {
    setType(t);
    setTmdbResults([]);
    setSearched(false);
    setSearchMsg('');
    setSelectedTmdb(null);
    setTmdbId('');
    setSynopsis(''); setPosterUrl(''); setBackdropUrl('');
    setPosterFile(null); setBackdropFile(null); setStep(0);
  };

  const searchTmdb = async () => {
    if (!tmdbQuery.trim() || tmdbQuery.trim().length < 2) return;
    setSearching(true);
    setSearchMsg('');
    setSearched(false);
    try {
      const res = await adminTmdbSearch(tmdbQuery.trim(), type === 'serie' ? 'tv' : 'movie', year ? parseInt(year, 10) : undefined);
      setSearched(true);
      if (res.success && res.data) {
        const candidates: TmdbCandidate[] = res.data.map((r) => ({
          id: r.id,
          title: r.title || r.name || '',
          year: r.release_date || r.first_air_date
            ? parseInt((r.release_date || r.first_air_date || '').slice(0, 4), 10)
            : null,
          poster: r.poster_path ? `https://image.tmdb.org/t/p/w200${r.poster_path}` : null,
          overview: r.overview || '',
        }));
        setTmdbResults(candidates);
        if (candidates.length === 0) setSearchMsg('Aucun résultat sur TMDB');
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
    setTitre(c.title);
    setYear(c.year ? String(c.year) : '');
    setSynopsis(c.overview || '');
    setPosterUrl(c.poster ? c.poster.replace('/w200', '/w500') : '');
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
    const metadata = { synopsis, posterUrl, backdropUrl, langueAudio: audioLanguage, quality, source: sourceName, isPremium };
    if (year && !isNaN(parseInt(year, 10))) common.year = parseInt(year, 10);

    if (type === 'movie') {
      if (!lien.trim() && !movieFile) { setResult({ success: false, message: 'Ajoute un lien direct ou sélectionne un fichier vidéo' }); return; }
      setSubmitting(true);
      try {
        const res = movieFile || posterFile || backdropFile
          ? await adminCreateManualMediaUpload(movieFormData(common, metadata))
          : await adminCreateManualMedia({ ...common, ...metadata, lien: lien.trim() });
        handleResult(res, type === 'movie' ? `/media/${tmdbId}` : `/tv/${tmdbId}`);
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

    const hasFiles = valid.some(ep => ep.file) || !!posterFile || !!backdropFile;
    setSubmitting(true);
    try {
      const res = hasFiles
        ? await adminCreateManualMediaUpload(serieFormData(common, valid, metadata))
        : await adminCreateManualMedia({
          ...common,
          ...metadata,
          episodes: valid.map(ep => ({ season: parseInt(ep.season, 10), episodeNumber: parseInt(ep.episodeNumber, 10), lien: ep.lien.trim(), langueAudio: audioLanguage, quality, source: sourceName, isPremium })),
        });
      handleResult(res, `/tv/${tmdbId}`);
    } catch {
      setResult({ success: false, message: 'Erreur réseau lors de la création' });
    } finally {
      setSubmitting(false);
    }
  };

  const movieFormData = (common: { type: 'movie' | 'serie'; titre: string; tmdbId: number; year?: number }, metadata: { synopsis: string; posterUrl: string; backdropUrl: string; langueAudio: string; quality: string; source: string; isPremium: boolean }) => {
    const fd = new FormData();
    fd.append('type', common.type);
    fd.append('titre', common.titre);
    fd.append('tmdbId', String(common.tmdbId));
    if (common.year) fd.append('year', String(common.year));
    Object.entries(metadata).forEach(([key, value]) => fd.append(key, String(value)));
    if (lien.trim()) fd.append('lien', lien.trim());
    if (movieFile) fd.append('files', movieFile);
    if (posterFile) fd.append('poster', posterFile);
    if (backdropFile) fd.append('backdrop', backdropFile);
    return fd;
  };

  const serieFormData = (common: { type: 'movie' | 'serie'; titre: string; tmdbId: number; year?: number }, episodes: { episodeNumber: string; lien: string; file: File | null; season: string }[], metadata: { synopsis: string; posterUrl: string; backdropUrl: string; langueAudio: string; quality: string; source: string; isPremium: boolean }) => {
    const fd = new FormData();
    fd.append('type', common.type);
    fd.append('titre', common.titre);
    fd.append('tmdbId', String(common.tmdbId));
    if (common.year) fd.append('year', String(common.year));
    Object.entries(metadata).forEach(([key, value]) => fd.append(key, String(value)));
    fd.append('episodesMeta', JSON.stringify(episodes.map(ep => ({
      season: parseInt(ep.season, 10),
      episodeNumber: parseInt(ep.episodeNumber, 10),
      ...(!ep.file && ep.lien.trim() ? { lien: ep.lien.trim() } : {}),
      langueAudio: audioLanguage, quality, source: sourceName, isPremium,
    }))));
    episodes.forEach(ep => { if (ep.file) fd.append('files', ep.file); });
    if (posterFile) fd.append('poster', posterFile);
    if (backdropFile) fd.append('backdrop', backdropFile);
    return fd;
  };

  const handleResult = (res: { success: boolean; message?: string; data?: unknown }, catalogUrl: string) => {
    if (res.success) {
      const uploadInfo = (res.data && typeof res.data === "object" && "upload" in res.data
        ? (res.data as { upload?: { message?: string } }).upload?.message
        : undefined) as string | undefined;
      setResult({ success: true, message: res.message || 'Créé avec succès', upload: uploadInfo, catalogUrl });
      setTitre(''); setLien(''); setTmdbId(''); setYear(''); setSynopsis(''); setPosterUrl(''); setBackdropUrl(''); setPosterFile(null); setBackdropFile(null); setMovieFile(null); setSelectedTmdb(null); setIsPremium(false); setStep(0);
      setSeasons([newSeason('1')]);
    } else {
      setResult({ success: false, message: res.message || 'Erreur lors de la création' });
    }
  };

  const episodeCount = seasons.reduce((acc, s) => acc + s.episodes.length, 0);

  return (
    <div className="publish-page" style={{ maxWidth: 1180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Ajouter un média</Title>
          <Text type="secondary">Film ou série — lien direct ou fichier vidéo, upload Uqload lancé automatiquement</Text>
        </div>
        <Segmented
          value={type}
          onChange={(v) => switchType(v as unknown as 'movie' | 'serie')}
          options={[
            { label: <Space size={4}><VideoCameraOutlined /> Film</Space>, value: 'movie' },
            { label: <Space size={4}><PlaySquareOutlined /> Série</Space>, value: 'serie' },
          ]}
        />
      </div>

      <nav className="publish-steps" aria-label="Étapes de publication">
        {['Fiche', 'Vidéo', 'Vérification'].map((label, index) => (
          <button type="button" key={label} className={step === index ? 'is-current' : step > index ? 'is-done' : ''} onClick={() => index <= step && setStep(index)}>
            <span>{step > index ? '✓' : `0${index + 1}`}</span><b>{label}</b>
          </button>
        ))}
      </nav>
      <Space orientation="vertical" size="large" style={{ width: '100%', marginBottom: '1.25rem' }}>
        {step === 0 && <>
        <Card size="small">
          <SectionTitle>Informations</SectionTitle>
          <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Titre</Text>
                <Input value={titre} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitre(e.target.value)} placeholder="Titre du film / de la série" />
              </div>
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Année</Text>
                <Input value={year} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setYear(e.target.value)} placeholder="2024" inputMode="numeric" />
              </div>
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>TMDB ID</Text>
                <Input value={tmdbId} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTmdbId(e.target.value)} placeholder="ex: 12345" inputMode="numeric" />
              </div>
            </div>
            <div className="publish-metadata-grid">
              <label className="publish-field publish-field-wide">Résumé catalogue
                <textarea value={synopsis} onChange={e => setSynopsis(e.target.value)} maxLength={1500} rows={4} placeholder="Le résumé TMDB se remplit après la sélection. Modifie-le si besoin." />
              </label>
              <label className="publish-field">Affiche
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => setPosterFile(e.target.files?.[0] || null)} />
                <small>{posterFile?.name || (posterUrl ? 'Affiche TMDB sélectionnée · choisissez un fichier pour la remplacer' : 'Image JPEG, PNG, WebP ou AVIF')}</small>
              </label>
              <label className="publish-field">Image de couverture
                <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e => setBackdropFile(e.target.files?.[0] || null)} />
                <small>{backdropFile?.name || 'Optionnelle · image large'}</small>
              </label>
              <label className="publish-field">Langue audio
                <select value={audioLanguage} onChange={e => setAudioLanguage(e.target.value)}><option>VF</option><option>VFF</option><option>VFQ</option><option>VO</option><option>VOSTFR</option></select>
              </label>
              <label className="publish-field">Qualité
                <select value={quality} onChange={e => setQuality(e.target.value)}><option>HD</option><option>4K</option><option>1080p</option><option>720p</option><option>SD</option></select>
              </label>
              <label className="publish-field">Source
                <input value={sourceName} onChange={e => setSourceName(e.target.value)} placeholder="Direct, Uqload…" />
              </label>
              <label className="publish-premium"><input type="checkbox" checked={isPremium} onChange={e => setIsPremium(e.target.checked)} /> Contenu réservé aux abonnés premium</label>
            </div>
            <div className="publish-preview" aria-live="polite">
              {posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={posterUrl} alt={`Affiche de ${titre || 'votre média'}`} />
              ) : <div className="publish-preview-poster">CHILLERS</div>}
              <div className="publish-preview-copy">
                <span className="publish-preview-kicker">APERÇU CATALOGUE · {type === 'movie' ? 'FILM' : 'SÉRIE'}</span>
                <strong>{titre || 'Le titre apparaîtra ici'}</strong>
                <div className="publish-preview-tags"><span>{year || 'Année TMDB'}</span><span>{audioLanguage}</span><span>{quality}</span>{isPremium && <span>PREMIUM</span>}</div>
                <p>{synopsis || 'Le résumé du média sera affiché sur sa fiche catalogue.'}</p>
                {type === 'serie' && <small>{seasons.length} saison(s) · {episodeCount} épisode(s) renseigné(s)</small>}
              </div>
            </div>
            {selectedTmdb && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: '#f9f7f4', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 8, padding: '0.5rem 0.75rem',
              }}>
                {selectedTmdb.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedTmdb.poster} alt="" style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 32, height: 48, background: '#f2f4f7', borderRadius: 4 }} />
                )}
                <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#34d399' }}>✓ {selectedTmdb.title}{selectedTmdb.year ? ` (${selectedTmdb.year})` : ''}</div>
                  <Text type="secondary" style={{ fontSize: 12 }}>TMDB ID: {selectedTmdb.id}</Text>
                </div>
                <Button size="small" style={{ marginLeft: 'auto' }} icon={<CloseOutlined />} onClick={() => { setSelectedTmdb(null); setTmdbId(''); }}>
                  Retirer
                </Button>
              </div>
            )}
          </Space>
        </Card>

        <Card size="small">
          <SectionTitle>Recherche TMDB</SectionTitle>
          <Space.Compact style={{ width: '100%', maxWidth: 600 }}>
            <Input
              value={tmdbQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTmdbQuery(e.target.value)}
              onPressEnter={searchTmdb}
              placeholder={`Chercher un ${type === 'movie' ? 'film' : 'série'} sur TMDB...`}
            />
            <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={searchTmdb}>
              Rechercher
            </Button>
          </Space.Compact>
          {searching && <Text type="secondary" style={{ display: 'block', marginTop: '0.6rem', fontSize: 13 }}>Recherche en cours...</Text>}
          {!searching && searched && searchMsg && <Text type="danger" style={{ display: 'block', marginTop: '0.6rem', fontSize: 13 }}>{searchMsg}</Text>}
          {tmdbResults.length > 0 && (
            <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0.5rem' }}>
              {tmdbResults.map(c => (
                <Button
                  key={c.id}
                  type="text"
                  onClick={() => pickTmdb(c)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', height: 'auto',
                    background: '#f9f7f4', border: '1px solid #e3e8ef', borderRadius: 10,
                    padding: '0.5rem 0.75rem', color: '#172033', textAlign: 'left',
                  }}
                >
                  {c.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.poster} alt="" style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: 44, height: 66, background: '#f2f4f7', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5466', fontSize: '1.2rem' }}>?</div>
                  )}
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.title}</span>
                    <Text type="secondary" style={{ fontSize: 12 }}>ID: {c.id}{c.year ? ` — ${c.year}` : ''}</Text>
                  </span>
                </Button>
              ))}
            </div>
          )}
        </Card>
        </>}

        {step === 1 && type === 'movie' && <Card size="small">
          <SectionTitle>Source vidéo</SectionTitle>
          <div className="publish-video-grid">
            <label className="publish-field">Lien direct
              <input value={lien} onChange={e => setLien(e.target.value)} placeholder="https://…" />
            </label>
            <label className="publish-field">Fichier vidéo · prioritaire sur le lien
              <FilePicker file={movieFile} onSelect={setMovieFile} labelText="Choisir une vidéo…" />
            </label>
          </div>
          <p className="publish-help">Renseigne un lien ou sélectionne un fichier vidéo.</p>
        </Card>}

        {step === 1 && type === 'serie' && (
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <SectionTitle>
                Épisodes par saison
                <Tag style={{ marginInlineStart: 8 }}>{seasons.length} saison{seasons.length > 1 ? 's' : ''} · {episodeCount} épisode{episodeCount > 1 ? 's' : ''}</Tag>
              </SectionTitle>
              <Button type="primary" icon={<PlusOutlined />} onClick={addSeason}>Ajouter une saison</Button>
            </div>

            <Space orientation="vertical" size="large" style={{ width: '100%' }}>
              {seasons.map((s, sIdx) => (
                <div key={sIdx} style={{ background: '#f9f7f4', border: '1px solid #e3e8ef', borderRadius: 10, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <Space size="middle">
                      <Tag color="primary" style={{ fontWeight: 700, fontSize: 13 }}>S{s.season || '?'}</Tag>
                      <Input
                        style={{ width: 60 }}
                        value={s.season}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateSeason(sIdx, e.target.value)}
                        placeholder="N°"
                        inputMode="numeric"
                        title="Numéro de saison"
                      />
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        {s.episodes.length} épisode{s.episodes.length > 1 ? 's' : ''}
                        {s.episodes.filter(ep => ep.file).length > 0 && ` · ${s.episodes.filter(ep => ep.file).length} fichier(s)`}
                      </Text>
                    </Space>
                    <Space>
                      <Button size="small" icon={<PlusOutlined />} onClick={() => addEpisode(sIdx)}>Épisode</Button>
                      {seasons.length > 1 && (
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeSeason(sIdx)}>Suppr. saison</Button>
                      )}
                    </Space>
                  </div>

                  <Divider style={{ margin: '0.25rem 0 0.75rem' }} />

                  <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1.1fr) minmax(0, 1fr) 36px', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>N°</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>Lien direct (optionnel)</Text>
                    <Text type="secondary" style={{ fontSize: 11 }}>Fichier vidéo (optionnel)</Text>
                    <span />
                  </div>

                  <Space orientation="vertical" size={8} style={{ width: '100%' }}>
                    {s.episodes.map((ep, eIdx) => (
                      <div key={eIdx} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1.1fr) minmax(0, 1fr) 36px', gap: '0.5rem', alignItems: 'center' }}>
                        <Input
                          style={{ textAlign: 'center' }}
                          placeholder="1"
                          value={ep.episodeNumber}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEpisode(sIdx, eIdx, { episodeNumber: e.target.value })}
                          inputMode="numeric"
                        />
                        <Input
                          placeholder="https://... lien direct"
                          value={ep.lien}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateEpisode(sIdx, eIdx, { lien: e.target.value })}
                        />
                        <FilePicker
                          file={ep.file}
                          onSelect={f => updateEpisode(sIdx, eIdx, { file: f })}
                          labelText={<Space size={4}><FileOutlined /> Choisir un fichier...</Space>}
                        />
                        <Button
                          danger
                          type="text"
                          icon={<CloseOutlined />}
                          disabled={s.episodes.length === 1}
                          onClick={() => removeEpisode(sIdx, eIdx)}
                          title="Supprimer l'épisode"
                        />
                      </div>
                    ))}
                  </Space>
                </div>
              ))}
            </Space>

            <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: '0.85rem' }}>
              Chaque épisode : un lien direct ou un fichier vidéo (le fichier est prioritaire). Les lignes sans numéro, lien ou fichier sont ignorées.
            </Text>
          </Card>
        )}

        {step === 2 && <Card size="small">
          <SectionTitle>Vérifier avant publication</SectionTitle>
          <div className="publish-preview" aria-live="polite">
            {posterUrl ? <img src={posterUrl} alt={`Affiche de ${titre || 'votre média'}`} /> : <div className="publish-preview-poster">{posterFile ? 'IMAGE CHOISIE' : 'CHILLERS'}</div>}
            <div className="publish-preview-copy"><span className="publish-preview-kicker">APERÇU CATALOGUE · {type === 'movie' ? 'FILM' : 'SÉRIE'}</span><strong>{titre || 'Le titre apparaîtra ici'}</strong>
              <div className="publish-preview-tags"><span>{year || 'Année non renseignée'}</span><span>{audioLanguage}</span><span>{quality}</span>{isPremium && <span>PREMIUM</span>}</div>
              <p>{synopsis || 'Aucun résumé ajouté.'}</p>{type === 'serie' && <small>{seasons.length} saison(s) · {episodeCount} épisode(s)</small>}
            </div>
          </div>
          <p className="publish-help">{posterFile ? `Affiche : ${posterFile.name}` : posterUrl ? 'Affiche TMDB conservée' : 'Aucune affiche sélectionnée'}{backdropFile ? ` · Couverture : ${backdropFile.name}` : ''}</p>
          {type === 'movie' && <p className="publish-help">Source : {movieFile?.name || lien || 'Non renseignée'}</p>}
        </Card>}
      </Space>

      <Space align="start" size="middle" wrap>
        {step > 0 && <Button size="large" onClick={() => { setStep(step - 1); setResult(null); }}>Retour</Button>}
        {step < 2 ? <Button type="primary" size="large" onClick={() => {
          setResult(null);
          const commonError = validateCommon();
          if (commonError) { setResult({ success: false, message: commonError }); return; }
          if (step === 1 && type === 'movie' && !lien.trim() && !movieFile) { setResult({ success: false, message: 'Ajoute un lien direct ou sélectionne un fichier vidéo' }); return; }
          if (step === 1 && type === 'serie' && !seasons.some(s => s.season && s.episodes.some(ep => ep.episodeNumber && (ep.lien.trim() || ep.file)))) { setResult({ success: false, message: 'Ajoute une saison et au moins un épisode avec un numéro et une source' }); return; }
          setStep(step + 1);
        }}>Suivant</Button> : <Button type="primary" size="large" icon={<PlusOutlined />} loading={submitting} onClick={submit}>
          {submitting ? 'Publication en cours...' : 'Publier dans le catalogue'}
        </Button>}
        {result && (
          <div className="publish-result">
            <Alert type={result.success ? 'success' : 'error'} showIcon message={result.message} description={result.upload} />
            {result.success && result.catalogUrl && <a href={result.catalogUrl} target="_blank" rel="noreferrer">Ouvrir la fiche publiée ↗</a>}
          </div>
        )}
      </Space>
    </div>
  );
}

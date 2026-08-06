'use client';

import { useState } from 'react';
import { adminCreateManualMedia, adminCreateManualMediaUpload, adminTmdbSearch } from '@/app/api';
import {
  Card, Input, InputNumber, Button, Space, Typography, Alert, Segmented, Upload, Spin, Tag, Divider,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, DeleteOutlined, CloseOutlined,
  VideoCameraOutlined, PlaySquareOutlined,   UploadOutlined, FileOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd';

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
      beforeUpload={(f) => { onSelect(f); return false; }}
      onRemove={() => onSelect(null)}
    >
      <Button icon={<UploadOutlined />} block>
        {labelText}
      </Button>
    </Upload>
  );
}

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, marginBottom: '1rem', color: '#e6e9f0' }}>
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#6c5ce7', flexShrink: 0 }} />
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
    <div style={{ maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Ajouter un média</Title>
          <Text type="secondary">Film ou série — lien direct ou fichier vidéo, upload Uqload lancé automatiquement</Text>
        </div>
        <Segmented
          value={type}
          onChange={(v) => switchType(v as 'movie' | 'serie')}
          options={[
            { label: <Space size={4}><VideoCameraOutlined /> Film</Space>, value: 'movie' },
            { label: <Space size={4}><PlaySquareOutlined /> Série</Space>, value: 'serie' },
          ]}
        />
      </div>

      <Space direction="vertical" size="large" style={{ width: '100%', marginBottom: '1.25rem' }}>
        <Card size="small">
          <SectionTitle>Informations</SectionTitle>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '0.75rem' }}>
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Titre</Text>
                <Input value={titre} onChange={e => setTitre(e.target.value)} placeholder="Titre du film / de la série" />
              </div>
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Année</Text>
                <Input value={year} onChange={e => setYear(e.target.value)} placeholder="2024" inputMode="numeric" />
              </div>
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>TMDB ID</Text>
                <Input value={tmdbId} onChange={e => setTmdbId(e.target.value)} placeholder="ex: 12345" inputMode="numeric" />
              </div>
            </div>
            {selectedTmdb && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                background: '#0f1219', border: '1px solid rgba(52,211,153,0.35)', borderRadius: 8, padding: '0.5rem 0.75rem',
              }}>
                {selectedTmdb.poster ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedTmdb.poster} alt="" style={{ width: 32, height: 48, objectFit: 'cover', borderRadius: 4 }} />
                ) : (
                  <div style={{ width: 32, height: 48, background: '#1a1f2b', borderRadius: 4 }} />
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
            {type === 'movie' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
                <div>
                  <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Lien direct (vidéo)</Text>
                  <Input value={lien} onChange={e => setLien(e.target.value)} placeholder="https://... mp4 ou lien direct" />
                </div>
                <div>
                  <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.35rem' }}>Ou fichier vidéo (prioritaire)</Text>
                  <FilePicker file={movieFile} onSelect={setMovieFile} labelText="Choisir un fichier vidéo..." />
                </div>
              </div>
            )}
          </Space>
        </Card>

        <Card size="small">
          <SectionTitle>Recherche TMDB</SectionTitle>
          <Space.Compact style={{ width: '100%', maxWidth: 600 }}>
            <Input
              value={tmdbQuery}
              onChange={e => setTmdbQuery(e.target.value)}
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
                    background: '#0f1219', border: '1px solid #242a38', borderRadius: 10,
                    padding: '0.5rem 0.75rem', color: '#e6e9f0', textAlign: 'left',
                  }}
                >
                  {c.poster ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.poster} alt="" style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 6 }} />
                  ) : (
                    <div style={{ width: 44, height: 66, background: '#1a1f2b', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4b5466', fontSize: '1.2rem' }}>?</div>
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

        {type === 'serie' && (
          <Card size="small">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
              <SectionTitle>
                Épisodes par saison
                <Tag style={{ marginInlineStart: 8 }}>{seasons.length} saison{seasons.length > 1 ? 's' : ''} · {episodeCount} épisode{episodeCount > 1 ? 's' : ''}</Tag>
              </SectionTitle>
              <Button type="primary" icon={<PlusOutlined />} onClick={addSeason}>Ajouter une saison</Button>
            </div>

            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              {seasons.map((s, sIdx) => (
                <div key={sIdx} style={{ background: '#0f1219', border: '1px solid #242a38', borderRadius: 10, padding: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <Space size="middle">
                      <Tag color="primary" style={{ fontWeight: 700, fontSize: 13 }}>S{s.season || '?'}</Tag>
                      <Input
                        style={{ width: 60 }}
                        value={s.season}
                        onChange={e => updateSeason(sIdx, e.target.value)}
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

                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {s.episodes.map((ep, eIdx) => (
                      <div key={eIdx} style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1.1fr) minmax(0, 1fr) 36px', gap: '0.5rem', alignItems: 'center' }}>
                        <Input
                          style={{ textAlign: 'center' }}
                          placeholder="1"
                          value={ep.episodeNumber}
                          onChange={e => updateEpisode(sIdx, eIdx, { episodeNumber: e.target.value })}
                          inputMode="numeric"
                        />
                        <Input
                          placeholder="https://... lien direct"
                          value={ep.lien}
                          onChange={e => updateEpisode(sIdx, eIdx, { lien: e.target.value })}
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
      </Space>

      <Space align="start" size="middle" wrap>
        <Button type="primary" size="large" icon={<PlusOutlined />} loading={submitting} onClick={submit}>
          {submitting ? 'Création en cours...' : type === 'movie' ? 'Ajouter le film' : 'Ajouter la série'}
        </Button>
        {result && (
          <Alert
            type={result.success ? 'success' : 'error'}
            showIcon
            message={result.message}
            description={result.upload}
            style={{ flex: 1, minWidth: 300 }}
          />
        )}
      </Space>
    </div>
  );
}

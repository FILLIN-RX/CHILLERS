'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { adminGetMovie, adminGetSerie } from '@/services/admin';
import { resolveDownloadUrl } from '@/services/downloads';
import { streamDownloadToDisk } from '@/services/streamSaver';
import { buildEpisodeFilename } from '@/lib/format';
import { Typography, Button, Space, Tag, Table, Modal, Spin, Alert, Tooltip } from 'antd';
import {
  ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined, LinkOutlined, FolderOpenOutlined, VideoCameraOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import TmdbLinkModal from '../../components/TmdbLinkModal';

const { Title, Text } = Typography;

interface Episode {
  episode: string;
  season: number;
  episodeNumber: number;
  lien: string;
  fileCode?: string;
  fldId?: string;
  tmdbId?: number;
  uqloadCode?: string;
  uqloadLink?: string;
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

interface MovieDetail {
  _id: string;
  titre: string;
  pageUrl: string;
  lien?: string;
  tmdbId?: number;
  uqloadCode?: string;
  uqloadLink?: string;
  fileCode?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminAnimeDetail() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const kind = searchParams.get('kind') === 'series' ? 'series' : 'movie';
  const router = useRouter();
  const [serie, setSerie] = useState<SerieDetail | null>(null);
  const [movie, setMovie] = useState<MovieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingEp, setDownloadingEp] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{ docId: string; tmdbId?: number } | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);

  useEffect(() => {
    const load = kind === 'series' ? adminGetSerie(id) : adminGetMovie(id);
    load.then(res => {
      if (res.success && res.data) {
        if (kind === 'series') setSerie(res.data as SerieDetail);
        else setMovie(res.data as MovieDetail);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id, kind]);

  const playMovie = useCallback(() => {
    if (!movie) return;
    setPlayerUrl(`/watch/${movie.tmdbId || movie._id}?type=movie`);
  }, [movie]);

  const downloadMovie = useCallback(async () => {
    if (!movie) return;
    setDownloadingEp(movie._id);
    try {
      const tmdbId = movie.tmdbId ? String(movie.tmdbId) : null;
      const result = await resolveDownloadUrl(tmdbId ?? movie._id, 'movie', movie.titre);
      if (result?.downloadUrl) {
        const filename = buildEpisodeFilename({ title: movie.titre, extension: 'mp4' });
        try {
          await streamDownloadToDisk(result.downloadUrl, {
            filename,
            signal: new AbortController().signal,
          });
        } catch {
          /* user can retry */
        }
      }
    } catch { } finally { setDownloadingEp(null); }
  }, [movie]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#6b7488' }}>
      <Spin /> Chargement...
    </div>
  );
  if (kind === 'movie' && !movie) return <Alert type="error" showIcon message="Anime introuvable" />;
  if (kind === 'series' && !serie) return <Alert type="error" showIcon message="Anime introuvable" />;

  const title = kind === 'movie' ? movie!.titre : serie!.titre;
  const docId = kind === 'movie' ? movie!._id : serie!._id;
  const tmdbId = kind === 'movie' ? movie!.tmdbId : serie!.tmdbId;
  const pageUrl = kind === 'movie' ? movie!.pageUrl : serie!.pageUrl;

  const columns: ColumnsType<Episode> = [
    {
      title: 'Épisode',
      dataIndex: 'episode',
      key: 'episode',
      render: (e: string, ep) => (
        <Space size={4} wrap>
          <span style={{ fontWeight: 500, whiteSpace: 'nowrap' }}>{e}</span>
          {!ep.fileCode && !ep.uqloadCode && (!ep.lien || ep.lien === '#') && (
            <Tag color="warning" style={{ fontSize: 11 }}>Bientôt disponible</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Lien',
      key: 'lien',
      render: (_, ep) => {
        const isDead = !ep.lien || ep.lien === '#';
        return isDead
          ? <Text style={{ color: '#f87171', fontSize: 12 }}>✗ Mort</Text>
          : <a href={ep.lien} target="_blank" rel="noopener noreferrer" style={{ color: '#a99bf0', fontSize: 12, textDecoration: 'none' }}>Voir le lien</a>;
      },
    },
    {
      title: 'Uqload',
      key: 'uqload',
      align: 'center' as const,
      render: (_, ep) => ep.uqloadCode ? (ep.uqloadLink ? <Tag color="success">✓</Tag> : <Tag>⏳</Tag>) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Doodstream',
      key: 'doodstream',
      align: 'center' as const,
      render: (_, ep) => ep.fileCode ? <Tag color="success">✓</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'TMDB',
      key: 'tmdb',
      render: (_, ep) => ep.tmdbId ? <Text style={{ color: '#34d399', fontSize: 12 }}>✓ Lié</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      width: 110,
      render: (_, ep) => {
        const isDead = !ep.lien || ep.lien === '#';
        const canPlay = !isDead && (!!ep.tmdbId || !!serie?.tmdbId);
        return (
          <Space size={4}>
            <Tooltip title="Lire">
              <Button
                size="small"
                type="text"
                disabled={!canPlay}
                icon={<PlayCircleOutlined style={{ color: canPlay ? '#a99bf0' : undefined }} />}
                onClick={() => {
                  const t = ep.tmdbId || serie?.tmdbId;
                  if (t) setPlayerUrl(`/watch/${t}?type=tv&season=${ep.season}&episode=${ep.episodeNumber}`);
                }}
              />
            </Tooltip>
            <Tooltip title="Télécharger">
              <Button
                size="small"
                type="text"
                disabled={isDead}
                loading={downloadingEp === ep.episode}
                icon={<DownloadOutlined style={{ color: isDead ? undefined : '#34d399' }} />}
                onClick={async () => {
                  setDownloadingEp(ep.episode);
                  try {
                    const t = ep.tmdbId ? String(ep.tmdbId) : null;
                    const result = await resolveDownloadUrl(
                      t ?? serie!._id,
                      'series',
                      serie!.titre,
                      ep.season,
                      ep.episodeNumber,
                    );
                    if (result?.downloadUrl) {
                      const filename = buildEpisodeFilename({
                        title: serie!.titre,
                        season: ep.season,
                        episodeNumber: ep.episodeNumber,
                        extension: 'mp4',
                      });
                      try {
                        await streamDownloadToDisk(result.downloadUrl, {
                          filename,
                          signal: new AbortController().signal,
                        });
                      } catch {
                        /* user can retry */
                      }
                    }
                  } catch { } finally { setDownloadingEp(null); }
                }}
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  const grouped: Record<number, Episode[]> = {};
  if (serie) {
    for (const ep of serie.episodes) {
      if (!grouped[ep.season]) grouped[ep.season] = [];
      grouped[ep.season].push(ep);
    }
  }
  const deadCount = serie ? serie.episodes.filter(e => !e.lien || e.lien === '#').length : 0;
  const movieDead = movie ? !movie.lien || movie.lien === '#' : false;

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push('/admin/animes')}
        style={{ marginBottom: '1rem' }}
      >
        Retour aux animes
      </Button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
        {kind === 'movie'
          ? <VideoCameraOutlined style={{ fontSize: 28, color: '#a99bf0', marginTop: 4 }} />
          : <FolderOpenOutlined style={{ fontSize: 28, color: '#a99bf0', marginTop: 4 }} />}
        <div style={{ flex: 1 }}>
          <Space size={8} align="center" style={{ flexWrap: 'wrap', rowGap: 4 }}>
            <Title level={3} style={{ margin: 0 }}>{title}</Title>
            <Tag color={kind === 'movie' ? 'geekblue' : 'purple'} style={{ marginInlineEnd: 0 }}>Anime</Tag>
          </Space>
          <Space size="large" wrap style={{ marginTop: '0.5rem', fontSize: 13 }}>
            {kind === 'series' && serie && (
              <>
                <Text type="secondary">{serie.episodes.length} épisodes</Text>
                <Text type="secondary">{Object.keys(grouped).length} saisons</Text>
                <Text style={{ color: deadCount > 0 ? '#f87171' : '#34d399' }}>
                  {deadCount > 0 ? `${deadCount} lien(s) mort(s)` : '✓ tous OK'}
                </Text>
              </>
            )}
            {kind === 'movie' && (
              <Text style={{ color: movieDead ? '#f87171' : '#34d399' }}>
                {movieDead ? '✗ Lien mort' : '✓ Lien OK'}
              </Text>
            )}
            <Button
              type="link"
              size="small"
              style={{ padding: 0, color: tmdbId ? '#34d399' : '#f87171', fontSize: 13 }}
              onClick={() => setLinkModal({ docId, tmdbId })}
            >
              {tmdbId ? `✓ Lié TMDB (#${tmdbId})` : '✗ Lier TMDB'}
            </Button>
            <a href={pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a99bf0', fontSize: 13, textDecoration: 'none' }}>
              Voir sur open-otaku.me →
            </a>
            {kind === 'movie' && movie && !movieDead && (
              <>
                <Tooltip title="Lire">
                  <Button size="small" type="text" icon={<PlayCircleOutlined style={{ color: '#a99bf0' }} />} onClick={playMovie} />
                </Tooltip>
                <Tooltip title="Télécharger">
                  <Button
                    size="small"
                    type="text"
                    loading={downloadingEp === movie._id}
                    icon={<DownloadOutlined style={{ color: '#34d399' }} />}
                    onClick={downloadMovie}
                  />
                </Tooltip>
              </>
            )}
          </Space>
        </div>
      </div>

      {kind === 'series' && serie && (
        <>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            {serie.episodes.map(ep => (
              <Tag key={ep.episode} color={(!ep.lien || ep.lien === '#') ? 'error' : 'success'} style={{ marginInlineEnd: 0 }}>
                {ep.episodeNumber}
              </Tag>
            ))}
          </div>
          {Object.entries(grouped)
            .sort(([a], [b]) => Number(b) - Number(a))
            .map(([season, eps]) => (
              <div key={season} style={{ marginBottom: '1.5rem' }}>
                <Title level={5} style={{ marginBottom: '0.5rem' }}>
                  Saison {season}{' '}
                  <Text type="secondary" style={{ fontWeight: 400, fontSize: 13 }}>({eps.length} épisodes)</Text>
                </Title>
                <Table<Episode>
                  rowKey={(_, i) => `${season}-${i}`}
                  size="middle"
                  dataSource={[...eps].sort((a, b) => a.episodeNumber - b.episodeNumber)}
                  columns={columns}
                  pagination={false}
                  scroll={{ x: 750 }}
                />
              </div>
            ))}
        </>
      )}

      {kind === 'movie' && movie && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Space size="large" wrap>
            <div>
              <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Uqload</Text>
              {movie.uqloadCode ? (movie.uqloadLink ? <Tag color="success">✓</Tag> : <Tag>⏳</Tag>) : <Text>—</Text>}
            </div>
            <div>
              <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Doodstream</Text>
              {movie.fileCode ? <Tag color="success">✓</Tag> : <Text>—</Text>}
            </div>
            <div>
              <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lien</Text>
              {movie.lien ? (
                <a href={movie.lien} target="_blank" rel="noopener noreferrer" style={{ color: '#a99bf0', fontSize: 13, textDecoration: 'none', wordBreak: 'break-all' }}>
                  {movie.lien.substring(0, 80)}...
                </a>
              ) : <Text style={{ color: '#f87171' }}>✗ Mort</Text>}
            </div>
          </Space>
        </div>
      )}

      {linkModal && (
        <TmdbLinkModal
          type={kind === 'movie' ? 'movies' : 'series'}
          docId={linkModal.docId}
          currentTmdbId={linkModal.tmdbId}
          onClose={() => setLinkModal(null)}
          onLinked={(t) => {
            if (kind === 'movie') setMovie(prev => prev ? { ...prev, tmdbId: t } : prev);
            else setSerie(prev => prev ? { ...prev, tmdbId: t } : prev);
            setLinkModal(null);
          }}
        />
      )}

      <Modal
        open={!!playerUrl}
        onCancel={() => setPlayerUrl(null)}
        footer={null}
        width="80vw"
        styles={{ body: { padding: 0, height: '75vh' } }}
        destroyOnClose
      >
        {playerUrl && (
          <iframe
            src={playerUrl}
            style={{ width: '100%', height: '100%', border: 'none' }}
            allowFullScreen
          />
        )}
      </Modal>
    </div>
  );
}
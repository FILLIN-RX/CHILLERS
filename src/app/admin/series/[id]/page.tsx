'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { adminGetSerie, startDownload, triggerDownload } from '@/app/api';
import { Typography, Button, Space, Tag, Table, Modal, Spin, Alert, Tooltip } from 'antd';
import {
  ArrowLeftOutlined, PlayCircleOutlined, DownloadOutlined, LinkOutlined, FolderOpenOutlined,
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

export default function AdminSerieDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [serie, setSerie] = useState<SerieDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingEp, setDownloadingEp] = useState<string | null>(null);
  const [linkModal, setLinkModal] = useState<{ docId: string; tmdbId?: number } | null>(null);
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);

  useEffect(() => {
    adminGetSerie(id).then(res => {
      if (res.success) setSerie(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#6b7488' }}>
      <Spin /> Chargement...
    </div>
  );
  if (!serie) return <Alert type="error" showIcon message="Série introuvable" />;

  const grouped: Record<number, Episode[]> = {};
  for (const ep of serie.episodes) {
    if (!grouped[ep.season]) grouped[ep.season] = [];
    grouped[ep.season].push(ep);
  }

  const deadCount = serie.episodes.filter(e => !e.lien || e.lien === '#').length;

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
        const canPlay = !isDead && (!!ep.tmdbId || !!serie.tmdbId);
        return (
          <Space size={4}>
            <Tooltip title="Lire">
              <Button
                size="small"
                type="text"
                disabled={!canPlay}
                icon={<PlayCircleOutlined style={{ color: canPlay ? '#a99bf0' : undefined }} />}
                onClick={() => {
                  const tmdbId = ep.tmdbId || serie.tmdbId;
                  if (tmdbId) setPlayerUrl(`/watch/${tmdbId}?type=tv&season=${ep.season}&episode=${ep.episodeNumber}`);
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
              />
            </Tooltip>
          </Space>
        );
      },
    },
  ];

  return (
    <div>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push('/admin/series')}
        style={{ marginBottom: '1rem' }}
      >
        Retour aux séries
      </Button>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
        <FolderOpenOutlined style={{ fontSize: 28, color: '#a99bf0', marginTop: 4 }} />
        <div style={{ flex: 1 }}>
          <Title level={3} style={{ margin: 0 }}>{serie.titre}</Title>
          <Space size="large" wrap style={{ marginTop: '0.5rem', fontSize: 13 }}>
            <Text type="secondary">{serie.episodes.length} épisodes</Text>
            <Text type="secondary">{Object.keys(grouped).length} saisons</Text>
            <Text style={{ color: deadCount > 0 ? '#f87171' : '#34d399' }}>
              {deadCount > 0 ? `${deadCount} lien(s) mort(s)` : '✓ tous OK'}
            </Text>
            <Button
              type="link"
              size="small"
              style={{ padding: 0, color: serie.tmdbId ? '#34d399' : '#f87171', fontSize: 13 }}
              onClick={() => setLinkModal({ docId: serie._id, tmdbId: serie.tmdbId })}
            >
              {serie.tmdbId ? `✓ Lié TMDB (#${serie.tmdbId})` : '✗ Lier TMDB'}
            </Button>
            <a href={serie.pageUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#a99bf0', fontSize: 13, textDecoration: 'none' }}>
              Voir sur open-otaku.me →
            </a>
          </Space>
        </div>
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

      {linkModal && (
        <TmdbLinkModal
          type="series"
          docId={linkModal.docId}
          currentTmdbId={linkModal.tmdbId}
          onClose={() => setLinkModal(null)}
          onLinked={(tmdbId) => {
            setSerie(prev => prev ? { ...prev, tmdbId } : prev);
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

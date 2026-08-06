'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminGetCollection, startDownload, triggerDownload } from '@/app/api';
import TmdbLinkModal from '../components/TmdbLinkModal';
import {
  Typography, Table, Input, Button, Space, Tag, Spin, Empty, Modal, Tooltip,
} from 'antd';
import { SearchOutlined, PlayCircleOutlined, DownloadOutlined, CloseOutlined, LoadingOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

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
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
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

  const columns: ColumnsType<Movie> = [
    {
      title: 'Titre',
      dataIndex: 'titre',
      key: 'titre',
      render: (t: string, m: Movie) => (
        <Space size={4} wrap>
          <span style={{ color: '#e6e9f0', fontWeight: 500, whiteSpace: 'nowrap' }}>{t}</span>
          {!m.uqloadCode && !m.fileCode && (!m.lien || m.lien === '#') && (
            <Tag color="warning" style={{ fontSize: 11 }}>Bientôt disponible</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'TMDB',
      dataIndex: 'tmdbId',
      key: 'tmdbId',
      render: (id: number | undefined, m: Movie) => (
        <Button
          type="link"
          size="small"
          style={{ padding: 0, color: id ? '#34d399' : '#f87171', fontSize: 12 }}
          onClick={() => setLinkModal({ docId: m._id, tmdbId: m.tmdbId })}
        >
          {id ? `✓ ${id}` : '✗ Lier'}
        </Button>
      ),
    },
    {
      title: 'Uqload',
      dataIndex: 'uqloadCode',
      key: 'uqloadCode',
      align: 'center' as const,
      render: (c: string) => c ? <Tag color="success">✓</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'DoodStream',
      dataIndex: 'fileCode',
      key: 'fileCode',
      align: 'center' as const,
      render: (c: string) => c ? <Tag color="success">✓</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Lien',
      dataIndex: 'lien',
      key: 'lien',
      render: (l: string) => l ? (
        <a href={l} target="_blank" rel="noopener noreferrer" style={{ color: '#a99bf0', fontSize: 12, wordBreak: 'break-all' }}>
          {l.substring(0, 60)}...
        </a>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ajouté',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => <Text type="secondary" style={{ fontSize: 12 }}>{new Date(d).toLocaleDateString()}</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      align: 'center' as const,
      width: 110,
      render: (_, m) => (
        <Space size={4}>
          <Tooltip title="Lire">
            <Button
              size="small"
              type="text"
              icon={<PlayCircleOutlined style={{ color: '#a99bf0' }} />}
              onClick={() => setPlayerUrl(`/watch/${m.tmdbId || m._id}?type=movie`)}
            />
          </Tooltip>
          <Tooltip title="Télécharger">
            <Button
              size="small"
              type="text"
              loading={downloadingId === m._id}
              icon={<DownloadOutlined style={{ color: downloadingId === m._id ? undefined : '#34d399' }} />}
              onClick={async () => {
                setDownloadingId(m._id);
                try {
                  const result = await startDownload(m.tmdbId ? String(m.tmdbId) : m._id, 'movie', m.titre);
                  if (result?.downloadUrl) {
                    triggerDownload(result.downloadUrl, `${m.titre}.mp4`);
                  }
                } catch { } finally { setDownloadingId(null); }
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginTop: 0, marginBottom: '1.25rem' }}>
        Films <Text type="secondary" style={{ fontWeight: 400, fontSize: '1rem' }}>({total})</Text>
      </Title>

      <Input
        placeholder="Rechercher un film..."
        value={q}
        onChange={e => setQ(e.target.value)}
        onPressEnter={() => { setPage(1); fetch(q, 1); }}
        allowClear
        prefix={<SearchOutlined style={{ color: '#6b7488' }} />}
        style={{ maxWidth: 420, marginBottom: '1.25rem' }}
      />

      <Table<Movie>
        rowKey="_id"
        size="middle"
        loading={loading}
        dataSource={items}
        columns={columns}
        scroll={{ x: 900 }}
        locale={{ emptyText: loading ? <Spin /> : <Empty description="Aucun film trouvé" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
      />

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

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  adminAffichesList,
  adminAffichesGenerate,
  adminAffichesStatus,
  adminAvailabilityScan,
  adminAvailabilityStatus,
  adminAffichesCardUrl,
  AfficheItem,
} from '@/services/admin';
import { resolveImageUrl } from '@/services/http';
import {
  Typography, Table, Button, Space, Select, Input, Tag, Progress, Alert, Spin, Empty, message,
} from 'antd';
import {
  SearchOutlined, PlusOutlined, DownloadOutlined, CopyOutlined, CheckOutlined,
  PictureOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface JobProgress {
  running: boolean;
  total: number;
  processed: number;
  ok: number;
  ko: number;
  lastMessage: string;
  errors: string[];
}

const SOURCE_LABELS: Record<string, string> = {
  tmdb: 'TMDB',
  web: 'Web',
  ai: 'IA',
  none: 'Aucune',
};

export default function AdminAffiches() {
  const [items, setItems] = useState<AfficheItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<'all' | 'movie' | 'series'>('all');
  const [disponible, setDisponible] = useState('');
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [scanProgress, setScanProgress] = useState<JobProgress | null>(null);
  const [genProgress, setGenProgress] = useState<JobProgress | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await adminAffichesList({
      type,
      disponible: disponible === '' ? undefined : disponible === 'true',
      source: source || undefined,
      q: searchInput || undefined,
      page,
      limit: 50,
    });
    if (res.success && res.data) {
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    }
    setLoading(false);
  }, [type, disponible, source, searchInput, page]);

  useEffect(() => { load(); }, [load]);

  const pollStatus = useCallback(async () => {
    const [scan, gen] = await Promise.all([adminAvailabilityStatus(), adminAffichesStatus()]);
    if (scan.success && scan.data) setScanProgress(scan.data as JobProgress);
    if (gen.success && gen.data) setGenProgress(gen.data as JobProgress);
  }, []);

  useEffect(() => {
    const t = setTimeout(pollStatus, 0);
    pollRef.current = setInterval(pollStatus, 2500);
    return () => { clearTimeout(t); if (pollRef.current) clearInterval(pollRef.current); };
  }, [pollStatus]);

  const handleScan = async () => {
    setMessage(null);
    const res = await adminAvailabilityScan('all');
    setMessage(res.message || (res.success ? 'Scan lancé' : 'Erreur'));
  };

  const handleGenerateAll = async () => {
    setMessage(null);
    const res = await adminAffichesGenerate({ type: 'all' });
    setMessage(res.message || (res.success ? 'Génération lancée' : 'Erreur'));
  };

  const handleGenerateOne = async (item: AfficheItem) => {
    setMessage(null);
    const res = await adminAffichesGenerate({ type: item.mediaType, id: item._id });
    setMessage(res.message || (res.success ? 'Affiche générée' : 'Erreur'));
    if (res.success) load();
  };

  const handleCopyLink = async (item: AfficheItem) => {
    if (!item.link) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${item.link}`);
      setCopiedId(item._id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setMessage('Copie impossible');
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / 50));
  const progress = scanProgress?.running ? scanProgress : genProgress?.running ? genProgress : null;

  const columns: ColumnsType<AfficheItem> = [
    {
      title: 'Affiche',
      key: 'poster',
      width: 70,
      render: (_, item) => item.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resolveImageUrl(item.posterUrl)} alt={item.titre}
          style={{ width: 44, height: 66, objectFit: 'cover', borderRadius: 6, border: '1px solid #242a38', display: 'block' }} />
      ) : (
        <div style={{ width: 44, height: 66, borderRadius: 6, background: '#1a1f2b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#6b7488' }}>
          Aucune
        </div>
      ),
    },
    {
      title: 'Titre',
      key: 'titre',
      render: (_, item) => (
        <div>
          <div style={{ color: '#e6e9f0', fontWeight: 600 }}>{item.titre}</div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {item.mediaType === 'movie' ? 'Film' : 'Série'}{item.year ? ` · ${item.year}` : ''}
          </Text>
        </div>
      ),
    },
    {
      title: 'Source',
      key: 'source',
      width: 90,
      render: (_, item) => {
        const s = item.posterSource || 'none';
        return (
          <Tag
            color={s === 'tmdb' ? 'processing' : s === 'web' ? 'success' : s === 'ai' ? 'purple' : 'default'}
            style={{ textTransform: 'uppercase', fontSize: 11, fontWeight: 700 }}
          >
            {SOURCE_LABELS[s]}
          </Tag>
        );
      },
    },
    {
      title: 'Dispo',
      key: 'dispo',
      width: 110,
      render: (_, item) => {
        if (item.disponible === null || item.disponible === undefined) return <Text type="secondary">—</Text>;
        return item.disponible
          ? <span style={{ color: '#34d399', fontWeight: 700, fontSize: 12 }}>● Disponible</span>
          : <span style={{ color: '#f87171', fontWeight: 700, fontSize: 12 }}>● Non dispo</span>;
      },
    },
    {
      title: 'Speech',
      key: 'speech',
      render: (_, item) => item.speech ? (
        <Text type="secondary" style={{ fontSize: 12, display: 'block', maxWidth: 320, lineHeight: 1.5 }}>
          <span style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.speech}</span>
        </Text>
      ) : (
        <Text type="secondary" style={{ color: '#4b5466', fontSize: 12 }}>Aucun speech — générer</Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 260,
      render: (_, item) => (
        <Space direction="vertical" size={4}>
          <Space size={4}>
            <Button size="small" icon={<ThunderboltOutlined />} loading={genProgress?.running} onClick={() => handleGenerateOne(item)}>
              Générer
            </Button>
            <Button size="small" type="text" icon={<PictureOutlined />} href={adminAffichesCardUrl(item._id, item.mediaType)} target="_blank" download>
              Carte
            </Button>
            <Button size="small" type="text" icon={<DownloadOutlined />} href={`/api/affiches/${item._id}/poster?type=${item.mediaType}`} target="_blank" download>
              Affiche
            </Button>
          </Space>
          {item.link && (
            <Space size={4} style={{ maxWidth: 250 }}>
              <a href={item.link} target="_blank" rel="noreferrer"
                style={{ color: '#a5b4fc', fontSize: 12, textDecoration: 'underline', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.link}
              </a>
              <Button
                size="small"
                type={copiedId === item._id ? 'primary' : 'default'}
                icon={copiedId === item._id ? <CheckOutlined /> : <CopyOutlined />}
                onClick={() => handleCopyLink(item)}
              >
                {copiedId === item._id ? 'Copié' : 'Copier'}
              </Button>
            </Space>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        <Title level={3} style={{ margin: 0 }}>
          Affiches & Partage{' '}
          <Text type="secondary" style={{ fontWeight: 400, fontSize: '0.875rem' }}>{total} titres</Text>
        </Title>
        <Space>
          <Button type="primary" icon={<SearchOutlined />} loading={scanProgress?.running} onClick={handleScan}>
            {scanProgress?.running ? 'Scan en cours...' : 'Scan disponibilité'}
          </Button>
          <Button
            icon={<PlusOutlined />}
            loading={genProgress?.running}
            onClick={handleGenerateAll}
            style={{ background: '#0d2b1a', borderColor: '#14532d', color: '#34d399' }}
          >
            {genProgress?.running ? 'Génération en cours...' : 'Générer tout (affiches + speech)'}
          </Button>
        </Space>
      </div>

      {message && <Alert type="info" showIcon message={message} style={{ marginBottom: '1rem' }} />}

      {progress && (
        <div style={{ background: '#0f1219', border: '1px solid #242a38', borderRadius: 12, padding: '1rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8b93a7', fontSize: 13, marginBottom: '0.5rem' }}>
            <span>{scanProgress?.running ? 'Scan' : 'Génération'} en cours...</span>
            <span>{progress.processed} / {progress.total}</span>
          </div>
          <Progress
            percent={Math.round((progress.processed / Math.max(1, progress.total)) * 100)}
            showInfo={false}
            strokeColor={{ from: '#6c5ce7', to: '#9b59f6' }}
            trailColor="#1e2431"
            size="small"
          />
          <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: '0.5rem' }}>
            {progress.lastMessage}
          </Text>
        </div>
      )}

      <Space wrap style={{ marginBottom: '1rem' }}>
        <Select
          value={type}
          onChange={(v) => { setType(v as 'all' | 'movie' | 'series'); setPage(1); }}
          style={{ width: 120 }}
          options={[
            { label: 'Tous', value: 'all' },
            { label: 'Films', value: 'movie' },
            { label: 'Séries', value: 'series' },
          ]}
        />
        <Select
          value={disponible}
          onChange={(v) => { setDisponible(v); setPage(1); }}
          style={{ width: 170 }}
          options={[
            { label: 'Disponibilité: tous', value: '' },
            { label: 'Disponible', value: 'true' },
            { label: 'Indisponible', value: 'false' },
          ]}
        />
        <Select
          value={source}
          onChange={(v) => { setSource(v); setPage(1); }}
          style={{ width: 150 }}
          options={[
            { label: 'Source: toutes', value: '' },
            { label: 'TMDB', value: 'tmdb' },
            { label: 'Web', value: 'web' },
            { label: 'IA', value: 'ai' },
            { label: 'Aucune', value: 'none' },
          ]}
        />
        <Input.Search
          placeholder="Rechercher un titre..."
          allowClear
          value={q}
          onChange={e => setQ(e.target.value)}
          onSearch={(v) => { setSearchInput(v); setPage(1); }}
          style={{ width: 280 }}
        />
      </Space>

      <Table<AfficheItem>
        rowKey={(item) => `${item.mediaType}-${item._id}`}
        size="middle"
        loading={loading}
        dataSource={items}
        columns={columns}
        scroll={{ x: 900 }}
        locale={{ emptyText: loading ? <Spin /> : <Empty description="Aucun titre trouvé" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        pagination={{
          current: page,
          pageSize: 50,
          total,
          showSizeChanger: false,
          showTotal: () => `Page ${page} / ${totalPages}`,
          onChange: (p) => setPage(p),
        }}
      />
    </div>
  );
}

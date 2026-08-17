'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  adminUqloadStatus, adminUqloadPending, adminUqloadPendingBoth,
  adminUqloadUploadMovies, adminUqloadUploadSeries, adminUqloadStop,
  adminUqloadFiles,
} from '@/services/admin';
import {
  Card, Statistic, Row, Col, Button, Space, Typography, Alert, Spin,
  Tag, Segmented, Input, Select, Table, Tooltip, Badge,
} from 'antd';
import {
  CloudUploadOutlined, StopOutlined, ReloadOutlined,
  CheckCircleOutlined, SearchOutlined, LinkOutlined,
  PlayCircleOutlined, FileTextOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;
const { Search } = Input;

type Tab = 'status' | 'pending' | 'missing' | 'files';

/* ─────────────────────────────────────────────────────────────────── helpers */

function formatBytes(bytes: number | string): string {
  const n = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (!n || isNaN(n)) return '?';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0; let size = n;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Tooltip title={copied ? 'Copié !' : 'Copier'}>
      <Button
        size="small"
        type={copied ? 'primary' : 'default'}
        icon={<LinkOutlined />}
        onClick={copy}
        style={{ fontSize: 11 }}
      >
        {label}
      </Button>
    </Tooltip>
  );
}

/* ──────────────────────────────────────────────────── FilesTab component */

function FilesTab() {
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType]       = useState<'all' | 'movies' | 'series'>('all');
  const [search, setSearch]   = useState('');
  const [page, setPage]       = useState(1);
  const limit = 50;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await adminUqloadFiles({ type, page, limit, search: search || undefined });
      setData(res.data);
    } finally {
      setLoading(false);
    }
  }, [type, page, search]);

  useEffect(() => { load(); }, [load]);

  /* ── columns films */
  const movieCols = [
    {
      title: 'Titre', dataIndex: 'titre', key: 'titre',
      render: (v: string, r: any) => (
        <span>
          <span style={{ fontWeight: 600, color: '#e6e9f0' }}>{v}</span>
          {r.year && <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>({r.year})</Text>}
        </span>
      ),
    },
    {
      title: 'Uqload', key: 'uqload',
      render: (_: any, r: any) => r.uqload?.code ? (
        <Space size={4} wrap>
          <Tag color="green" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.uqload.code}</Tag>
          {r.uqload.link && <CopyBtn text={r.uqload.link} label="Embed" />}
          {r.uqload.hls  && <CopyBtn text={r.uqload.hls}  label="HLS" />}
        </Space>
      ) : <Tag color="red">Manquant</Tag>,
    },
    {
      title: 'Qualités', key: 'qualities',
      render: (_: any, r: any) => (
        <Space size={4} wrap>
          {(r.uqload?.qualities || []).map((q: any, i: number) => (
            <Tooltip key={i} title={`${q.size} — ${q.url}`}>
              <Tag>{q.name}</Tag>
            </Tooltip>
          ))}
          {(!r.uqload?.qualities?.length) && <Text type="secondary" style={{ fontSize: 11 }}>—</Text>}
        </Space>
      ),
    },
    {
      title: 'Streamtape', key: 'streamtape',
      render: (_: any, r: any) => r.streamtape?.code ? (
        <Space size={4}>
          <Tag color="blue">{r.streamtape.code}</Tag>
          {r.streamtape.link && <CopyBtn text={r.streamtape.link} label="Lien" />}
        </Space>
      ) : <Tag color="default">—</Tag>,
    },
    {
      title: 'Uploadé le', dataIndex: 'uploadedAt', key: 'uploadedAt',
      render: (v: string) => v ? new Date(v).toLocaleDateString('fr-FR') : '—',
      width: 110,
    },
  ];

  /* ── columns séries épisodes */
  const episodeCols = [
    {
      title: 'Série', key: 'serie',
      render: (_: any, r: any) => (
        <span style={{ fontWeight: 600, color: '#e6e9f0' }}>{r._serieTitre}</span>
      ),
    },
    {
      title: 'Épisode', key: 'ep',
      render: (_: any, r: any) => (
        <Tag>{`S${String(r.season).padStart(2,'0')}E${String(r.episodeNumber).padStart(2,'0')}`}</Tag>
      ),
      width: 90,
    },
    {
      title: 'Uqload', key: 'uqload',
      render: (_: any, r: any) => r.uqload?.code ? (
        <Space size={4} wrap>
          <Tag color="green" style={{ fontFamily: 'monospace', fontSize: 11 }}>{r.uqload.code}</Tag>
          {r.uqload.link && <CopyBtn text={r.uqload.link} label="Embed" />}
        </Space>
      ) : <Tag color="red">Manquant</Tag>,
    },
    {
      title: 'Streamtape', key: 'streamtape',
      render: (_: any, r: any) => r.streamtape?.code ? (
        <Space size={4}>
          <Tag color="blue">{r.streamtape.code}</Tag>
          {r.streamtape.link && <CopyBtn text={r.streamtape.link} label="Lien" />}
        </Space>
      ) : <Tag>—</Tag>,
    },
    {
      title: 'Uploadé le', key: 'uploadedAt',
      render: (_: any, r: any) => r.uploadedAt ? new Date(r.uploadedAt).toLocaleDateString('fr-FR') : '—',
      width: 110,
    },
  ];

  /* flatten episodes for the table */
  const episodeRows = (data?.series?.items || []).flatMap((s: any) =>
    (s.episodes || []).map((e: any, i: number) => ({
      ...e,
      _key: `${s.id}-${i}`,
      _serieTitre: s.titre,
    }))
  );

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <Select
          value={type}
          onChange={(v) => { setType(v); setPage(1); }}
          style={{ width: 160 }}
          options={[
            { value: 'all',    label: 'Films + Séries' },
            { value: 'movies', label: 'Films seulement' },
            { value: 'series', label: 'Séries seulement' },
          ]}
        />
        <Search
          placeholder="Rechercher un titre…"
          allowClear
          style={{ width: 280 }}
          onSearch={(v) => { setSearch(v); setPage(1); }}
          prefix={<SearchOutlined />}
        />
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Actualiser</Button>
        {data && (
          <Space>
            {data.movies && <Badge count={data.movies.total} overflowCount={9999} color="#34d399" style={{ marginRight: 4 }}><Tag>Films uploadés</Tag></Badge>}
            {data.series && <Badge count={data.series.total} overflowCount={9999} color="#60a5fa"><Tag>Séries uploadées</Tag></Badge>}
          </Space>
        )}
      </div>

      <Spin spinning={loading}>
        {/* Table Films */}
        {(type === 'all' || type === 'movies') && (
          <Card
            size="small"
            title={<><PlayCircleOutlined style={{ marginRight: 6 }} />Films ({data?.movies?.total ?? 0} total)</>}
            style={{ marginBottom: '1.5rem' }}
          >
            <Table
              dataSource={data?.movies?.items || []}
              columns={movieCols}
              rowKey={(r: any) => r.id}
              size="small"
              scroll={{ x: 700 }}
              pagination={{
                current: type === 'movies' ? page : 1,
                pageSize: limit,
                total: data?.movies?.total ?? 0,
                showSizeChanger: false,
                onChange: (p) => setPage(p),
                showTotal: (t) => `${t} films`,
              }}
            />
          </Card>
        )}

        {/* Table Épisodes */}
        {(type === 'all' || type === 'series') && (
          <Card
            size="small"
            title={<><FileTextOutlined style={{ marginRight: 6 }} />Épisodes de séries ({data?.series?.total ?? 0} séries)</>}
          >
            <Table
              dataSource={episodeRows}
              columns={episodeCols}
              rowKey={(r: any) => r._key}
              size="small"
              scroll={{ x: 700 }}
              pagination={{
                current: type === 'series' ? page : 1,
                pageSize: limit,
                total: episodeRows.length,
                showSizeChanger: false,
                onChange: (p) => setPage(p),
                showTotal: (t) => `${t} épisodes affichés`,
              }}
            />
          </Card>
        )}
      </Spin>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── main page */

export default function AdminUqload() {
  const [status, setStatus]         = useState<any>(null);
  const [pending, setPending]       = useState<any>(null);
  const [pendingBoth, setPendingBoth] = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [tab, setTab]               = useState<Tab>('status');

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      adminUqloadStatus().then((d: any) => setStatus(d.data)),
      adminUqloadPending().then((d: any) => setPending(d.data)),
      adminUqloadPendingBoth().then((d: any) => setPendingBoth(d.data)),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleUpload = async (type: 'movies' | 'series') => {
    setUploading(true);
    try {
      if (type === 'movies') await adminUqloadUploadMovies();
      else await adminUqloadUploadSeries();
      setTimeout(fetchData, 2000);
    } finally {
      setUploading(false);
    }
  };

  if (loading && !status) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#6b7488', padding: '2rem' }}>
      <Spin /> Chargement...
    </div>
  );

  if (status && !status.configured) return (
    <Alert type="warning" showIcon message="UQLOAD_API_KEY non configurée dans le .env" style={{ maxWidth: 480 }} />
  );

  const renderPendingList = ({ items, empty }: { items: any[]; empty: string }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {items.length === 0 ? (
        <Alert type="success" showIcon icon={<CheckCircleOutlined />} message={empty} />
      ) : items.slice(0, 50).map((m, i) => (
        <div key={i} style={{
          background: '#141821', border: '1px solid #1c2230', borderRadius: 8,
          padding: '0.5rem 0.75rem', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: '#e6e9f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: '0.5rem' }}>
            {m.titre || `${m.serieTitre} — ${m.episode || `S${m.season}E${m.episodeNumber}`}`}
          </span>
          <span style={{ flexShrink: 0 }}>
            {m.fileCode ? <Tag color="success">DoodStream ✓</Tag> : m.lien ? <Tag>Lien OK</Tag> : m.tmdbId ? <Tag color="cyan">TMDB ✓</Tag> : <Tag>Direct</Tag>}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 1200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Uqload</Title>
          <Text type="secondary">Upload automatique des vidéos vers Uqload</Text>
        </div>
        <Space>
          <Segmented
            value={tab}
            onChange={(v) => setTab(v as Tab)}
            options={[
              { label: 'Statut',   value: 'status'  },
              { label: 'En attente', value: 'pending' },
              { label: 'Manquants',  value: 'missing' },
              { label: '📁 Fichiers', value: 'files'   },
            ]}
          />
          {tab !== 'files' && <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} />}
        </Space>
      </div>

      {status?.isUploading && (
        <Alert type="warning" showIcon message="Upload en cours sur le serveur" style={{ marginBottom: '1rem' }} />
      )}

      {/* ── STATUT ── */}
      {tab === 'status' && status && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '1.5rem' }}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Stockage utilisé" value={formatBytes(status.account?.storageUsed)} prefix={<CloudUploadOutlined />} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Stockage restant" value={formatBytes(status.account?.storageLeft)} prefix={<CloudUploadOutlined />} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Compte" value={status.account?.login ?? '—'} /></Card></Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic title="Premium" value={status.account?.premium ? 'Oui' : 'Non'} valueStyle={{ color: status.account?.premium ? '#34d399' : '#f87171' }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginBottom: '1.5rem' }}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Films en attente Uqload" value={status.pending?.movies ?? '?'} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Épisodes en attente Uqload" value={status.pending?.series ?? '?'} /></Card></Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Ni Uqload ni DoodStream"
                  value={`${status.pendingBoth?.movies ?? 0} films`}
                  valueStyle={{ color: (status.pendingBoth?.movies ?? 0) > 0 ? '#fbbf24' : '#34d399', fontSize: 20 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>{status.pendingBoth?.series ?? 0} épisodes</Text>
              </Card>
            </Col>
          </Row>

          <Space wrap>
            <Button type="primary" icon={<CloudUploadOutlined />} loading={uploading} disabled={uploading || status.isUploading} onClick={() => handleUpload('movies')}>
              Upload films (lot de 100)
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />} loading={uploading} disabled={uploading || status.isUploading} onClick={() => handleUpload('series')}>
              Upload séries (lot de 100)
            </Button>
            <Button danger icon={<StopOutlined />} disabled={!status.isUploading} onClick={async () => { await adminUqloadStop(); setTimeout(fetchData, 1000); }}>
              Arrêter l&apos;upload
            </Button>
          </Space>
        </>
      )}

      {/* ── EN ATTENTE ── */}
      {tab === 'pending' && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '1.25rem' }}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Films sans Uqload" value={pending?.totalMovies ?? 0} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Épisodes sans Uqload" value={pending?.totalEpisodes ?? 0} /></Card></Col>
          </Row>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card size="small" title={`Films en attente (${pending?.movies?.length || 0} affichés)`} styles={{ body: { padding: '0.75rem' } }}>
                {renderPendingList({ items: pending?.movies || [], empty: "Tous les films sont uploadés ✓" })}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card size="small" title={`Épisodes en attente (${pending?.series?.length || 0} affichés)`} styles={{ body: { padding: '0.75rem' } }}>
                {renderPendingList({ items: pending?.series || [], empty: "Tous les épisodes sont uploadés ✓" })}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* ── MANQUANTS ── */}
      {tab === 'missing' && (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: '1rem' }}>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Films sur aucun service" value={pendingBoth?.totalMovies ?? 0} valueStyle={{ color: '#fbbf24' }} /></Card></Col>
            <Col xs={12} md={6}><Card size="small"><Statistic title="Épisodes sur aucun service" value={pendingBoth?.totalEpisodes ?? 0} valueStyle={{ color: '#fbbf24' }} /></Card></Col>
          </Row>
          <Alert type="info" showIcon style={{ marginBottom: '1rem', maxWidth: 900 }} message="Ces contenus ne sont ni sur Uqload ni sur DoodStream. Utilisez le script CLI npm run upload-uqload pour les uploader." />
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card size="small" title={`Films manquants (${pendingBoth?.movies?.length || 0} affichés)`} styles={{ body: { padding: '0.75rem' } }}>
                {renderPendingList({ items: pendingBoth?.movies || [], empty: "Tous les films sont sur au moins un service ✓" })}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card size="small" title={`Épisodes manquants (${pendingBoth?.series?.length || 0} affichés)`} styles={{ body: { padding: '0.75rem' } }}>
                {renderPendingList({ items: pendingBoth?.series || [], empty: "Tous les épisodes sont sur au moins un service ✓" })}
              </Card>
            </Col>
          </Row>
        </>
      )}

      {/* ── FICHIERS UPLOADÉS ── */}
      {tab === 'files' && <FilesTab />}
    </div>
  );
}

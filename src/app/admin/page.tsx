'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminGetDashboard, adminClearCache, adminTriggerScrape, adminGetScraperState, adminUqloadStatus } from '@/services/admin';
import {
  Card, Statistic, Row, Col, Typography, Tag, Table, Button, Space, Empty, Spin, Alert,
} from 'antd';
import {
  VideoCameraOutlined, PlaySquareOutlined, FileTextOutlined, WarningOutlined,
  CloudUploadOutlined, ThunderboltOutlined, ClearOutlined, ArrowRightOutlined,
  TrophyOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface RecentMovie {
  _id: string; titre: string; tmdbId?: number; addedAt: string; ago: string;
}
interface RecentSerie {
  _id: string; titre: string; tmdbId?: number; episodesCount: number; addedAt: string; ago: string;
}
interface RecentAnime extends RecentSerie {
  kind: 'movie' | 'series';
}
interface HealthCheck {
  status: string; message: string;
}
interface DashboardData {
  movies: number; series: number; animes: number; animeMovies: number; animeSeries: number;
  tmdbLinkedAnimes: number; completeSeries: number; totalEpisodes: number;
  deadLinks: number; tmdbLinkedMovies: number; tmdbLinkedSeries: number; uptime: number;
  recent: { movies: RecentMovie[]; series: RecentSerie[]; animes: RecentAnime[] };
  health: Record<string, HealthCheck>;
}
interface ScraperStateItem { lastPage: number; updatedAt: string; }
interface ScraperStateData { films: ScraperStateItem | null; series: ScraperStateItem | null; animes: ScraperStateItem | null; }

const SHORTCUTS = [
  { href: '/admin/movies', label: 'Films', icon: <VideoCameraOutlined />, color: '#818cf8' },
  { href: '/admin/series', label: 'Séries', icon: <PlaySquareOutlined />, color: '#34d399' },
  { href: '/admin/animes', label: 'Animes', icon: <TrophyOutlined />, color: '#f472b6' },
  { href: '/admin/tmdb', label: 'TMDB', icon: <CloudUploadOutlined />, color: '#2dd4bf' },
  { href: '/admin/uqload', label: 'Uqload', icon: <CloudUploadOutlined />, color: '#fbbf24' },
  { href: '/admin/logs', label: 'Logs', icon: <FileTextOutlined />, color: '#fbbf24' },
  { href: '/admin/dead-links', label: 'Liens morts', icon: <WarningOutlined />, color: '#f87171' },
  { href: '/admin/settings', label: 'Paramètres', icon: <ThunderboltOutlined />, color: '#c084fc' },
];

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [scraper, setScraper] = useState<ScraperStateData | null>(null);
  const [uqload, setUqload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [configMsg, setConfigMsg] = useState('');

  useEffect(() => {
    Promise.all([
      adminGetDashboard(),
      adminGetScraperState().catch(() => ({ success: false })),
      adminUqloadStatus().then(r => r.data).catch(() => null),
    ]).then(([d, s, u]: any) => {
      if (d.success) setData(d.data);
      if (s.success) setScraper(s.data);
      if (u?.configured) setUqload(u);
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: '#6b7488', gap: '0.75rem' }}>
      <Spin /> Chargement du tableau de bord...
    </div>
  );
  if (!data) return <Alert type="error" showIcon message="Erreur de chargement" />;

  const uptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${d}j ${h}h ${m}m`;
  };

  const healthColor = (status: string) => {
    if (status === '✓') return 'success';
    if (status === '⚠') return 'warning';
    return 'error';
  };

  const movieColumns = [
    {
      title: 'Titre',
      dataIndex: 'titre',
      key: 'titre',
      render: (t: string, r: RecentMovie) => (
        <Link href={`/admin/movies?q=${encodeURIComponent(t)}`} style={{ color: '#e6e9f0', textDecoration: 'none', fontWeight: 500 }}>
          {t}
        </Link>
      ),
    },
    {
      title: 'Il y a',
      dataIndex: 'ago',
      key: 'ago',
      align: 'right' as const,
      render: (a: string) => <Text type="secondary" style={{ fontSize: 12 }}>{a}</Text>,
    },
  ];

  const serieColumns = [
    {
      title: 'Titre',
      dataIndex: 'titre',
      key: 'titre',
      render: (t: string, r: RecentSerie) => (
        <Link href={`/admin/series/${r._id}`} style={{ color: '#e6e9f0', textDecoration: 'none', fontWeight: 500 }}>
          {t}
        </Link>
      ),
    },
    {
      title: 'Ép.',
      dataIndex: 'episodesCount',
      key: 'episodesCount',
      align: 'right' as const,
      render: (n: number) => <Tag>{n}</Tag>,
    },
    {
      title: 'Il y a',
      dataIndex: 'ago',
      key: 'ago',
      align: 'right' as const,
      render: (a: string) => <Text type="secondary" style={{ fontSize: 12 }}>{a}</Text>,
    },
  ];

const animeColumns = [
    {
      title: 'Titre',
      dataIndex: 'titre',
      key: 'titre',
      render: (t: string, r: RecentAnime) => (
        <Space size={4}>
          <Link href={`/admin/animes/${r._id}?kind=${r.kind}`} style={{ color: '#e6e9f0', textDecoration: 'none', fontWeight: 500 }}>
            {t}
          </Link>
          <Tag color={r.kind === 'movie' ? 'geekblue' : 'purple'} style={{ fontSize: 10, marginInlineEnd: 0 }}>
            {r.kind === 'movie' ? 'Film' : 'Série'}
          </Tag>
        </Space>
      ),
    },
    {
      title: 'Ép.',
      dataIndex: 'episodesCount',
      key: 'episodesCount',
      align: 'right' as const,
      render: (n: number) => <Tag>{n}</Tag>,
    },
    {
      title: 'Il y a',
      dataIndex: 'ago',
      key: 'ago',
      align: 'right' as const,
      render: (a: string) => <Text type="secondary" style={{ fontSize: 12 }}>{a}</Text>,
    },
  ];

  return (
    <div>
      <Title level={3} style={{ marginTop: 0, marginBottom: '1.25rem' }}>Dashboard</Title>

      {/* STATS */}
      <Row gutter={[16, 16]} style={{ marginBottom: '1.75rem' }}>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card size="small">
            <Statistic
              title={<span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Films</span>}
              value={data.movies}
              prefix={<VideoCameraOutlined style={{ color: '#818cf8', marginRight: 8 }} />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{data.tmdbLinkedMovies} liés TMDB</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card size="small">
            <Statistic
              title={<span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Séries</span>}
              value={data.series}
              prefix={<PlaySquareOutlined style={{ color: '#34d399', marginRight: 8 }} />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{data.tmdbLinkedSeries} liés TMDB</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card size="small">
            <Statistic
              title={<span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Animes</span>}
              value={data.animes}
              prefix={<TrophyOutlined style={{ color: '#f472b6', marginRight: 8 }} />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {data.animeMovies} films · {data.animeSeries} séries · {data.tmdbLinkedAnimes} liés TMDB
            </Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card size="small">
            <Statistic
              title={<span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Épisodes</span>}
              value={data.totalEpisodes}
              prefix={<FileTextOutlined style={{ color: '#38bdf8', marginRight: 8 }} />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>{data.completeSeries} séries complètes</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8} xl={4}>
          <Card size="small">
            <Statistic
              title={<span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Liens morts</span>}
              value={data.deadLinks}
              valueStyle={{ color: data.deadLinks > 0 ? '#f87171' : '#34d399' }}
              prefix={<WarningOutlined style={{ color: data.deadLinks > 0 ? '#f87171' : '#34d399', marginRight: 8 }} />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>Uptime: {uptime(data.uptime)}</Text>
          </Card>
        </Col>
        {uqload && (
          <Col xs={24} sm={12} lg={8} xl={4}>
            <Card size="small">
              <Statistic
                title={<span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>Uqload</span>}
                value={`${formatBytes(uqload.account?.storageUsed)} / ${formatBytes(uqload.account?.storageLeft)}`}
                valueStyle={{ fontSize: 18 }}
                prefix={<CloudUploadOutlined style={{ color: '#fbbf24', marginRight: 8 }} />}
              />
              <Text type="warning" style={{ fontSize: 12 }}>
                {uqload.pending?.movies ?? 0} films · {uqload.pending?.series ?? 0} épisodes en attente
              </Text>
            </Card>
          </Col>
        )}
      </Row>

      {/* SHORTCUTS */}
      <Title level={5} style={{ marginBottom: '0.75rem' }}>Raccourcis</Title>
      <Space wrap style={{ marginBottom: '1.75rem' }}>
        {SHORTCUTS.map(s => (
          <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
            <Button
              style={{
                display: 'inline-flex', alignItems: 'center', color: '#c5cad6',
                borderColor: '#242a38', background: '#141821',
              }}
            >
              <span style={{ color: s.color, marginRight: 6 }}>{s.icon}</span>
              {s.label}
              <ArrowRightOutlined style={{ fontSize: 10, color: '#6b7488', marginLeft: 8 }} />
            </Button>
          </Link>
        ))}
      </Space>

      {/* HEALTH */}
      <Title level={5} style={{ marginBottom: '0.75rem' }}>État des services</Title>
      <Space wrap size={[8, 8]} style={{ marginBottom: '1.75rem' }}>
        {Object.entries(data.health || {}).map(([key, h]) => (
          <Tag key={key} color={healthColor(h.status)} style={{ padding: '0.25rem 0.625rem' }}>
            <span style={{ textTransform: 'capitalize', fontWeight: 500, marginRight: 6 }}>{key}</span>
            {h.message}
          </Tag>
        ))}
      </Space>

      {/* RECENT */}
      <Row gutter={[16, 16]} style={{ marginBottom: '1.75rem' }}>
        <Col xs={24} lg={12}>
          <Card
            title="Derniers films ajoutés"
            size="small"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              rowKey="_id"
              size="small"
              dataSource={data.recent?.movies || []}
              columns={movieColumns}
              pagination={false}
              locale={{ emptyText: <Empty description="Aucun film" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title="Dernières séries ajoutées"
            size="small"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              rowKey="_id"
              size="small"
              dataSource={data.recent?.series || []}
              columns={serieColumns}
              pagination={false}
              locale={{ emptyText: <Empty description="Aucune série" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>
      </Row>

      {/* RECENT ANIMES */}
      <Row gutter={[16, 16]} style={{ marginBottom: '1.75rem' }}>
        <Col xs={24} lg={12}>
          <Card
            title="Derniers animes ajoutés"
            size="small"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              rowKey="_id"
              size="small"
              dataSource={data.recent?.animes || []}
              columns={animeColumns}
              pagination={false}
              locale={{ emptyText: <Empty description="Aucun anime" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Scraping animes">
            <Statistic
              value={scraper?.animes ? `Page ${scraper.animes.lastPage}` : '—'}
              valueStyle={{ fontSize: 22 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {scraper?.animes ? new Date(scraper.animes.updatedAt).toLocaleString() : 'Aucun scraping'}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* SCRAPER STATE */}
      <Row gutter={[16, 16]} style={{ marginBottom: '1.75rem' }}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Scraping films">
            <Statistic
              value={scraper?.films ? `Page ${scraper.films.lastPage}` : '—'}
              valueStyle={{ fontSize: 22 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {scraper?.films ? new Date(scraper.films.updatedAt).toLocaleString() : 'Aucun scraping'}
            </Text>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="Scraping séries">
            <Statistic
              value={scraper?.series ? `Page ${scraper.series.lastPage}` : '—'}
              valueStyle={{ fontSize: 22 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {scraper?.series ? new Date(scraper.series.updatedAt).toLocaleString() : 'Aucun scraping'}
            </Text>
          </Card>
        </Col>
      </Row>

      {/* ACTIONS */}
      <Title level={5} style={{ marginBottom: '0.75rem' }}>Actions</Title>
      <Space wrap>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => { adminTriggerScrape('series'); setConfigMsg('Scraping série déclenché'); }}>
          Lancer scraping séries
        </Button>
        <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => { adminTriggerScrape('films'); setConfigMsg('Scraping films déclenché'); }}>
          Lancer scraping films
        </Button>
        <Button icon={<ClearOutlined />} onClick={() => { adminClearCache(); setConfigMsg('Cache TMDB vidé'); }}>
          Vider cache TMDB
        </Button>
      </Space>
      {configMsg && (
        <div style={{ marginTop: '0.75rem' }}>
          <Alert type="success" showIcon message={configMsg} style={{ maxWidth: 400 }} />
        </div>
      )}
    </div>
  );
}

function formatBytes(bytes: number | string): string {
  const n = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  if (!n || isNaN(n)) return '?';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0;
  let size = n;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

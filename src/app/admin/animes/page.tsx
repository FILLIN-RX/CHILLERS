'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminGetCollection } from '@/services/admin';
import { Typography, Input, Space, Card, Tag, Pagination, Spin, Empty } from 'antd';
import { SearchOutlined, VideoCameraOutlined, FolderOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface AnimeItem {
  _id: string;
  titre: string;
  pageUrl: string;
  kind: 'movie' | 'series';
  episodes?: { episode: string; lien: string }[];
  lien?: string;
  tmdbId?: number;
  createdAt: string;
}

export default function AdminAnimes() {
  const [items, setItems] = useState<AnimeItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const limit = 50;

  const fetch = useCallback(async (search: string, p: number) => {
    setLoading(true);
    try {
      const res = await adminGetCollection('animes', search, p, limit);
      if (res.success && res.data) {
        const d = res.data as { items: AnimeItem[]; total: number; totalPages: number; page: number };
        setItems(d.items);
        setTotal(d.total);
        setTotalPages(d.totalPages);
        setPage(d.page);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(q, page); }, [fetch, q, page]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <Title level={3} style={{ margin: 0 }}>
          Animes <Text type="secondary" style={{ fontWeight: 400, fontSize: '1rem' }}>({total})</Text>
        </Title>
      </div>

      <Input
        placeholder="Rechercher un anime..."
        value={q}
        onChange={e => setQ(e.target.value)}
        onPressEnter={() => { setPage(1); fetch(q, 1); }}
        allowClear
        prefix={<SearchOutlined style={{ color: '#6b7488' }} />}
        style={{ maxWidth: 420, marginBottom: '1.25rem' }}
      />

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#6b7488' }}>
          <Spin /> Chargement...
        </div>
      ) : items.length === 0 ? (
        <Empty description="Aucun anime trouvé" />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
            {items.map(a => {
              const episodeCount = a.kind === 'series' ? (a.episodes?.length || 0) : 1;
              const tmdbOk = !!a.tmdbId;
              return (
                <Card
                  key={a._id}
                  size="small"
                  hoverable
                  onClick={() => router.push(`/admin/animes/${a._id}?kind=${a.kind}`)}
                  styles={{ body: { padding: '1.125rem' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    {a.kind === 'movie'
                      ? <VideoCameraOutlined style={{ color: '#a99bf0', fontSize: 20, marginRight: '0.75rem', marginTop: 2, flexShrink: 0 }} />
                      : <FolderOutlined style={{ color: '#a99bf0', fontSize: 20, marginRight: '0.75rem', marginTop: 2, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e6e9f0', fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.titre}
                      </div>
                    </div>
                    <Space size={4} style={{ flexShrink: 0, marginInlineEnd: 0 }}>
                      <Tag color={a.kind === 'movie' ? 'geekblue' : 'purple'} style={{ marginInlineEnd: 0 }}>
                        {a.kind === 'movie' ? 'Film' : 'Série'}
                      </Tag>
                      <Tag color={tmdbOk ? 'success' : 'error'} style={{ marginInlineEnd: 0 }}>
                        {tmdbOk ? 'TMDB' : '—'}
                      </Tag>
                    </Space>
                  </div>

                  <Space size="large">
                    <div>
                      <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {a.kind === 'movie' ? 'Lien' : 'Épisodes'}
                      </Text>
                      <Text strong>{episodeCount}</Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouté</Text>
                      <Text>{new Date(a.createdAt).toLocaleDateString()}</Text>
                    </div>
                  </Space>
                </Card>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
              <Pagination
                current={page}
                total={total}
                pageSize={limit}
                showSizeChanger={false}
                onChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
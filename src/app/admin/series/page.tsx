'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { adminGetCollection } from '@/services/admin';
import { Typography, Input, Button, Space, Card, Tag, Pagination, Spin, Empty } from 'antd';
import { SearchOutlined, FolderOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface Serie {
  _id: string;
  titre: string;
  pageUrl: string;
  episodes: { episode: string; lien: string }[];
  tmdbId?: number;
  createdAt: string;
}

export default function AdminSeries() {
  const [items, setItems] = useState<Serie[]>([]);
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
      const res = await adminGetCollection('series', search, p, limit);
      if (res.success && res.data) {
        const d = res.data as { items: Serie[]; total: number; totalPages: number; page: number };
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
          Séries <Text type="secondary" style={{ fontWeight: 400, fontSize: '1rem' }}>({total})</Text>
        </Title>
      </div>

      <Input
        placeholder="Rechercher une série..."
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
        <Empty description="Aucune série trouvée" />
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
            {items.map(s => {
              const deadCount = s.episodes.filter(e => !e.lien || e.lien === '#').length;
              const tmdbOk = !!s.tmdbId;
              return (
                <Card
                  key={s._id}
                  size="small"
                  hoverable
                  onClick={() => router.push(`/admin/series/${s._id}`)}
                  styles={{ body: { padding: '1.125rem' } }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <FolderOutlined style={{ color: '#a99bf0', fontSize: 20, marginRight: '0.75rem', marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#e6e9f0', fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {s.titre}
                      </div>
                    </div>
                    <Tag color={tmdbOk ? 'success' : 'error'} style={{ flexShrink: 0, marginInlineEnd: 0 }}>
                      {tmdbOk ? 'TMDB' : '—'}
                    </Tag>
                  </div>

                  <Space size="large">
                    <div>
                      <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Épisodes</Text>
                      <Text strong>{s.episodes.length}</Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Liens morts</Text>
                      <Text strong style={{ color: deadCount > 0 ? '#f87171' : '#34d399' }}>{deadCount}</Text>
                    </div>
                    <div>
                      <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ajouté</Text>
                      <Text>{new Date(s.createdAt).toLocaleDateString()}</Text>
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

'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminGetConvertedLinks } from '@/services/admin';
import { Typography, Table, Input, Button, Tag, Spin, Empty } from 'antd';
import { ReloadOutlined, SearchOutlined, LinkOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface LinkItem {
  _id: string;
  titre: string;
  lien: string;
  lienOriginal: string;
  fileCode?: string;
  createdAt: string;
}

export default function AdminLiens() {
  const [items, setItems] = useState<LinkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 50;

  const fetch = useCallback(async (search: string, p: number) => {
    setLoading(true);
    try {
      const res = await adminGetConvertedLinks(search, p, limit);
      if (res.success && res.data) {
        const d = res.data as { items: LinkItem[]; total: number; totalPages: number; page: number };
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

  const columns = [
    {
      title: 'Titre',
      dataIndex: 'titre',
      key: 'titre',
      render: (t: string) => <span style={{ color: '#e6e9f0', fontWeight: 500 }}>{t}</span>,
    },
    {
      title: 'Ancien lien',
      dataIndex: 'lienOriginal',
      key: 'lienOriginal',
      render: (l: string) => l ? (
        <a
          href={l}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#f87171', fontSize: 12, wordBreak: 'break-all' }}
          title={l}
        >
          <LinkOutlined /> {l.substring(0, 50)}...
        </a>
      ) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Nouveau lien',
      dataIndex: 'lien',
      key: 'lien',
      render: (l: string) => (
        <a
          href={l}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#34d399', fontSize: 12, wordBreak: 'break-all' }}
          title={l}
        >
          <LinkOutlined /> {l.substring(0, 50)}...
        </a>
      ),
    },
    {
      title: 'DoodStream',
      dataIndex: 'fileCode',
      key: 'fileCode',
      align: 'center' as const,
      render: (f: string) => f ? <Tag color="success">✓</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Ajouté',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => <Text type="secondary" style={{ fontSize: 12 }}>{new Date(d).toLocaleDateString()}</Text>,
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <Title level={3} style={{ margin: 0 }}>
          Liens convertis{' '}
          <Text type="secondary" style={{ fontWeight: 400, fontSize: '1rem' }}>({total})</Text>
        </Title>
        <Button icon={<ReloadOutlined />} onClick={() => fetch(q, page)}>
          Actualiser
        </Button>
      </div>

      <Input
        placeholder="Rechercher par titre..."
        value={q}
        onChange={e => setQ(e.target.value)}
        onPressEnter={() => { setPage(1); fetch(q, 1); }}
        allowClear
        prefix={<SearchOutlined style={{ color: '#6b7488' }} />}
        style={{ maxWidth: 420, marginBottom: '1.25rem' }}
      />

      <Table<LinkItem>
        rowKey="_id"
        size="middle"
        loading={loading}
        dataSource={items}
        columns={columns}
        scroll={{ x: 900 }}
        locale={{ emptyText: loading ? <Spin /> : <Empty description="Aucun lien converti trouvé" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
        pagination={{
          current: page,
          pageSize: limit,
          total,
          showSizeChanger: false,
          onChange: (p) => setPage(p),
        }}
      />
    </div>
  );
}

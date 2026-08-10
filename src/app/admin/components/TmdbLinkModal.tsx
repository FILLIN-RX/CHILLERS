'use client';

import { useState, useEffect, useRef } from 'react';
import { searchMedia } from '@/services/media';
import { adminLinkTmdb } from '@/services/admin';
import { Modal, Input, Spin, Empty, Tag, Typography, Button } from 'antd';
import type { InputRef } from 'antd';
import { SearchOutlined, LinkOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface TmdbSearchResult {
  id: string;
  title: string;
  type: string;
  year: number;
  posterUrl: string;
  genres: string[];
}

interface TmdbLinkModalProps {
  type: 'movies' | 'series';
  docId: string;
  currentTmdbId?: number | null;
  onClose: () => void;
  onLinked: (tmdbId: number) => void;
}

export default function TmdbLinkModal({ type, docId, currentTmdbId, onClose, onLinked }: TmdbLinkModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TmdbSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const inputRef = useRef<InputRef>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchMedia(query, 1);
        const filtered = data
          .filter(r => r.type === (type === 'movies' ? 'movie' : 'series') && !isNaN(Number(r.id)) && Number(r.id) > 0)
          .slice(0, 8)
          .map(r => ({ id: r.id, title: r.title, type: r.type, year: r.year, posterUrl: r.posterUrl, genres: r.genres }));
        setResults(filtered);
      } catch { } finally { setLoading(false); }
    }, 400);
    return () => clearTimeout(timer);
  }, [query, type]);

  const handleLink = async (tmdbId: number) => {
    setLinking(true);
    try {
      const res = await adminLinkTmdb(type, docId, tmdbId);
      if (res.success) {
        onLinked(tmdbId);
        onClose();
      }
    } catch { } finally { setLinking(false); }
  };

  return (
    <Modal
      open
      title="Lier à TMDB"
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
    >
      <Input
        ref={inputRef}
        placeholder="Rechercher sur TMDB..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        prefix={<SearchOutlined style={{ color: '#6b7488' }} />}
        allowClear
        style={{ marginBottom: '1rem' }}
      />

      {loading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <Spin />
        </div>
      ) : results.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={query ? 'Aucun résultat' : 'Tapez un titre pour chercher'}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {results.map(r => {
            const isCurrent = Number(r.id) === currentTmdbId;
            return (
              <div
                key={r.id}
                onClick={() => handleLink(Number(r.id))}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem',
                  borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s',
                  background: isCurrent ? 'rgba(52,211,153,0.12)' : 'transparent',
                }}
                onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = '#0f1219'; }}
                onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.posterUrl} alt="" style={{ width: 40, height: 60, borderRadius: 6, objectFit: 'cover', background: '#1a1f2b' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e6e9f0', fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.title}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {r.year} · {r.genres.slice(0, 2).join(', ')}
                  </Text>
                </div>
                {isCurrent ? (
                  <Tag color="success">LIÉ</Tag>
                ) : (
                  <Button
                    type="text"
                    size="small"
                    loading={linking}
                    icon={<LinkOutlined />}
                    onClick={(e) => { e.stopPropagation(); handleLink(Number(r.id)); }}
                  >
                    Lier
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

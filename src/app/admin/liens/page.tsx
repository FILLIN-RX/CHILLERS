'use client';

import { useEffect, useState, useCallback } from 'react';
import { adminGetConvertedLinks } from '@/app/api';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
  const limit = 50;

  const fetch = useCallback(async (search: string, p: number) => {
    setLoading(true);
    try {
      const res = await adminGetConvertedLinks(search, p, limit);
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetch(q, 1);
  };

  const inputStyle: React.CSSProperties = {
    padding: '0.625rem',
    borderRadius: '8px',
    border: '1px solid #333',
    background: '#222',
    color: '#fff',
    fontSize: '0.875rem',
    flex: 1,
    outline: 'none',
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>
          Liens convertis <span style={{ color: '#6b6b80', fontSize: '1rem', fontWeight: 400 }}>({total})</span>
        </h1>
        <button
          onClick={() => fetch(q, page)}
          style={{
            padding: '0.5rem 1rem', borderRadius: 8, border: 'none',
            background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.8125rem',
          }}
        >
          ↻ Actualiser
        </button>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input
          placeholder="Rechercher par titre..."
          value={q}
          onChange={e => setQ(e.target.value)}
          style={inputStyle}
        />
        <button type="submit" style={{ padding: '0.625rem 1.25rem', borderRadius: '8px', border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: '0.875rem' }}>
          Rechercher
        </button>
      </form>

      {loading ? (
        <p style={{ color: '#888' }}>Chargement...</p>
      ) : items.length === 0 ? (
        <p style={{ color: '#888' }}>Aucun lien converti trouvé</p>
      ) : (
        <>
          <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: '12px', overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #2a2a2a', color: '#888', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Titre</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Ancien lien</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Nouveau lien</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>DoodStream</th>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Ajouté</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item._id} style={{ borderBottom: '1px solid #2a2a2a' }}>
                    <td style={{ padding: '0.75rem 1rem', color: '#fff', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {item.titre}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      {item.lienOriginal ? (
                        <a
                          href={item.lienOriginal}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#ef4444', textDecoration: 'none', fontSize: '0.75rem', wordBreak: 'break-all' }}
                          title={item.lienOriginal}
                        >
                          {item.lienOriginal.substring(0, 50)}...
                        </a>
                      ) : (
                        <span style={{ color: '#6b6b80' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 1rem' }}>
                      <a
                        href={item.lien}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#22c55e', textDecoration: 'none', fontSize: '0.75rem', wordBreak: 'break-all' }}
                        title={item.lien}
                      >
                        {item.lien.substring(0, 50)}...
                      </a>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                      <span style={{ color: item.fileCode ? '#22c55e' : '#6b6b80', fontSize: '0.75rem' }}>
                        {item.fileCode ? '✓' : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#888', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #333', background: '#222', color: page <= 1 ? '#555' : '#fff', cursor: page <= 1 ? 'default' : 'pointer', fontSize: '0.8125rem' }}>
                ←
              </button>
              <span style={{ color: '#888', padding: '0.5rem', fontSize: '0.8125rem' }}>
                {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #333', background: '#222', color: page >= totalPages ? '#555' : '#fff', cursor: page >= totalPages ? 'default' : 'pointer', fontSize: '0.8125rem' }}>
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
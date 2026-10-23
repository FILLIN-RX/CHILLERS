'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { adminGetTmdbStats, adminTriggerTmdbLink } from '@/services/admin';
import { Alert, Button, Card, Col, Row, Spin, Typography, message } from '@/components/admin/ui';
import { ArrowRightOutlined, LinkOutlined, ReloadOutlined } from '@/components/admin/icons';

const { Title, Text } = Typography;
type LinkStats = { total: number; linked: number; unlinked: number };
type Stats = { movies?: LinkStats; series?: LinkStats };

export default function AdminTmdb() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [running, setRunning] = useState<'movies' | 'series' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await adminGetTmdbStats();
      if (!res.success || !res.data) throw new Error(res.message || 'Impossible de charger les statistiques TMDB.');
      setStats(res.data as Stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement.');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const run = async (type: 'movies' | 'series') => {
    setRunning(type);
    try {
      const res = await adminTriggerTmdbLink(type);
      if (!res.success) throw new Error(res.message || 'Le traitement TMDB n’a pas démarré.');
      message.success(res.data?.message || `Liaison automatique ${type === 'movies' ? 'des films' : 'des séries'} lancée.`);
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Erreur lors du lancement.');
    } finally {
      setRunning(null);
    }
  };

  const cards = [
    { label: 'Films', value: stats?.movies, kind: 'movies' as const },
    { label: 'Séries', value: stats?.series, kind: 'series' as const },
  ];

  return (
    <main className="tmdb-hub">
      <header className="tmdb-hub-heading">
        <div><span className="catalog-eyebrow">RÉFÉRENTIEL MÉDIAS</span><Title level={2}>Liaison TMDB</Title><Text type="secondary">Relie les fiches locales aux bonnes métadonnées et garde les affiches, titres et saisons cohérents.</Text></div>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Actualiser</Button>
      </header>
      {error && <Alert type="error" showIcon message={error} style={{ margin: '16px 0' }} />}
      {loading ? <div className="tmdb-hub-loading"><Spin /> Chargement des liaisons…</div> : (
        <>
          <Row gutter={[14, 14]} className="tmdb-hub-stats">
            {cards.map(({ label, value, kind }) => (
              <Col xs={24} md={12} key={kind}>
                <Card>
                  <div className="tmdb-stat-label">{label}</div>
                  <div className="tmdb-stat-total">{(value?.total || 0).toLocaleString('fr-FR')} <small>fiches</small></div>
                  <div className="tmdb-stat-line"><span>{(value?.linked || 0).toLocaleString('fr-FR')} liées</span><span>{(value?.unlinked || 0).toLocaleString('fr-FR')} à traiter</span></div>
                  <div className="tmdb-progress"><span style={{ width: `${value?.total ? Math.min(100, Math.round((value.linked / value.total) * 100)) : 0}%` }} /></div>
                  <Button type="text" icon={<LinkOutlined />} loading={running === kind} disabled={running !== null} onClick={() => void run(kind)}>Lancer la liaison automatique</Button>
                </Card>
              </Col>
            ))}
          </Row>
          <Card className="tmdb-hub-queue">
            <div><span className="catalog-eyebrow">REVUE MANUELLE</span><h2>Valide les correspondances une par une</h2><p>La file affiche les fiches sans identifiant TMDB, propose des résultats de recherche et signale les années qui ne concordent pas.</p></div>
            <Link className="tmdb-queue-link" href="/admin/catalogue">Ouvrir la file de liaison <ArrowRightOutlined /></Link>
          </Card>
        </>
      )}
    </main>
  );
}

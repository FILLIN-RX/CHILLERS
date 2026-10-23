'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Card, Col, Empty, Row, Spin, Statistic, Table, Typography } from '@/components/admin/ui';
import { adminGetTrafficReport, type AdminTrafficReport } from '@/services/admin';

const { Title, Text } = Typography;

function TrafficChart({ daily }: { daily: AdminTrafficReport['daily'] }) {
  const height = 150;
  const width = 720;
  const max = Math.max(1, ...daily.map(item => item.pageViews));
  const points = daily.map((item, index) => `${(index / Math.max(1, daily.length - 1)) * width},${height - (item.pageViews / max) * 126}`).join(' ');
  return <div style={{ overflowX: 'auto' }}>
    <svg viewBox={`0 0 ${width} ${height + 22}`} role="img" aria-label="Pages vues quotidiennes" style={{ display: 'block', width: '100%', minWidth: 520, height: height + 22 }}>
      {[18, 58, 98, 150].map(y => <line key={y} x1="0" x2={width} y1={y} y2={y} stroke="#edf0f4" strokeDasharray="4 6" />)}
      <polyline points={`0,${height} ${points} ${width},${height}`} fill="none" stroke="#3478f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {daily.length > 0 && <><text x="0" y="170" fill="#98a2b3" fontSize="11">{new Date(`${daily[0].day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text><text x={width} y="170" fill="#98a2b3" fontSize="11" textAnchor="end">{new Date(`${daily[daily.length - 1].day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text></>}
    </svg>
  </div>;
}

export default function AdminAnalyticsPage() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [report, setReport] = useState<AdminTrafficReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminGetTrafficReport(days);
      if (!result.success || !result.data) throw new Error(result.message || 'Rapport indisponible');
      setReport(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Rapport indisponible');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const totals = useMemo(() => (report?.daily || []).reduce((sum, day) => ({
    pageViews: sum.pageViews + day.pageViews,
    visitors: sum.visitors + day.visitors,
    sessions: sum.sessions + day.sessions,
  }), { pageViews: 0, visitors: 0, sessions: 0 }), [report]);

  const pageColumns = [
    { title: 'Page', dataIndex: 'pagePath', key: 'pagePath', render: (path: string) => <Text>{path}</Text> },
    { title: 'Pages vues', dataIndex: 'pageViews', key: 'pageViews', align: 'right' as const, sorter: (a: { pageViews: number }, b: { pageViews: number }) => a.pageViews - b.pageViews },
  ];
  const campaignColumns = [
    { title: 'Source', dataIndex: 'source', key: 'source', render: (value: string) => value || 'direct' },
    { title: 'Support', dataIndex: 'medium', key: 'medium', render: (value: string) => value || '—' },
    { title: 'Campagne', dataIndex: 'campaign', key: 'campaign', render: (value: string) => value || '—' },
    { title: 'Visiteurs/jour', dataIndex: 'visitors', key: 'visitors', align: 'right' as const },
    { title: 'Sessions/jour', dataIndex: 'sessions', key: 'sessions', align: 'right' as const },
    { title: 'Pages vues', dataIndex: 'pageViews', key: 'pageViews', align: 'right' as const },
  ];
  const dailyColumns = [
    { title: 'Date', dataIndex: 'day', key: 'day', render: (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC' }) },
    { title: 'Visiteurs uniques', dataIndex: 'visitors', key: 'visitors', align: 'right' as const },
    { title: 'Sessions', dataIndex: 'sessions', key: 'sessions', align: 'right' as const },
    { title: 'Pages vues', dataIndex: 'pageViews', key: 'pageViews', align: 'right' as const },
  ];
  const campaignRows = (report?.campaigns || []).map(row => ({
    ...row,
    key: `${row.source}-${row.medium}-${row.campaign}`,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11, letterSpacing: '.12em' }}>AUDIENCE & DIFFUSION</Text>
          <Title level={2} style={{ margin: '4px 0' }}>Ce qui attire votre communauté</Title>
          <Text type="secondary">Repérez les pages qui intéressent les visiteurs et les campagnes qui les amènent.</Text>
        </div>
        <select aria-label="Période du rapport" className="ad-select" value={days} onChange={event => setDays(Number(event.target.value) as 7 | 30 | 90)} style={{ width: 160 }}>
          <option value={7}>7 derniers jours</option><option value={30}>30 derniers jours</option><option value={90}>90 derniers jours</option>
        </select>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
      {loading && !report ? <div style={{ padding: 48, textAlign: 'center' }}><Spin /></div> : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={8}><Card><Statistic title="Pages vues" value={totals.pageViews} /></Card></Col>
            <Col xs={24} sm={8}><Card><Statistic title="Visiteurs uniques · cumul journalier" value={totals.visitors} /></Card></Col>
            <Col xs={24} sm={8}><Card><Statistic title="Sessions · cumul journalier" value={totals.sessions} /></Card></Col>
          </Row>
          <Card title="Trafic quotidien" style={{ marginBottom: 16 }} extra={<Text type="secondary">{days} jours</Text>}>
            {report?.daily.length ? <TrafficChart daily={report.daily} /> : <Empty description="Les visites apparaîtront ici." />}
          </Card>
          <Text type="secondary" style={{ display: 'block', marginBottom: 18 }}>
            Les visiteurs et sessions sont dédupliqués chaque jour. Les identifiants anonymes temporaires expirent après 30 jours; les totaux agrégés sont conservés 12 mois.
          </Text>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card title="Pages les plus consultées">
                <Table rowKey="pagePath" size="small" pagination={{ pageSize: 8 }} columns={pageColumns} dataSource={report?.pages || []} locale={{ emptyText: 'Pas encore de visites' }} loading={loading} />
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card title="Sources et campagnes (UTM)">
                <Table rowKey="key" size="small" pagination={{ pageSize: 8 }} columns={campaignColumns} dataSource={campaignRows} locale={{ emptyText: 'Aucune campagne enregistrée' }} loading={loading} scroll={{ x: 560 }} />
              </Card>
            </Col>
          </Row>
          <Card title="Activité quotidienne" style={{ marginTop: 16 }}>
            <Table rowKey="day" size="small" pagination={{ pageSize: 10 }} columns={dailyColumns} dataSource={[...(report?.daily || [])].reverse()} locale={{ emptyText: 'Pas encore de visites' }} loading={loading} />
          </Card>
        </>
      )}
    </div>
  );
}

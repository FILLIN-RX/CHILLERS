'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Col, Input, Row, Select, Spin, Statistic, Table, Tag, Typography } from '@/components/admin/ui';
import { CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, DollarOutlined, SwapOutlined } from '@/components/admin/icons';
import { adminGetTransactions, type AdminTransaction, type AdminTransactionsReport } from '@/services/admin';

const { Title, Text } = Typography;
const STATUS_LABEL: Record<AdminTransaction['status'], string> = {
  SUCCESS: 'Réussi', PENDING: 'En attente', FAILED: 'Échoué', CANCELLED: 'Annulé',
};
const STATUS_COLOR: Record<AdminTransaction['status'], string> = {
  SUCCESS: 'success', PENDING: 'processing', FAILED: 'error', CANCELLED: 'default',
};
const dateInput = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function AdminTransactionsPage() {
  const now = new Date();
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 29); return dateInput(d); });
  const [to, setTo] = useState(() => dateInput(now));
  const [status, setStatus] = useState<'ALL' | AdminTransaction['status']>('ALL');
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<AdminTransactionsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminGetTransactions({
        from: new Date(`${from}T00:00:00`).toISOString(),
        to: new Date(`${to}T23:59:59.999`).toISOString(),
        status,
        page,
        limit: 20,
      });
      if (!result.success || !result.data) throw new Error(result.message || 'Impossible de charger les transactions.');
      setReport(result.data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les transactions.');
    } finally {
      setLoading(false);
    }
  }, [from, to, status, page]);

  useEffect(() => { void load(); }, [load]);

  const formatMoney = (amount: number, currency: string) => new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(amount);

  const columns = [
    { title: 'Référence', dataIndex: 'reference', key: 'reference', render: (value: string | undefined, row: AdminTransaction) => <Text strong>{value || row.saspayPaymentId || row._id.slice(-10).toUpperCase()}</Text> },
    { title: 'Client', dataIndex: 'userId', key: 'customer', render: (value: AdminTransaction['userId']) => typeof value === 'object' && value ? <><div>{value.username || 'Compte client'}</div><Text type="secondary" style={{ fontSize: 12 }}>{value.email}</Text></> : <Tag>Don anonyme</Tag> },
    { title: 'Objet', dataIndex: 'planName', key: 'planName', render: (value: string | undefined, row: AdminTransaction) => value || (row.planCode === 'don' ? 'Don' : row.planCode) },
    { title: 'Moyen', key: 'method', render: (_: unknown, row: AdminTransaction) => <>{row.network}<Text type="secondary"> · {row.country}</Text></> },
    { title: 'Montant', key: 'amount', align: 'right' as const, render: (_: unknown, row: AdminTransaction) => <Text strong>{formatMoney(row.amount, row.currency)}</Text> },
    { title: 'Statut', dataIndex: 'status', key: 'status', render: (value: AdminTransaction['status']) => <Tag color={STATUS_COLOR[value]}>{STATUS_LABEL[value]}</Tag> },
    { title: 'Date', dataIndex: 'createdAt', key: 'createdAt', render: (value: string) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) },
  ];

  const totals = report?.summary.totalsByCurrency || [];
  const successful = report?.summary.statusCounts.SUCCESS || 0;
  const pending = report?.summary.statusCounts.PENDING || 0;
  const failed = (report?.summary.statusCounts.FAILED || 0) + (report?.summary.statusCounts.CANCELLED || 0);

  return <div className="admin-transactions-page">
    <header className="admin-transactions-heading">
      <div><Text type="secondary">FINANCES</Text><Title level={2} style={{ margin: '4px 0' }}>Transactions</Title><Text type="secondary">Suivez les paiements et les montants réellement confirmés.</Text></div>
      <div className="admin-transaction-filters">
        <div className="admin-date-range"><Input type="date" aria-label="Date de début" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} /><span>au</span><Input type="date" aria-label="Date de fin" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} /></div>
        <Select value={status} onChange={value => { setStatus(value); setPage(1); }} style={{ width: 155 }} options={[
          { value: 'ALL', label: 'Tous les statuts' }, { value: 'SUCCESS', label: 'Réussis' }, { value: 'PENDING', label: 'En attente' }, { value: 'FAILED', label: 'Échoués' }, { value: 'CANCELLED', label: 'Annulés' },
        ]} />
      </div>
    </header>

    {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
    <Row gutter={[14, 14]} style={{ marginBottom: 18 }}>
      <Col xs={24} sm={12} xl={6}><Card><Statistic title="Encaissé · par devise" value={report ? totals.length ? totals.map(item => formatMoney(item.amount, item._id)).join(' / ') : '0 XAF' : '—'} valueStyle={{ fontSize: 20 }} prefix={<DollarOutlined />} /></Card></Col>
      <Col xs={12} xl={6}><Card><Statistic title="Paiements confirmés" value={successful} prefix={<CheckCircleOutlined />} /></Card></Col>
      <Col xs={12} xl={6}><Card><Statistic title="En attente" value={pending} prefix={<ClockCircleOutlined />} /></Card></Col>
      <Col xs={12} xl={6}><Card><Statistic title="Échoués ou annulés" value={failed} prefix={<CloseCircleOutlined />} /></Card></Col>
    </Row>

    <Card title={<span><SwapOutlined /> Historique des paiements</span>} extra={<Text type="secondary">{report?.total ?? 0} transaction(s)</Text>}>
      {loading && !report ? <div style={{ padding: 56, textAlign: 'center' }}><Spin /></div> : <Table
        rowKey="_id"
        size="middle"
        columns={columns}
        dataSource={report?.items || []}
        loading={loading}
        scroll={{ x: 900 }}
        pagination={{ current: page, pageSize: report?.limit || 20, total: report?.total || 0, showSizeChanger: false, onChange: setPage, showTotal: count => `${count} transaction(s)` }}
        locale={{ emptyText: 'Aucune transaction sur cette période.' }}
      />}
    </Card>
    <Text type="secondary" style={{ display: 'block', marginTop: 12 }}>Les totaux encaissés incluent uniquement les paiements confirmés. Les montants restent séparés par devise.</Text>
  </div>;
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Spin, Tag } from '@/components/admin/ui';
import { ArrowRightOutlined, CheckCircleOutlined, ClockCircleOutlined, FileSearchOutlined, PlaySquareOutlined, ReloadOutlined, TeamOutlined, VideoCameraOutlined, WarningOutlined } from '@/components/admin/icons';
import { adminGetDashboard, adminGetTransactions, adminGetUsers, type AdminTransaction, type AdminTransactionsReport } from '@/services/admin';

type DashboardData = {
  movies: number; series: number; animes: number; totalEpisodes: number; deadLinks: number;
  health?: Record<string, { status: string; message: string }>;
};
const money = (amount: number, currency: string) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
const customerName = (transaction: AdminTransaction) => typeof transaction.userId === 'object' && transaction.userId
  ? transaction.userId.username || transaction.userId.email || 'Compte client'
  : 'Don anonyme';
const paymentLabel = (status: AdminTransaction['status']) => ({ SUCCESS: 'Réussi', PENDING: 'En attente', FAILED: 'Échoué', CANCELLED: 'Annulé' })[status];

function RevenueChart({ rows, currency }: { rows: AdminTransactionsReport['daily']; currency: string }) {
  const days = useMemo(() => {
    const byDay = new Map<string, number>();
    rows.filter(row => row.currency === currency).forEach(row => byDay.set(row.day, (byDay.get(row.day) || 0) + row.amount));
    return Array.from({ length: 30 }, (_, index) => {
      const date = new Date(); date.setDate(date.getDate() - (29 - index));
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      return { day, amount: byDay.get(day) || 0 };
    });
  }, [rows, currency]);
  const max = Math.max(1, ...days.map(item => item.amount));
  const points = days.map((item, index) => `${(index / (days.length - 1)) * 600},${126 - (item.amount / max) * 104}`).join(' ');
  const area = `0,126 ${points} 600,126`;
  return <div className="dash-chart-scroll"><svg className="dash-chart" viewBox="0 0 600 158" role="img" aria-label={`Encaissements quotidiens en ${currency} sur 30 jours`}>
    <defs><linearGradient id="dash-revenue-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#F42A7C" stopOpacity=".28" /><stop offset="100%" stopColor="#F42A7C" stopOpacity="0" /></linearGradient></defs>
    {[22, 56, 91, 126].map(y => <line key={y} x1="0" x2="600" y1={y} y2={y} stroke="#343237" strokeDasharray="3 6" />)}
    <polygon points={area} fill="url(#dash-revenue-fill)" />
    <polyline points={points} fill="none" stroke="#F42A7C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    {[0, 9, 19, 29].map(index => <text key={index} x={(index / 29) * 600} y="151" fill="#aaa2a8" fontSize="10" textAnchor={index === 0 ? 'start' : index === 29 ? 'end' : 'middle'}>{new Date(`${days[index].day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</text>)}
  </svg></div>;
}

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [payments, setPayments] = useState<AdminTransactionsReport | null>(null);
  const [users, setUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    const from = new Date(); from.setDate(from.getDate() - 29); from.setHours(0, 0, 0, 0);
    const to = new Date(); to.setHours(23, 59, 59, 999);
    try {
      const [dashboardResult, transactionResult, userResult] = await Promise.allSettled([
        adminGetDashboard(), adminGetTransactions({ from: from.toISOString(), to: to.toISOString(), limit: 8 }), adminGetUsers({ page: 1, limit: 1 }),
      ]);
      const dashboard = dashboardResult.status === 'fulfilled' ? dashboardResult.value : null;
      const transactions = transactionResult.status === 'fulfilled' ? transactionResult.value : null;
      const userReport = userResult.status === 'fulfilled' ? userResult.value : null;
      if (dashboard?.success) setData(dashboard.data as DashboardData);
      if (transactions?.success && transactions.data) setPayments(transactions.data);
      if (userReport?.success) setUsers(userReport.total || 0);
      if (!dashboard?.success && !transactions?.success) throw new Error('Les données du tableau de bord ne sont pas disponibles.');
      if (!transactions?.success) setError(transactionResult.status === 'rejected' ? 'Les données de paiement sont momentanément indisponibles.' : transactions?.message || 'Les données de paiement sont momentanément indisponibles.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible de charger le tableau de bord.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const currencies = payments?.summary.totalsByCurrency || [];
  const status = payments?.summary.statusCounts;
  const latest = payments?.items || [];
  const currency = currencies[0]?._id || 'XAF';
  const totals = currencies.reduce((sum, item) => sum + item.count, 0);

  return <div className="dashboard-page">
    <header className="dash-heading">
      <div><span className="dash-eyebrow">ESPACE DE PILOTAGE</span><h1>Vue d’ensemble</h1><p>Les chiffres essentiels de CHILLERS, réunis au même endroit.</p></div>
      <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>Actualiser</Button>
    </header>
    {error && <Alert className="dash-alert" type="warning" showIcon message={error} />}

    <section className="dash-summary" aria-label="Résumé">
      <article className="dash-revenue-card">
        <div className="dash-revenue-top"><div><span className="dash-card-label">ENCAISSEMENTS CONFIRMÉS</span><div className="dash-revenue-amount">{payments ? money(currencies.find(item => item._id === currency)?.amount || 0, currency) : '—'}</div></div><span className="dash-period">30 derniers jours</span></div>
        {currencies.length > 1 && <div className="dash-currency-list">{currencies.slice(1).map(item => <span key={item._id}>{money(item.amount, item._id)}</span>)}</div>}
        {payments ? <RevenueChart rows={payments.daily} currency={currency} /> : <div className="dash-chart-loading"><Spin /></div>}
        <Link className="dash-inline-link" href="/admin/transactions">Voir les encaissements <ArrowRightOutlined /></Link>
      </article>
      <div className="dash-metrics">
        <Metric icon={<CheckCircleOutlined />} label="Paiements réussis" value={status?.SUCCESS} note={`${totals} transaction${totals === 1 ? '' : 's'} sur la période`} tone="success" />
        <Metric icon={<ClockCircleOutlined />} label="En attente" value={status?.PENDING} note="À suivre" tone="pending" />
        <Metric icon={<TeamOutlined />} label="Membres" value={users} note="Comptes enregistrés" tone="members" />
        <Metric icon={<WarningOutlined />} label="Liens à réparer" value={data?.deadLinks} note={data?.deadLinks ? 'Une vérification est nécessaire' : 'Tout est à jour'} tone={data?.deadLinks ? 'danger' : 'success'} />
      </div>
    </section>

    <section className="dash-lower-grid">
      <article className="dash-panel dash-catalogue">
        <div className="dash-panel-heading"><div><span className="dash-card-label">CONTENU</span><h2>Catalogue</h2></div><Link className="dash-inline-link" href="/admin/movies">Gérer <ArrowRightOutlined /></Link></div>
        <div className="dash-catalogue-grid">
          <CatalogMetric icon={<VideoCameraOutlined />} label="Films" value={data?.movies} />
          <CatalogMetric icon={<PlaySquareOutlined />} label="Séries" value={data?.series} />
          <CatalogMetric icon={<PlaySquareOutlined />} label="Animes" value={data?.animes} />
          <CatalogMetric icon={<FileSearchOutlined />} label="Épisodes" value={data?.totalEpisodes} />
        </div>
      </article>
      <article className="dash-panel dash-health">
        <div className="dash-panel-heading"><div><span className="dash-card-label">ÉTAT DU SERVICE</span><h2>Surveillance</h2></div></div>
        {data?.health ? <div className="dash-health-list">{Object.entries(data.health).map(([name, item]) => <div key={name}><span className={`dash-health-dot ${item.status === '✓' ? 'is-ok' : 'is-warning'}`} /><span>{name}</span><span className="dash-health-message">{item.message}</span></div>)}</div> : <p className="dash-muted">Les informations de santé ne sont pas disponibles.</p>}
      </article>
    </section>

    <section className="dash-panel dash-transactions">
      <div className="dash-panel-heading"><div><span className="dash-card-label">ACTIVITÉ RÉCENTE</span><h2>Dernières transactions</h2></div><Link className="dash-inline-link" href="/admin/transactions">Tout voir <ArrowRightOutlined /></Link></div>
      {loading && !payments ? <div className="dash-chart-loading"><Spin /></div> : latest.length ? <>
        <div className="dash-mobile-payments">{latest.map(transaction => <TransactionCard key={transaction._id} transaction={transaction} />)}</div>
        <div className="dash-desktop-table"><table><thead><tr><th>Référence</th><th>Client</th><th>Offre</th><th>Montant</th><th>Statut</th><th>Date</th></tr></thead><tbody>{latest.map(transaction => <tr key={transaction._id}>
          <td className="dash-reference">{transaction.reference || transaction.saspayPaymentId || transaction._id.slice(-10).toUpperCase()}</td><td>{customerName(transaction)}</td><td>{transaction.planName || transaction.planCode}</td><td className="dash-amount">{money(transaction.amount, transaction.currency)}</td><td><StatusTag status={transaction.status} /></td><td>{new Date(transaction.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</td>
        </tr>)}</tbody></table></div>
      </> : <p className="dash-empty">Aucune transaction récente.</p>}
    </section>
  </div>;
}

function Metric({ icon, label, value, note, tone }: { icon: React.ReactNode; label: string; value?: number; note: string; tone: string }) {
  return <article className={`dash-metric dash-metric-${tone}`}><div className="dash-metric-top"><span className="dash-metric-icon">{icon}</span><span>{label}</span></div><strong>{value?.toLocaleString('fr-FR') ?? '—'}</strong><small>{note}</small></article>;
}
function CatalogMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value?: number }) {
  return <div className="dash-catalogue-item"><span className="dash-catalogue-icon">{icon}</span><span>{label}</span><strong>{value?.toLocaleString('fr-FR') ?? '—'}</strong></div>;
}
function StatusTag({ status }: { status: AdminTransaction['status'] }) {
  const color = status === 'SUCCESS' ? 'success' : status === 'PENDING' ? 'warning' : 'error';
  return <Tag color={color}>{paymentLabel(status)}</Tag>;
}
function TransactionCard({ transaction }: { transaction: AdminTransaction }) {
  return <article className="dash-payment-card"><div className="dash-payment-top"><strong>{transaction.planName || transaction.planCode}</strong><StatusTag status={transaction.status} /></div><div className="dash-payment-bottom"><span>{customerName(transaction)}</span><strong>{money(transaction.amount, transaction.currency)}</strong></div><small>{new Date(transaction.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</small></article>;
}

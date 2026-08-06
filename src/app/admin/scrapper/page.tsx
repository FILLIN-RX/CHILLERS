'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  adminScrapperHealth,
  adminScrapperSettings,
  adminScrapperLogs,
  adminScrapperRunningTasks,
  adminScrapperCronStatus,
  adminScrapperState,
  adminScrapperLogsStreamUrl,
  adminScrapperTriggerScrape,
  adminScrapperRunMaintenance,
  adminScrapperCronStart,
  adminScrapperCronStop,
  adminScrapperStopTask,
} from '@/app/api';
import {
  Card, Button, Badge, Tag, Alert, Space, Typography, Descriptions, Spin, Statistic,
} from 'antd';
import {
  PlayCircleOutlined, StopOutlined, ReloadOutlined, CloseOutlined,
  ThunderboltOutlined, CloudServerOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface HealthData {
  status: string;
  uptime: number;
  db: string;
}

interface SettingsData {
  port: string;
  mongoUri: string;
  tmdbToken: string;
  cronRunning: boolean;
}

interface ScraperStateData {
  films: { lastPage: number; updatedAt: string } | null;
  series: { lastPage: number; updatedAt: string } | null;
}

export default function AdminScrapper() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [runningTasks, setRunningTasks] = useState<string[]>([]);
  const [cronRunning, setCronRunning] = useState(false);
  const [scraperState, setScraperState] = useState<ScraperStateData | null>(null);
  const [streamLines, setStreamLines] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [healthRes, settingsRes, tasksRes, cronRes, stateRes] = await Promise.all([
        adminScrapperHealth(),
        adminScrapperSettings(),
        adminScrapperRunningTasks(),
        adminScrapperCronStatus(),
        adminScrapperState(),
      ]);
      if (healthRes.success) { setHealth(healthRes.data); setConnected(true); }
      else setConnected(false);
      if (settingsRes.success) setSettings(settingsRes.data);
      if (tasksRes.success) setRunningTasks(tasksRes.data || []);
      if (cronRes.success) setCronRunning(cronRes.data.running);
      if (stateRes.success) setScraperState(stateRes.data);
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, 5000);
    return () => clearInterval(id);
  }, [fetchAll]);

  useEffect(() => {
    const url = adminScrapperLogsStreamUrl();
    const es = new EventSource(url);
    es.onmessage = (e) => {
      try {
        const { line } = JSON.parse(e.data);
        setStreamLines(prev => [...prev.slice(-499), line]);
      } catch { }
    };
    es.onerror = () => { };
    return () => es.close();
  }, []);

  useEffect(() => {
    if (preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [streamLines]);

  const run = async (label: string, action: () => Promise<any>) => {
    setLastAction(`${label}...`);
    try {
      await action();
      setLastAction(`${label} ✓`);
    } catch {
      setLastAction(`${label} ✗ Erreur`);
    }
    setTimeout(() => fetchAll(), 500);
  };

  const isBusy = (name: string) => runningTasks.includes(name);

  const formatUptime = (s: number) => {
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${d}j ${h}h ${m}m`;
  };

  const ActionButton = ({ label, onClick, color, busyName }: { label: string; onClick: () => void; color?: string; busyName?: string }) => {
    const busy = busyName ? isBusy(busyName) : false;
    return (
      <Button
        loading={busy}
        disabled={busy}
        onClick={onClick}
        style={color ? { background: `${color}22`, borderColor: color, color } : undefined}
      >
        {label}
      </Button>
    );
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <Title level={3} style={{ marginTop: 0, marginBottom: '0.25rem' }}>Scrapper distant</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: '1.25rem' }}>
        Surveillance du service de scraping déporté
      </Text>

      <Alert
        type={loading ? 'info' : connected ? 'success' : 'error'}
        showIcon
        style={{ marginBottom: '1.25rem' }}
        message={
          <Space>
            <span style={{ fontWeight: 600 }}>
              {loading ? 'Connexion...' : connected ? 'Scrapper connecté' : 'Scrapper déconnecté'}
            </span>
            {health && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                Uptime: {formatUptime(health.uptime)} · DB: {health.db}
              </Text>
            )}
          </Space>
        }
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchAll}>Rafraîchir</Button>
        }
      />

      {!connected && !loading && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: '1.25rem' }}
          message="Le scrapper distant est injoignable. Vérifiez que le service tourne et que SCRAPER_API_URL est configuré dans le .env du backend."
        />
      )}

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {scraperState && (
          <Card size="small" title="État du scraping">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Films</Text>
                <div style={{ fontWeight: 600 }}>
                  Dernière page: {scraperState.films ? `#${scraperState.films.lastPage}` : '—'}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {scraperState.films ? new Date(scraperState.films.updatedAt).toLocaleString() : 'Aucun scraping'}
                </Text>
              </div>
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Séries</Text>
                <div style={{ fontWeight: 600 }}>
                  Dernière page: {scraperState.series ? `#${scraperState.series.lastPage}` : '—'}
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {scraperState.series ? new Date(scraperState.series.updatedAt).toLocaleString() : 'Aucun scraping'}
                </Text>
              </div>
            </div>
          </Card>
        )}

        {settings && (
          <Card size="small" title="Configuration distante">
            <Descriptions column={1} size="small" labelStyle={{ color: '#8b93a7' }}>
              <Descriptions.Item label="Port">{settings.port}</Descriptions.Item>
              <Descriptions.Item label="MongoDB">
                <Text style={{ color: settings.mongoUri.includes('✓') ? '#34d399' : '#f87171' }}>{settings.mongoUri}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="TMDB Token">
                <Text style={{ color: settings.tmdbToken.includes('✓') ? '#34d399' : '#f87171' }}>{settings.tmdbToken}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Cron">
                <Tag color={settings.cronRunning ? 'success' : 'error'}>{settings.cronRunning ? 'Actif' : 'Arrêté'}</Tag>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <Card
          size="small"
          title="Cron & Tâches"
          extra={<Badge status={cronRunning ? 'success' : 'error'} text={<Text style={{ fontSize: 12 }}>{cronRunning ? 'Cron actif' : 'Cron arrêté'}</Text>} />}
        >
          {runningTasks.length > 0 && (
            <Alert
              type="success"
              showIcon
              icon={<ThunderboltOutlined />}
              style={{ marginBottom: '0.75rem' }}
              message={<span>Tâches en cours : {runningTasks.map(t => <Tag key={t} color="success">{t}</Tag>)}</span>}
            />
          )}

          <Space wrap style={{ marginBottom: '0.75rem' }}>
            <ActionButton label="Démarrer cron" onClick={() => run('Démarrage cron', adminScrapperCronStart)} color="#34d399" />
            <ActionButton label="Arrêter cron" onClick={() => run('Arrêt cron', adminScrapperCronStop)} color="#f87171" />
          </Space>
          <Space wrap style={{ marginBottom: '0.75rem' }}>
            <ActionButton label="Scraping Films" onClick={() => run('Scraping Films', () => adminScrapperTriggerScrape('films'))} color="#818cf8" busyName="Scraping Films" />
            <ActionButton label="Scraping Séries" onClick={() => run('Scraping Séries', () => adminScrapperTriggerScrape('series'))} color="#818cf8" busyName="Scraping Séries" />
          </Space>
          <Space wrap>
            <ActionButton label="Maint. Liens" onClick={() => run('Maintenance Liens', () => adminScrapperRunMaintenance('dead-links'))} color="#fbbf24" busyName="Maintenance Liens" />
            <ActionButton label="TMDB Films" onClick={() => run('Linking TMDB Films', () => adminScrapperRunMaintenance('tmdb-movies'))} color="#fbbf24" busyName="Linking TMDB Films" />
            <ActionButton label="TMDB Séries" onClick={() => run('Linking TMDB Séries', () => adminScrapperRunMaintenance('tmdb-series'))} color="#fbbf24" busyName="Linking TMDB Séries" />
          </Space>
        </Card>

        {lastAction && (
          <Alert
            message={lastAction}
            action={
              <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setLastAction(null)} />
            }
          />
        )}

        <Card size="small" title="Logs en direct (SSE)">
          <pre ref={preRef} style={{
            background: '#0f1219', color: '#c5cad6', padding: '0.75rem', borderRadius: 8,
            fontSize: 12, lineHeight: 1.5, maxHeight: 400, overflow: 'auto',
            margin: 0, fontFamily: 'monospace', whiteSpace: 'pre-wrap',
          }}>
            {streamLines.length === 0
              ? <span style={{ color: '#6b7488' }}>En attente de logs...</span>
              : streamLines.map((l, i) => <div key={i}>{l}</div>)
            }
          </pre>
        </Card>
      </Space>
    </div>
  );
}

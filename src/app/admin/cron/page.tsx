'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  adminCronStart,
  adminCronStop,
  adminCronStatus,
  adminTriggerScrape,
  adminRunMaintenance,
  adminTriggerTmdbLink,
  adminGetRunningTasks,
  adminStopTask,
  adminListProcesses,
  adminKillProcess,
  adminGetSystemCron,
} from '@/app/api';
import {
  Card, Button, Badge, Tag, Alert, Table, Space, Typography,
} from 'antd';
import {
  PlayCircleOutlined, StopOutlined, ReloadOutlined, ThunderboltOutlined,
  BugOutlined, ArrowRightOutlined, CloseOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

interface OsProcess {
  label: string;
  pid: number;
  cmd: string;
}

interface SystemCron {
  present: boolean;
  lines: string[];
}

const ALL_TASK_NAMES = [
  'Scraping Films', 'Scraping Séries',
  'Maintenance Liens', 'Linking TMDB Films', 'Linking TMDB Séries',
  'Organize Séries Doodstream', 'Sync Séries → MongoDB',
];

export default function AdminCron() {
  const router = useRouter();
  const [cronRunning, setCronRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastTask, setLastTask] = useState<string | null>(null);
  const [runningTasks, setRunningTasks] = useState<string[]>([]);
  const [osProcesses, setOsProcesses] = useState<OsProcess[]>([]);
  const [systemCron, setSystemCron] = useState<SystemCron>({ present: false, lines: [] });
  const [showOsPanel, setShowOsPanel] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const [cronRes, tasksRes, processesRes, sysCronRes] = await Promise.all([
        adminCronStatus(),
        adminGetRunningTasks(),
        adminListProcesses(),
        adminGetSystemCron(),
      ]);
      if (cronRes.success) setCronRunning(cronRes.data.running);
      if (tasksRes.success) setRunningTasks(tasksRes.data || []);
      if (processesRes.success) setOsProcesses(processesRes.data || []);
      if (sysCronRes.success) setSystemCron(sysCronRes.data || { present: false, lines: [] });
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const id = setInterval(fetchStatus, 3000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const run = async (label: string, action: () => Promise<any>) => {
    setLastTask(`${label}...`);
    try {
      await action();
      setLastTask(`${label} ✓ Lancé avec succès`);
    } catch {
      setLastTask(`${label} ✗ Erreur`);
    }
  };

  const isRunning = (label: string) => runningTasks.includes(label);

  const orphanProcesses = osProcesses.filter(p => !runningTasks.includes(p.label));

  const runAll = async (label: string, actions: (() => Promise<any>)[]) => {
    setLastTask(`${label}...`);
    try {
      await Promise.all(actions.map(a => a()));
      setLastTask(`${label} ✓ Lancé avec succès`);
    } catch {
      setLastTask(`${label} ✗ Erreur`);
    }
  };

  const killOrphan = async (pid: number, label: string) => {
    setLastTask(`Tuer PID ${pid} (${label})...`);
    const res = await adminKillProcess(pid);
    if (res?.data?.killed) {
      setLastTask(`PID ${pid} tué ✓`);
    } else {
      setLastTask(`PID ${pid} : ${res?.data?.killed === false ? 'déjà mort' : 'échec'}`);
    }
    fetchStatus();
  };

  const renderTaskButton = (label: string, action: () => Promise<any>, color?: string) => {
    const busy = isRunning(label);
    return (
      <Space size={4}>
        <Button
          loading={busy}
          disabled={busy}
          onClick={() => run(label, action)}
          style={color ? { background: `${color}22`, borderColor: color, color } : undefined}
        >
          {label}
        </Button>
        {busy && (
          <Button
            danger
            size="small"
            icon={<StopOutlined />}
            onClick={async () => {
              const res = await adminStopTask(label);
              if (res?.data?.killed) {
                setLastTask(`${label} ⏹ Arrêt demandé`);
              } else {
                setLastTask(`${label} ⚠ Aucune tâche en cours à arrêter`);
              }
              fetchStatus();
            }}
          >
            Arrêter
          </Button>
        )}
      </Space>
    );
  };

  const osColumns: ColumnsType<OsProcess> = [
    { title: 'Label', dataIndex: 'label', key: 'label', render: (l: string) => <span style={{ fontWeight: 500 }}>{l}</span> },
    { title: 'PID', dataIndex: 'pid', key: 'pid', render: (p: number) => <Text style={{ color: '#fbbf24' }}>{p}</Text> },
    { title: 'Commande', dataIndex: 'cmd', key: 'cmd', render: (c: string) => <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 12 }}>{c}</Text> },
  ];

  return (
    <div style={{ maxWidth: 960 }}>
      <Title level={3} style={{ marginTop: 0, marginBottom: '0.25rem' }}>Tâches planifiées</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: '1.25rem' }}>
        Gère le scraping, la maintenance et les tâches cron
      </Text>

      {systemCron.present && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: '1rem' }}
          message={
            <span style={{ fontWeight: 600 }}>Crontab système active — l&apos;admin n&apos;a pas le contrôle total</span>
          }
          description={
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Text>Une crontab lance des scripts toutes les minutes sans passer par cette interface. Supprimez-la pour garder le contrôle :</Text>
              <pre style={{
                background: '#0f1219', color: '#fbbf24', padding: '0.5rem 0.75rem',
                borderRadius: 6, fontSize: 12, margin: 0, overflow: 'auto',
              }}>
                {systemCron.lines.join('\n')}
              </pre>
              <Text type="secondary" style={{ fontSize: 12 }}>
                → Sur le serveur : <code style={{ background: '#0f1219', padding: '0.1rem 0.3rem', borderRadius: 4 }}>crontab -e</code> puis supprimer les lignes, ou <code style={{ background: '#0f1219', padding: '0.1rem 0.3rem', borderRadius: 4 }}>crontab -r</code> pour tout vider.
              </Text>
            </Space>
          }
        />
      )}

      {orphanProcesses.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: '1rem' }}
          message={<span style={{ fontWeight: 600 }}>{orphanProcesses.length} process non-géré(s) détecté(s) sur le serveur</span>}
          description={
            <Space direction="vertical" size={6} style={{ width: '100%' }}>
              {orphanProcesses.map(p => (
                <div key={p.pid} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  background: '#0f1219', padding: '0.4rem 0.6rem', borderRadius: 6,
                }}>
                  <span style={{ color: '#fbbf24', fontSize: 13, fontWeight: 600, flex: 1 }}>
                    {p.label} <Text type="secondary">(PID {p.pid})</Text>
                  </span>
                  <Text type="secondary" style={{ fontFamily: 'monospace', fontSize: 11, maxWidth: '40%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.cmd}
                  </Text>
                  <Button danger size="small" icon={<BugOutlined />} onClick={() => killOrphan(p.pid, p.label)}>
                    Tuer
                  </Button>
                </div>
              ))}
            </Space>
          }
        />
      )}

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Card
          title="Cron (planification automatique)"
          size="small"
          extra={<Badge status={loading ? 'default' : cronRunning ? 'success' : 'error'} text={<Text>{loading ? 'Chargement...' : cronRunning ? 'Cron actif' : 'Cron arrêté'}</Text>} />}
        >
          <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>
            Le cron lance le scraping chaque jour à 03:00 et la maintenance chaque heure.
          </Text>
          <Space>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={async () => { await run('Démarrage cron', adminCronStart); fetchStatus(); }}>
              Démarrer
            </Button>
            <Button danger icon={<StopOutlined />} onClick={async () => { await run('Arrêt cron', adminCronStop); fetchStatus(); }}>
              Arrêter
            </Button>
            <Button icon={<ReloadOutlined />} onClick={fetchStatus}>Rafraîchir</Button>
          </Space>
        </Card>

        {runningTasks.length > 0 && (
          <Alert
            type="success"
            showIcon
            icon={<ThunderboltOutlined />}
            message={<span>Tâches en cours : {runningTasks.map(t => <Tag key={t} color="success">{t}</Tag>)}</span>}
          />
        )}

        <Card title="Scraping" size="small">
          <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>
            Récupère les nouveaux films et séries depuis open-otaku.me.
          </Text>
          <Space wrap>
            {renderTaskButton("Scraping Films", () => adminTriggerScrape('films'), "#818cf8")}
            {renderTaskButton("Scraping Séries", () => adminTriggerScrape('series'), "#818cf8")}
            <Button
              icon={<ThunderboltOutlined />}
              disabled={isRunning('Scraping Films') || isRunning('Scraping Séries')}
              onClick={() => runAll('Scraping Films+Séries', [() => adminTriggerScrape('films'), () => adminTriggerScrape('series')])}
            >
              Les deux
            </Button>
          </Space>
        </Card>

        <Card title="Maintenance" size="small">
          <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>
            Vérification des liens, liaison TMDB, synchronisation.
          </Text>
          <Space wrap>
            {renderTaskButton("Maintenance Liens", () => adminRunMaintenance('dead-links'), "#34d399")}
            {renderTaskButton("Linking TMDB Films", () => adminRunMaintenance('tmdb-movies'), "#34d399")}
            {renderTaskButton("Linking TMDB Séries", () => adminRunMaintenance('tmdb-series'), "#34d399")}
            {renderTaskButton("Organize Séries Doodstream", () => adminRunMaintenance('organize'), "#34d399")}
            {renderTaskButton("Sync Séries → MongoDB", () => adminRunMaintenance('sync'), "#34d399")}
            <Button
              type="primary"
              disabled={ALL_TASK_NAMES.some(n => runningTasks.includes(n))}
              onClick={() => run('Toute la maintenance', () => adminRunMaintenance('all'))}
            >
              Toute la maintenance
            </Button>
          </Space>
        </Card>

        <Card title="Liaison TMDB" size="small">
          <Text type="secondary" style={{ display: 'block', marginBottom: '1rem' }}>
            Lie les films/séries scrapés à leur fiche TMDB.
          </Text>
          <Space wrap>
            {renderTaskButton("Linking TMDB Films", () => adminTriggerTmdbLink('movies'), "#fbbf24")}
            {renderTaskButton("Linking TMDB Séries", () => adminTriggerTmdbLink('series'), "#fbbf24")}
          </Space>
        </Card>

        <Card size="small" title={<Button type="text" size="small" icon={showOsPanel ? <CloseOutlined /> : <BugOutlined />} onClick={() => setShowOsPanel(s => !s)}>
          État OS brut ({osProcesses.length} process scraper actifs)
        </Button>}>
          {!showOsPanel ? null : osProcesses.length === 0 ? (
            <Text type="secondary">Aucun process scraper en cours.</Text>
          ) : (
            <Table<OsProcess>
              rowKey="pid"
              size="small"
              dataSource={osProcesses}
              columns={osColumns}
              pagination={false}
              scroll={{ x: 600 }}
            />
          )}
        </Card>

        {lastTask && (
          <Alert
            message={<Space><span>{lastTask}</span></Space>}
            action={
              <Space>
                <Button size="small" type="primary" icon={<ArrowRightOutlined />} onClick={() => router.push('/admin/logs')}>
                  Voir les logs
                </Button>
                <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => setLastTask(null)} />
              </Space>
            }
          />
        )}
      </Space>
    </div>
  );
}

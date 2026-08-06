'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { adminLogout, adminScrapperHealth } from '@/app/api';
import { Layout, Menu, Button, Typography } from 'antd';
import { 
  DashboardOutlined, 
  PlusOutlined, 
  VideoCameraOutlined, 
  UnorderedListOutlined, 
  SettingOutlined, 
  LogoutOutlined,
  AppstoreOutlined,
  BugOutlined
} from '@ant-design/icons';
import Link from 'next/link';

const { Sider } = Layout;
const { Title, Text } = Typography;

const NAV_ITEMS = [
  { key: '/admin', label: 'Dashboard', icon: <DashboardOutlined /> },
  { key: '/admin/add-media', label: 'Ajouter', icon: <PlusOutlined /> },
  { key: '/admin/movies', label: 'Films', icon: <VideoCameraOutlined /> },
  { key: '/admin/series', label: 'Séries', icon: <VideoCameraOutlined /> },
  { key: '/admin/affiches', label: 'Affiches', icon: <AppstoreOutlined /> },
  { key: '/admin/tmdb', label: 'TMDB', icon: <AppstoreOutlined /> },
  { key: '/admin/scrapper', label: 'Scrapper', icon: <BugOutlined /> },
  { key: '/admin/logs', label: 'Logs', icon: <UnorderedListOutlined /> },
  { key: '/admin/dead-links', label: 'Liens morts', icon: <BugOutlined /> },
  { key: '/admin/liens', label: 'Liens', icon: <UnorderedListOutlined /> },
  { key: '/admin/maintenance-liens', label: 'Maint. Liens', icon: <BugOutlined /> },
  { key: '/admin/uqload', label: 'Uqload', icon: <UnorderedListOutlined /> },
  { key: '/admin/cron', label: 'Tâches', icon: <SettingOutlined /> },
  { key: '/admin/settings', label: 'Paramètres', icon: <SettingOutlined /> },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AdminSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [scrapperOnline, setScrapperOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await adminScrapperHealth();
        setScrapperOnline(res.success === true);
      } catch { setScrapperOnline(false); }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <Sider 
      trigger={null} 
      collapsible 
      collapsed={!open} 
      width={260}
      breakpoint="lg"
      collapsedWidth="0"
      onCollapse={(collapsed) => !collapsed ? undefined : onClose()}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      <div style={{ padding: '1.5rem 1.25rem' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>CHILLERS</Title>
        <Text type="secondary" style={{ textTransform: 'uppercase', fontSize: '0.6875rem' }}>Administration</Text>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        items={NAV_ITEMS.map(item => ({
          ...item,
          onClick: () => { onClose(); },
          label: <Link href={item.key}>{item.label}</Link>
        }))}
      />
      <div style={{ position: 'absolute', bottom: 0, width: '100%', padding: '1rem' }}>
        <Button 
          type="text" 
          danger 
          icon={<LogoutOutlined />} 
          onClick={() => { adminLogout(); router.push('/admin/login'); }}
          block
        >
          Déconnexion
        </Button>
      </div>
    </Sider>
  );
}
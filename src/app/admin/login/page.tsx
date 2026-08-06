'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminLogin } from '@/app/api';
import { Card, Form, Input, Button, Alert, Typography, ConfigProvider } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { adminTheme } from '../theme';

const { Title, Text } = Typography;

export default function AdminLogin() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(values: { username: string; password: string }) {
    setError('');
    setLoading(true);
    const res = await adminLogin(values.username, values.password);
    setLoading(false);
    if (res.success) {
      router.push('/admin');
    } else {
      setError(res.message || 'Identifiants invalides');
    }
  }

  return (
    <ConfigProvider theme={adminTheme}>
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0c0e14', padding: '1rem',
      }}>
        <Card style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, margin: '0 auto 1rem',
              background: 'linear-gradient(135deg, #6c5ce7, #9b59f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 800, fontSize: '1.5rem',
            }}>
              C
            </div>
            <Title level={4} style={{ marginBottom: '0.25rem' }}>Admin</Title>
            <Text type="secondary">Connectez-vous pour accéder au panneau d&apos;administration</Text>
          </div>
          {error && <Alert type="error" showIcon message={error} style={{ marginBottom: '1rem' }} />}
          <Form layout="vertical" onFinish={handleSubmit} requiredMark={false}>
            <Form.Item
              name="username"
              label="Nom d'utilisateur"
              rules={[{ required: true, message: 'Entrez votre nom d\'utilisateur' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="Nom d'utilisateur" autoComplete="username" size="large" />
            </Form.Item>
            <Form.Item
              name="password"
              label="Mot de passe"
              rules={[{ required: true, message: 'Entrez votre mot de passe' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Mot de passe" autoComplete="current-password" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Se connecter
            </Button>
          </Form>
        </Card>
      </div>
    </ConfigProvider>
  );
}

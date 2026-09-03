'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  Tag,
  Button,
  Modal,
  Form,
  DatePicker,
  Typography,
  Space,
  message,
  Avatar,
  Badge,
} from 'antd';
import {
  SearchOutlined,
  EditOutlined,
  UserOutlined,
  ReloadOutlined,
  CrownOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminGetUsers, adminUpdateUserSubscription, AdminUser } from '@/services/admin';

const { Title, Text } = Typography;
const { Option } = Select;

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const fetchUsers = useCallback(async (searchQuery = '', currentPage = 1) => {
    setLoading(true);
    try {
      const res = await adminGetUsers({
        search: searchQuery,
        page: currentPage,
        limit: 25,
      });
      if (res?.success) {
        setUsers(res.users || []);
        setTotal(res.total || 0);
      } else {
        message.error('Impossible de charger les utilisateurs');
      }
    } catch (err: any) {
      message.error(err.message || 'Erreur lors de la récupération des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers(search, page);
  }, [fetchUsers, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(search, 1);
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    form.setFieldsValue({
      plan: user.subscription?.plan || 'free',
      status: user.subscription?.status || 'active',
      role: user.role || 'user',
      expiresAt: user.subscription?.expiresAt ? dayjs(user.subscription.expiresAt) : null,
    });
    setModalVisible(true);
  };

  const handleUpdate = async () => {
    try {
      const values = await form.validateFields();
      if (!editingUser) return;
      setSubmitting(true);

      const res = await adminUpdateUserSubscription(editingUser._id, {
        plan: values.plan,
        status: values.status,
        role: values.role,
        expiresAt: values.expiresAt ? values.expiresAt.toISOString() : null,
      });

      if (res?.success) {
        message.success(`Abonnement de ${editingUser.email} mis à jour avec succès !`);
        setModalVisible(false);
        fetchUsers(search, page);
      } else {
        message.error(res?.message || 'Erreur lors de la mise à jour');
      }
    } catch (err: any) {
      message.error(err.message || 'Erreur formulaire');
    } finally {
      setSubmitting(false);
    }
  };

  const planTag = (plan: string) => {
    switch (plan) {
      case 'premium':
        return (
          <Tag icon={<CrownOutlined />} color="gold">
            PREMIUM
          </Tag>
        );
      case 'standard':
        return <Tag color="blue">STANDARD</Tag>;
      default:
        return <Tag color="default">GRATUIT</Tag>;
    }
  };

  const statusTag = (status: string) => {
    switch (status) {
      case 'active':
        return <Tag color="green">ACTIF</Tag>;
      case 'inactive':
        return <Tag color="volcano">INACTIF</Tag>;
      case 'cancelled':
        return <Tag color="red">RÉSILIÉ</Tag>;
      default:
        return <Tag color="default">{status}</Tag>;
    }
  };

  const columns = [
    {
      title: 'Utilisateur',
      key: 'user',
      render: (_: any, record: AdminUser) => (
        <Space direction="horizontal" size="middle">
          <Avatar
            src={record.avatarUrl}
            icon={<UserOutlined />}
            style={{ backgroundColor: record.role === 'admin' ? '#d70466' : '#6c5ce7' }}
          />
          <div>
            <div style={{ fontWeight: 600, color: '#fff' }}>
              {record.username || record.email.split('@')[0]}
              {record.role === 'admin' && (
                <Tag color="magenta" style={{ marginLeft: 6, fontSize: 10 }}>
                  ADMIN
                </Tag>
              )}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Formule Actuelle',
      key: 'plan',
      render: (_: any, record: AdminUser) => planTag(record.subscription?.plan || 'free'),
    },
    {
      title: 'Statut',
      key: 'status',
      render: (_: any, record: AdminUser) => statusTag(record.subscription?.status || 'active'),
    },
    {
      title: 'Expiration',
      key: 'expiresAt',
      render: (_: any, record: AdminUser) => {
        if (!record.subscription?.expiresAt) {
          return <Text type="secondary">— (Permanent)</Text>;
        }
        const exp = dayjs(record.subscription.expiresAt);
        const isExpired = exp.isBefore(dayjs());
        return (
          <span style={{ color: isExpired ? '#ff4d4f' : '#52c41a' }}>
            {exp.format('DD/MM/YYYY')} {isExpired ? '(Expiré)' : ''}
          </span>
        );
      },
    },
    {
      title: 'Inscrit le',
      key: 'createdAt',
      render: (_: any, record: AdminUser) =>
        record.createdAt ? dayjs(record.createdAt).format('DD/MM/YYYY') : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AdminUser) => (
        <Button
          type="primary"
          ghost
          icon={<EditOutlined />}
          size="small"
          onClick={() => openEditModal(record)}
        >
          Modifier l&apos;Abonnement
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <Title level={3} style={{ color: '#fff', margin: 0 }}>
            Gestion des Utilisateurs & Abonnements
          </Title>
          <Text type="secondary">
            Consultez tous les utilisateurs inscrits sur CHILLERS et modifiez directement leur formule
          </Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchUsers(search, page)}
          loading={loading}
        >
          Actualiser
        </Button>
      </div>

      <Card style={{ background: '#141414', border: '1px solid #262626', marginBottom: '1.5rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem' }}>
          <Input
            placeholder="Rechercher par email ou nom d'utilisateur..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 400 }}
          />
          <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
            Rechercher
          </Button>
        </form>
      </Card>

      <Table
        dataSource={users}
        columns={columns}
        rowKey="_id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 25,
          total,
          onChange: (p) => setPage(p),
          showTotal: (tot) => `${tot} utilisateurs au total`,
        }}
        style={{ background: '#141414', borderRadius: 8, overflow: 'hidden' }}
      />

      {/* Modal d'édition de l'abonnement */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CrownOutlined style={{ color: '#faad14' }} />
            <span>Modifier l&apos;abonnement de {editingUser?.email}</span>
          </div>
        }
        open={modalVisible}
        onOk={handleUpdate}
        confirmLoading={submitting}
        onCancel={() => setModalVisible(false)}
        okText="Enregistrer les modifications"
        cancelText="Annuler"
      >
        <Form form={form} layout="vertical" style={{ marginTop: '1rem' }}>
          <Form.Item name="plan" label="Formule d'abonnement" rules={[{ required: true }]}>
            <Select>
              <Option value="free">Gratuit (Free)</Option>
              <Option value="standard">Standard (720p / 1080p Standard)</Option>
              <Option value="premium">Premium (1080p Ultra HD / Prioritaire / Pas de pub)</Option>
            </Select>
          </Form.Item>

          <Form.Item name="status" label="Statut de l'abonnement" rules={[{ required: true }]}>
            <Select>
              <Option value="active">Actif</Option>
              <Option value="inactive">Inactif</Option>
              <Option value="cancelled">Résilié</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="expiresAt"
            label="Date d'expiration de l'abonnement"
            help="Laissez vide pour un accès à vie ou permanent"
          >
            <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" showNow />
          </Form.Item>

          <Form.Item name="role" label="Rôle de l'utilisateur">
            <Select>
              <Option value="user">Utilisateur standard</Option>
              <Option value="admin">Administrateur</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

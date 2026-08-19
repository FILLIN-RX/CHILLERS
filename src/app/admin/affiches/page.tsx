'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  adminAiSocialSuggestions,
  adminAiContentGap,
  SocialSuggestionItem,
  ContentGapItem,
} from '@/services/admin';
import {
  Typography,
  Card,
  Button,
  Space,
  Tag,
  Tabs,
  Spin,
  Alert,
  Empty,
  Row,
  Col,
  Segmented,
  Tooltip,
  message,
} from 'antd';
import {
  RobotOutlined,
  CopyOutlined,
  CheckOutlined,
  ReloadOutlined,
  PlusOutlined,
  StarFilled,
  FireOutlined,
  ShareAltOutlined,
  LinkOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import Link from 'next/link';

const { Title, Text, Paragraph } = Typography;

export default function AdminAffiches() {
  const [activeTab, setActiveTab] = useState('suggestions');

  // Suggestions state
  const [suggestions, setSuggestions] = useState<SocialSuggestionItem[]>([]);
  const [suggestionsProvider, setSuggestionsProvider] = useState<'gemini' | 'groq' | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>('Tous');

  // Content gap state
  const [contentGap, setContentGap] = useState<ContentGapItem[]>([]);
  const [contentGapProvider, setContentGapProvider] = useState<'gemini' | 'groq' | null>(null);
  const [loadingContentGap, setLoadingContentGap] = useState(false);

  // Copied states
  const [copiedCaptionIndex, setCopiedCaptionIndex] = useState<number | null>(null);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState<number | null>(null);

  // Charger les suggestions au montage
  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    try {
      const res = await adminAiSocialSuggestions();
      if (res.success && res.data) {
        setSuggestions(res.data.suggestions || []);
        setSuggestionsProvider(res.data.usedProvider || null);
        message.success('Suggestions de posts quotidiennes générées avec succès');
      } else {
        message.error(res.message || 'Erreur lors de la génération des suggestions');
      }
    } catch (err: any) {
      message.error(err.message || 'Erreur lors de la génération des suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Charger le contenu manquant
  const loadContentGap = useCallback(async () => {
    setLoadingContentGap(true);
    try {
      const res = await adminAiContentGap();
      if (res.success && res.data) {
        setContentGap(res.data.items || []);
        setContentGapProvider(res.data.usedProvider || null);
      } else {
        message.error(res.message || 'Erreur lors de l\'analyse des tendances web');
      }
    } catch (err: any) {
      message.error(err.message || 'Erreur lors de l\'analyse');
    } finally {
      setLoadingContentGap(false);
    }
  }, []);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  useEffect(() => {
    if (activeTab === 'gap' && contentGap.length === 0 && !loadingContentGap) {
      loadContentGap();
    }
  }, [activeTab, contentGap.length, loadingContentGap, loadContentGap]);

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedCaptionIndex(index);
    message.success('Texte du post copié dans le presse-papier !');
    setTimeout(() => setCopiedCaptionIndex(null), 2000);
  };

  const handleCopyLink = (link: string, index: number) => {
    navigator.clipboard.writeText(link);
    setCopiedLinkIndex(index);
    message.success('Lien du média copié !');
    setTimeout(() => setCopiedLinkIndex(null), 2000);
  };

  const filteredSuggestions = suggestions.filter((item) => {
    if (platformFilter === 'Tous') return true;
    return item.platform.toLowerCase().includes(platformFilter.toLowerCase());
  });

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <RobotOutlined style={{ color: '#e50914' }} /> Assistant IA Marketing & Contenu
          </Title>
          <Text type="secondary">
            Générez vos posts réseaux sociaux quotidiens et découvrez les films/séries très demandés manquants sur CHILLERS.
          </Text>
        </div>

        {/* Badge Provider IA */}
        {((activeTab === 'suggestions' && suggestionsProvider) || (activeTab === 'gap' && contentGapProvider)) && (
          <Tag
            color={
              (activeTab === 'suggestions' ? suggestionsProvider : contentGapProvider) === 'gemini'
                ? 'purple'
                : 'volcano'
            }
            style={{ fontSize: 13, padding: '6px 14px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ThunderboltOutlined />
            IA active :{' '}
            <strong>
              {(activeTab === 'suggestions' ? suggestionsProvider : contentGapProvider) === 'gemini'
                ? 'Google Gemini ✦'
                : 'Groq (Secours) ⚡'}
            </strong>
          </Tag>
        )}
      </div>

      {/* Onglets principaux */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        items={[
          {
            key: 'suggestions',
            label: (
              <span>
                <ShareAltOutlined /> Suggestions de Posts Sociaux
              </span>
            ),
            children: (
              <div>
                {/* Barre d'outils du haut */}
                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <Space wrap>
                    <Text strong>Filtrer par réseau :</Text>
                    <Segmented
                      options={['Tous', 'Instagram', 'TikTok', 'Facebook', 'Telegram']}
                      value={platformFilter}
                      onChange={(v) => setPlatformFilter(v as string)}
                    />
                  </Space>

                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    loading={loadingSuggestions}
                    onClick={loadSuggestions}
                    style={{ backgroundColor: '#e50914', borderColor: '#e50914' }}
                  >
                    Régénérer les suggestions IA
                  </Button>
                </div>

                {/* Info banner */}
                <Alert
                  type="info"
                  showIcon
                  message="Vos suggestions de publication pour aujourd'hui"
                  description="Ces suggestions combinent vos films/séries disponibles avec les sujets tendances actuels du web. Cliquez sur 'Copier le post' pour le coller directement sur votre page."
                  style={{
                    marginBottom: 24,
                    backgroundColor: '#161b26',
                    borderColor: '#242e42',
                    color: '#e6e9f0',
                  }}
                />

                {loadingSuggestions ? (
                  <div style={{ textAlign: 'center', padding: 80 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary">
                        L'IA analyse votre catalogue et les tendances du web pour rédiger vos posts quotidiens...
                      </Text>
                    </div>
                  </div>
                ) : filteredSuggestions.length === 0 ? (
                  <Empty description="Aucune suggestion trouvée pour le filtre sélectionné. Cliquez sur Régénérer." />
                ) : (
                  <Row gutter={[20, 20]}>
                    {filteredSuggestions.map((item, index) => (
                      <Col xs={24} md={12} lg={8} key={index}>
                        <Card
                          hoverable
                          style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            borderColor: '#27272a',
                            background: '#121215',
                          }}
                        >
                          <div>
                            {/* Badges d'en-tête de la carte */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                              <Tag color="cyan" style={{ fontWeight: 600 }}>
                                📱 {item.platform}
                              </Tag>
                              <Tag color={item.mediaType === 'movie' ? 'blue' : 'magenta'}>
                                {item.mediaType === 'movie' ? 'FILM' : 'SÉRIE'}
                              </Tag>
                            </div>

                            {/* Titre du Média */}
                            <Title level={4} style={{ margin: '0 0 8px 0', color: '#fff' }}>
                              {item.mediaTitle}
                            </Title>

                            {/* Accroche / Hook */}
                            <div
                              style={{
                                background: '#1c1c21',
                                padding: '8px 12px',
                                borderRadius: 8,
                                borderLeft: '4px solid #e50914',
                                marginBottom: 12,
                              }}
                            >
                              <Text strong style={{ color: '#f43f5e' }}>
                                ⚡ Hook : {item.hook}
                              </Text>
                            </div>

                            {/* Légende du post */}
                            <Paragraph
                              style={{
                                color: '#d4d4d8',
                                whiteSpace: 'pre-wrap',
                                fontSize: 14,
                                lineHeight: 1.5,
                                background: '#09090b',
                                padding: 14,
                                borderRadius: 8,
                                border: '1px solid #27272a',
                                maxHeight: 220,
                                overflowY: 'auto',
                              }}
                            >
                              {item.caption}
                            </Paragraph>
                          </div>

                          {/* Actions bas de carte */}
                          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <Button
                              type="primary"
                              icon={copiedCaptionIndex === index ? <CheckOutlined /> : <CopyOutlined />}
                              onClick={() => handleCopyText(item.caption, index)}
                              style={{ flex: 1, backgroundColor: copiedCaptionIndex === index ? '#22c55e' : '#e50914', borderColor: 'transparent' }}
                            >
                              {copiedCaptionIndex === index ? 'Copié !' : 'Copier le post'}
                            </Button>

                            {item.chillersLink && (
                              <Tooltip title="Copier le lien Chillers">
                                <Button
                                  icon={copiedLinkIndex === index ? <CheckOutlined /> : <LinkOutlined />}
                                  onClick={() => handleCopyLink(item.chillersLink, index)}
                                />
                              </Tooltip>
                            )}
                          </div>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            ),
          },
          {
            key: 'gap',
            label: (
              <span>
                <FireOutlined /> Contenus Très Demandés (Manquants)
              </span>
            ),
            children: (
              <div>
                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 16 }}>
                    Films et séries très populaires sur le web qui ne sont pas encore sur CHILLERS
                  </Text>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    loading={loadingContentGap}
                    onClick={loadContentGap}
                  >
                    Actualiser les tendances web
                  </Button>
                </div>

                <Alert
                  type="warning"
                  showIcon
                  message="Recommandations d'ajout par l'IA"
                  description="Ces contenus rencontrent une forte demande actuellement en France et sur les réseaux sociaux. Les ajouter sur CHILLERS vous permettra d'attirer un maximum de trafic."
                  style={{
                    marginBottom: 24,
                    backgroundColor: '#261c14',
                    borderColor: '#422f1d',
                    color: '#e6e9f0',
                  }}
                />

                {loadingContentGap ? (
                  <div style={{ textAlign: 'center', padding: 80 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary">
                        Croisement des tendances TMDB avec votre base de données...
                      </Text>
                    </div>
                  </div>
                ) : contentGap.length === 0 ? (
                  <Empty description="Aucun contenu manquant détecté. Votre catalogue est à jour !" />
                ) : (
                  <Row gutter={[20, 20]}>
                    {contentGap.map((item) => (
                      <Col xs={24} sm={12} md={8} lg={6} key={item.tmdbId}>
                        <Card
                          hoverable
                          cover={
                            item.posterPath ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.posterPath}
                                alt={item.title}
                                style={{ height: 300, objectFit: 'cover' }}
                              />
                            ) : (
                              <div
                                style={{
                                  height: 300,
                                  background: '#18181b',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#71717a',
                                }}
                              >
                                Pas d'affiche
                              </div>
                            )
                          }
                          style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            background: '#121215',
                            borderColor: '#27272a',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <Tag color={item.type === 'movie' ? 'blue' : 'magenta'}>
                                {item.type === 'movie' ? 'FILM' : 'SÉRIE'}
                              </Tag>
                              {item.voteAverage && (
                                <Tag color="gold" icon={<StarFilled />}>
                                  {item.voteAverage}/10
                                </Tag>
                              )}
                            </div>

                            <Title level={4} style={{ margin: '0 0 4px 0', color: '#fff' }}>
                              {item.title}
                            </Title>

                            {item.releaseDate && (
                              <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
                                Sortie : {item.releaseDate.split('-')[0]}
                              </Text>
                            )}

                            {/* Raison de recommandation par l'IA */}
                            <div
                              style={{
                                background: '#1c1917',
                                border: '1px solid #44403c',
                                padding: '10px 12px',
                                borderRadius: 8,
                                marginBottom: 12,
                              }}
                            >
                              <Text style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600 }}>
                                💡 Pourquoi l'ajouter :
                              </Text>
                              <Paragraph
                                style={{
                                  fontSize: 13,
                                  color: '#d6d3d1',
                                  margin: '4px 0 0 0',
                                  lineHeight: 1.4,
                                }}
                              >
                                {item.reason}
                              </Paragraph>
                            </div>
                          </div>

                          <Link
                            href={`/admin/add-media?q=${encodeURIComponent(item.title)}`}
                            style={{ width: '100%', display: 'block', marginTop: 12 }}
                          >
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              block
                              style={{ backgroundColor: '#22c55e', borderColor: '#22c55e' }}
                            >
                              Ajouter sur CHILLERS
                            </Button>
                          </Link>
                        </Card>
                      </Col>
                    ))}
                  </Row>
                )}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}

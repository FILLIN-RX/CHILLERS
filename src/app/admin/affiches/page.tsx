'use client';

import { useState, useCallback } from 'react';
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
} from '@/components/admin/ui';
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
} from '@/components/admin/icons';
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
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Erreur lors de la génération des suggestions');
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
    } catch (err) {
      message.error(err instanceof Error ? err.message : 'Erreur lors de l\'analyse');
    } finally {
      setLoadingContentGap(false);
    }
  }, []);

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCaptionIndex(index);
      message.success('Texte du post copié.');
      setTimeout(() => setCopiedCaptionIndex(null), 2000);
    }).catch(() => message.error('Le presse-papier est inaccessible dans ce navigateur.'));
  };

  const handleCopyLink = (link: string, index: number) => {
    navigator.clipboard.writeText(link).then(() => {
      setCopiedLinkIndex(index);
      message.success('Lien copié.');
      setTimeout(() => setCopiedLinkIndex(null), 2000);
    }).catch(() => message.error('Le presse-papier est inaccessible dans ce navigateur.'));
  };

  const filteredSuggestions = suggestions.filter((item) => {
    if (platformFilter === 'Tous') return true;
    return item.platform.toLowerCase().includes(platformFilter.toLowerCase());
  });

  return (
    <div className="editorial-page" style={{ maxWidth: 1400, margin: '0 auto' }}>
      {/* En-tête */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ flex: 1, padding: '24px 28px', border: '1px solid #e5ddd7', borderLeft: '3px solid #bd3f70', borderRadius: 15, color: '#30272c', background: '#f9f7f4' }}>
          <Text style={{ color: '#9b315d', letterSpacing: '.13em', fontSize: 10 }}>CHILLERS · STUDIO ÉDITORIAL</Text>
          <Title level={2} style={{ color: '#30272c', margin: '8px 0 5px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <RobotOutlined /> Des idées pour faire parler du prochain film.
          </Title>
          <Text style={{ color: '#81777b' }}>Trouvez l’angle, adaptez-le à vos réseaux et partagez votre sélection.</Text>
        </div>

        {/* Badge Provider IA */}
        {((activeTab === 'suggestions' && suggestionsProvider) || (activeTab === 'gap' && contentGapProvider)) && (
          <Tag
            color={
              (activeTab === 'suggestions' ? suggestionsProvider : contentGapProvider) === 'gemini'
                ? 'purple'
                : 'volcano'
            }
            style={{ fontSize: 12, padding: '6px 14px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
          >
            <ThunderboltOutlined />
            Rédaction assistée ·{' '}
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
        onChange={(key: unknown) => setActiveTab(key as string)}
        type="card"
        items={[
          {
            key: 'suggestions',
            label: (
              <span>
                <ShareAltOutlined /> Idées de publication
              </span>
            ),
            children: (
              <div>
                {/* Barre d'outils du haut */}
                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <Space wrap>
                    <Text strong>Choisir un réseau</Text>
                    <Segmented
                      options={['Tous', 'Instagram', 'TikTok', 'Facebook', 'Telegram']}
                      value={platformFilter}
                      onChange={(v: unknown) => setPlatformFilter(v as string)}
                    />
                  </Space>

                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    loading={loadingSuggestions}
                    onClick={loadSuggestions}
                    style={{ backgroundColor: '#d63379', borderColor: '#d63379' }}
                  >
                    Voir d’autres idées
                  </Button>
                </div>

                {/* Info banner */}
                <Alert
                  type="info"
                  showIcon
                  message="Une sélection prête à raconter"
                  description="Chaque proposition part d’un titre disponible sur CHILLERS. Relisez-la, ajustez le ton à votre communauté, puis copiez-la pour votre réseau."
                  style={{
                    marginBottom: 24,
                    backgroundColor: '#f5f7fc',
                    borderColor: '#e5eaf4',
                    color: '#344054',
                  }}
                />

                {loadingSuggestions ? (
                  <div style={{ textAlign: 'center', padding: 80 }}>
                    <Spin size="large" />
                    <div style={{ marginTop: 16 }}>
                        <Text type="secondary">
                        Nous préparons des idées à partir de votre catalogue et des sujets suivis...
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
                            borderColor: '#edf0f4',
                            background: '#f9f7f4',
                            boxShadow: '0 10px 28px rgba(20,32,55,.06)',
                          }}
                        >
                          <div>
                            {/* Badges d'en-tête de la carte */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                              <Tag color="purple" style={{ fontWeight: 600 }}>
                                {item.platform}
                              </Tag>
                              <Tag color={item.mediaType === 'movie' ? 'blue' : 'magenta'}>
                                {item.mediaType === 'movie' ? 'FILM' : 'SÉRIE'}
                              </Tag>
                            </div>

                            {/* Titre du Média */}
                            <Title level={4} style={{ margin: '0 0 8px 0', color: '#172033' }}>
                              {item.mediaTitle}
                            </Title>

                            {/* Accroche / Hook */}
                            <div
                              style={{
                                background: '#fff4f8',
                                padding: '8px 12px',
                                borderRadius: 8,
                                borderLeft: '4px solid #d63379',
                                marginBottom: 12,
                              }}
                            >
                              <Text strong style={{ color: '#a12762' }}>
                                L’accroche · {item.hook}
                              </Text>
                            </div>

                            {/* Légende du post */}
                            <Paragraph
                              style={{
                                color: '#475467',
                                whiteSpace: 'pre-wrap',
                                fontSize: 14,
                                lineHeight: 1.5,
                                background: '#f8f9fb',
                                padding: 14,
                                borderRadius: 8,
                                border: '1px solid #edf0f4',
                                maxHeight: 220,
                                overflowY: 'auto',
                              }}
                            >
                              {item.caption}
                            </Paragraph>
                          </div>

                          {/* Actions bas de carte */}
                          <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #edf0f4', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                            <Button
                              type="primary"
                              icon={copiedCaptionIndex === index ? <CheckOutlined /> : <CopyOutlined />}
                              onClick={() => handleCopyText(item.caption, index)}
                              style={{ flex: 1, backgroundColor: copiedCaptionIndex === index ? '#16865d' : '#d63379', borderColor: 'transparent' }}
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
                <FireOutlined /> Tendances à ajouter au catalogue
              </span>
            ),
            children: (
              <div>
                <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text strong style={{ fontSize: 16 }}>
                    Des titres qui intéressent le public et ne sont pas encore au catalogue
                  </Text>
                  <Button
                    type="primary"
                    icon={<ReloadOutlined />}
                    loading={loadingContentGap}
                    onClick={loadContentGap}
                  >
                    Actualiser la sélection
                  </Button>
                </div>

                <Alert
                  type="warning"
                  showIcon
                  message="Une piste éditoriale, à valider"
                  description="Ces suggestions croisent la popularité observée avec les titres déjà disponibles. Vérifiez les droits et les sources avant d’ajouter un contenu."
                  style={{
                    marginBottom: 24,
                    backgroundColor: '#fff8e8',
                    borderColor: '#f1e3bd',
                    color: '#5f4b1f',
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
                                  background: '#f2f4f7',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: '#98a2b3',
                                }}
                              >
                                Pas d&apos;affiche
                              </div>
                            )
                          }
                          style={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            background: '#f9f7f4',
                            borderColor: '#edf0f4',
                            boxShadow: '0 10px 28px rgba(20,32,55,.06)',
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

                            <Title level={4} style={{ margin: '0 0 4px 0', color: '#172033' }}>
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
                                background: '#fff8e8',
                                border: '1px solid #f1e3bd',
                                padding: '10px 12px',
                                borderRadius: 8,
                                marginBottom: 12,
                              }}
                            >
                                <Text style={{ fontSize: 13, color: '#8a6311', fontWeight: 600 }}>
                                Pourquoi ce titre ressort :
                              </Text>
                              <Paragraph
                                style={{
                                  fontSize: 13,
                                  color: '#675a3a',
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
                              style={{ backgroundColor: '#3478f6', borderColor: '#3478f6' }}
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

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Button, Card, Table, Tag, Typography, message } from '@/components/admin/ui';
import { BellOutlined, BulbOutlined, SendOutlined, ReloadOutlined } from '@/components/admin/icons';
import { adminCancelPushCampaign, adminCreatePushCampaign, adminGeneratePushCampaignDraft, adminGetPushCampaigns, adminTmdbSearch, type AdminPushCampaign } from '@/services/admin';
import type { TmdbSearchResult } from '@/types/admin';

const { Title, Text, Paragraph } = Typography;
const statusColor: Record<string, string> = { scheduled: 'blue', sending: 'processing', sent: 'green', cancelled: 'default', failed: 'red' };
const statusLabel: Record<string, string> = { scheduled: 'Programm\u00e9e', sending: 'En cours', sent: 'Envoy\u00e9e', cancelled: 'Annul\u00e9e', failed: '\u00c9chec' };
type Audience = 'all' | 'free';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w185';
const TMDB_IMG_FULL = 'https://image.tmdb.org/t/p/w500';

export default function AdminNotificationsPage() {
  const [campaigns, setCampaigns] = useState<AdminPushCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState(1);
  const [theme, setTheme] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [premiumDays, setPremiumDays] = useState(0);
  const [url, setUrl] = useState('/');
  const [image, setImage] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [draft, setDraft] = useState<{ title: string; message: string; usedProvider: 'gemini' | 'groq' | null } | null>(null);

  // S\u00e9lecteur de contenu TMDB
  const [contentQuery, setContentQuery] = useState('');
  const [contentResults, setContentResults] = useState<TmdbSearchResult[]>([]);
  const [contentSearching, setContentSearching] = useState(false);
  const [selectedContent, setSelectedContent] = useState<TmdbSearchResult | null>(null);
  const contentSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { const res = await adminGetPushCampaigns(); setCampaigns(res.data || []); }
    catch { message.error('Impossible de charger les campagnes.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  const searchContent = useCallback(async (q: string) => {
    if (!q.trim()) { setContentResults([]); return; }
    setContentSearching(true);
    try {
      const [movies, series] = await Promise.all([
        adminTmdbSearch(q, 'movie'),
        adminTmdbSearch(q, 'tv'),
      ]);
      const all = [
        ...(movies.data || []).slice(0, 4).map(r => ({ ...r, media_type: 'movie' as const })),
        ...(series.data || []).slice(0, 4).map(r => ({ ...r, media_type: 'tv' as const })),
      ].sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0)).slice(0, 8);
      setContentResults(all);
    } catch { setContentResults([]); }
    finally { setContentSearching(false); }
  }, []);

  const handleContentQueryChange = (q: string) => {
    setContentQuery(q);
    if (contentSearchTimer.current) clearTimeout(contentSearchTimer.current);
    contentSearchTimer.current = setTimeout(() => void searchContent(q), 400);
  };

  const selectContent = (item: TmdbSearchResult) => {
    const contentTitle = item.title || item.name || '';
    const slug = contentTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const tmdbPath = item.media_type === 'tv' ? `/tv/${item.id}` : `/media/${item.id}-${slug}`;
    const posterUrl = item.poster_path ? `${TMDB_IMG_FULL}${item.poster_path}` : '';
    setSelectedContent(item);
    setUrl(tmdbPath);
    setImage(posterUrl);
    if (!theme.trim()) {
      const year = item.year || (item.release_date || item.first_air_date || '').slice(0, 4);
      setTheme(`${contentTitle}${year ? ` (${year})` : ''} \u2014 D\u00e9couvrez ce contenu sur CHILLERS`);
    }
    setContentResults([]);
    setContentQuery('');
  };

  const clearContent = () => {
    setSelectedContent(null);
    setUrl('/');
    setImage('');
  };

  const generateDraft = async () => {
    if (!theme.trim()) { message.error('Ajoutez un sujet pour guider le message.'); return; }
    setWorking(true);
    try {
      const res = await adminGeneratePushCampaignDraft({ theme: theme.trim(), audience, grantPremiumDays: premiumDays });
      if (!res.success || !res.data) throw new Error(res.message || 'La g\u00e9n\u00e9ration du message a \u00e9chou\u00e9.');
      setDraft(res.data);
      setStep(2);
    } catch (error: unknown) { message.error(error instanceof Error ? error.message : 'Impossible de g\u00e9n\u00e9rer le message.'); }
    finally { setWorking(false); }
  };

  const continueWithoutAi = () => {
    setDraft({ title: '', message: '', usedProvider: null });
    setStep(2);
  };

  const chooseDelivery = () => {
    if (!draft?.title.trim() || !draft.message.trim()) {
      message.error('Renseignez le titre et le message avant de continuer.');
      return;
    }
    setStep(3);
  };

  const create = async (sendNow: boolean) => {
    if (!draft?.title.trim() || !draft.message.trim()) { message.error('Renseignez le titre et le message.'); return; }
    if (!sendNow && (!scheduledAt || new Date(scheduledAt).getTime() < Date.now() + 60_000)) {
      message.error('Choisissez une date situ\u00e9e au moins une minute dans le futur.'); return;
    }
    setWorking(true);
    try {
      const res = await adminCreatePushCampaign({
        theme: theme.trim(), audience, title: draft.title, message: draft.message,
        url, image: image || undefined, grantPremiumDays: premiumDays,
        scheduledAt: sendNow ? undefined : new Date(scheduledAt).toISOString(), sendNow,
      });
      if (!res.success || !res.data) throw new Error(res.message || 'Cr\u00e9ation impossible');
      if (sendNow && (res.data.deliveryCount || 0) === 0) {
        message.warning("Campagne trait\u00e9e, mais aucun navigateur abonn\u00e9 n'a accept\u00e9 le push.");
      } else if (sendNow) {
        message.success(`Envoi termin\u00e9\u00a0: ${res.data.deliveryCount} notification(s) accept\u00e9e(s).`);
      } else {
        message.success('Votre campagne est programm\u00e9e.');
      }
      setStep(1); setTheme(''); setAudience('all'); setPremiumDays(0);
      setUrl('/'); setImage(''); setScheduledAt(''); setDraft(null); setSelectedContent(null);
      void reload();
    } catch (error: unknown) { message.error(error instanceof Error ? error.message : 'Impossible de cr\u00e9er la campagne.'); }
    finally { setWorking(false); }
  };

  const cancel = async (id: string) => {
    try {
      const res = await adminCancelPushCampaign(id);
      if (!res.success) throw new Error(res.message);
      message.success('Campagne annul\u00e9e.');
      void reload();
    } catch (error: unknown) { message.error(error instanceof Error ? error.message : 'Annulation impossible.'); }
  };

  const columns = [
    {
      title: 'Campagne', key: 'campaign',
      render: (_: unknown, row: AdminPushCampaign) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {row.image && (
            <img src={row.image} alt="" style={{ width: 36, height: 54, objectFit: 'cover', borderRadius: 3, flexShrink: 0 }} />
          )}
          <div>
            <Text strong>{row.theme}</Text>
            <div style={{ maxWidth: 420, marginTop: 4 }}>
              <Text type="secondary" ellipsis>{row.title} &mdash; {row.message}</Text>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: 'Public', dataIndex: 'audience',
      render: (value: string) => value === 'free' ? 'Comptes gratuits' : 'Tous les abonn\u00e9s',
    },
    {
      title: "Date d'envoi", dataIndex: 'scheduledAt',
      render: (value: string) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }),
    },
    {
      title: '\u00c9tat', dataIndex: 'status',
      render: (value: string) => <Tag color={statusColor[value]}>{statusLabel[value] || value}</Tag>,
    },
    {
      title: 'Envois', dataIndex: 'deliveryCount', align: 'right' as const,
      render: (value?: number) => value?.toLocaleString('fr-FR') ?? '\u2014',
    },
    {
      title: '', key: 'actions',
      render: (_: unknown, row: AdminPushCampaign) => row.status === 'scheduled'
        ? <Button danger size="small" onClick={() => void cancel(row._id)}>Annuler</Button>
        : null,
    },
  ];

  const previewTitle = draft?.title || theme.trim() || 'Votre prochain message';
  const previewMessage = draft?.message
    || (draft && !draft.usedProvider
      ? 'Votre message appara\u00eetra ici pendant que vous le r\u00e9digez.'
      : 'Le texte propos\u00e9 appara\u00eetra ici. Ajustez le sujet et le public pour commencer.');

  return (
    <main className="notifications-page">
      <header className="notifications-heading">
        <div>
          <Text className="notifications-kicker">COMMUNAUT\u00c9 &middot; MESSAGES PUSH</Text>
          <Title level={2}>Restez pr\u00e9sent au bon moment.</Title>
          <Paragraph>
            Pr\u00e9parez un message utile, relisez-le comme vos membres le verront, puis choisissez quand l&apos;envoyer.
          </Paragraph>
        </div>
        <div className="notifications-heading-mark">
          <BellOutlined />
          <span>Un message, une bonne raison de revenir.</span>
        </div>
      </header>

      <section className="notifications-workspace">
        <Card
          className="notifications-builder"
          title={
            <div className="notifications-card-title">
              <span>Cr\u00e9er une campagne</span>
              <Text type="secondary">\u00c9tape {step} sur 3</Text>
            </div>
          }
        >
          <div className="notifications-steps" aria-label="\u00c9tapes de cr\u00e9ation">
            {[['01', 'Le sujet'], ['02', 'Le message'], ["03", "L'envoi"]].map(([number, label], index) => (
                <div
                  key={number}
                  className={`notifications-step ${step === index + 1 ? 'is-current' : step > index + 1 ? 'is-done' : ''}`}
                >
                  <span>{number}</span>
                  <small>{label}</small>
                </div>
              ))
            }
          </div>

          {step === 1 && (
            <div className="notifications-step-body">
              <div className="notifications-intro">
                <span className="notifications-step-count">01 / INTENTION</span>
                <h2>Qu&apos;avez-vous \u00e0 partager\u00a0?</h2>
                <p>Choisissez un film ou une s\u00e9rie pour l&apos;inclure dans la notification, ou donnez un contexte libre.</p>
              </div>

              {/* S\u00e9lecteur de contenu TMDB */}
              <div className="notifications-field">
                <span>Contenu \u00e0 mettre en avant <small>Facultatif</small></span>
                {selectedContent ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)' }}>
                    {selectedContent.poster_path && (
                      <Image
                        src={`${TMDB_IMG}${selectedContent.poster_path}`}
                        alt=""
                        width={40}
                        height={60}
                        style={{ borderRadius: 3, objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: 'white' }}>{selectedContent.title || selectedContent.name}</strong>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                        {selectedContent.media_type === 'tv' ? 'S\u00e9rie' : 'Film'} &middot; {selectedContent.year || '\u2014'}
                      </div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                        Lien\u00a0: {url}
                      </div>
                    </div>
                    <button type="button" onClick={clearContent} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>
                      &times;
                    </button>
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <input
                      value={contentQuery}
                      onChange={e => handleContentQueryChange(e.target.value)}
                      placeholder="Rechercher un film ou une s\u00e9rie\u2026"
                      style={{ width: '100%' }}
                    />
                    {contentSearching && (
                      <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>
                        \u2026
                      </div>
                    )}
                    {contentResults.length > 0 && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 6, marginTop: 4, overflow: 'hidden' }}>
                        {contentResults.map(item => (
                          <button
                            key={`${item.media_type}-${item.id}`}
                            type="button"
                            onClick={() => selectContent(item)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textAlign: 'left' }}
                          >
                            {item.poster_path
                              ? <Image src={`${TMDB_IMG}${item.poster_path}`} alt="" width={28} height={42} style={{ borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} />
                              : <div style={{ width: 28, height: 42, background: 'rgba(255,255,255,0.08)', borderRadius: 2, flexShrink: 0 }} />
                            }
                            <div>
                              <div style={{ color: 'white', fontSize: 13, fontWeight: 600 }}>{item.title || item.name}</div>
                              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
                                {item.media_type === 'tv' ? 'S\u00e9rie' : 'Film'} &middot; {item.year || '\u2014'}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <label className="notifications-field">
                <span>Le sujet de votre message</span>
                <textarea value={theme} onChange={e => setTheme(e.target.value)} maxLength={180} rows={3} placeholder="Ex. Une nouvelle s\u00e9lection de films pour le week-end" />
                <small>{theme.length}/180</small>
              </label>

              <div className="notifications-field">
                <span>\u00c0 qui s&apos;adresse-t-il\u00a0?</span>
                <div className="notifications-audiences">
                  <button type="button" className={audience === 'all' ? 'selected' : ''} onClick={() => setAudience('all')}>
                    <strong>Tous les membres</strong>
                    <small>Les personnes abonn\u00e9es aux notifications</small>
                  </button>
                  <button type="button" className={audience === 'free' ? 'selected' : ''} onClick={() => setAudience('free')}>
                    <strong>Comptes gratuits</strong>
                    <small>Les membres sans abonnement actif</small>
                  </button>
                </div>
              </div>

              {audience === 'free' && (
                <label className="notifications-field notifications-days">
                  <span>Jours Premium offerts <small>Facultatif &middot; 0 \u00e0 90 jours</small></span>
                  <input type="number" min={0} max={90} value={premiumDays} onChange={e => setPremiumDays(Math.max(0, Math.min(90, Number(e.target.value) || 0)))} />
                </label>
              )}

              <div className="notifications-step-actions">
                <Button loading={working} onClick={continueWithoutAi}>
                  Continuer sans l&apos;IA <SendOutlined />
                </Button>
                <Button type="primary" size="large" loading={working} onClick={() => void generateDraft()}>
                  R\u00e9diger avec l&apos;IA <BulbOutlined />
                </Button>
              </div>
            </div>
          )}

          {step === 2 && draft && (
            <div className="notifications-step-body">
              <div className="notifications-intro">
                <span className="notifications-step-count">02 / MESSAGE</span>
                <h2>{draft.usedProvider ? 'Un texte pr\u00eat \u00e0 vous repr\u00e9senter.' : '\u00c9crivez votre message.'}</h2>
                <p>
                  {draft.usedProvider
                    ? "Relisez-le et ajustez chaque mot. Le m\u00eame moteur IA que les suggestions \u00e9ditoriales CHILLERS est utilis\u00e9 ici."
                    : "R\u00e9digez le titre et le message vous-m\u00eame, ou demandez une proposition \u00e0 l'assistant."}
                </p>
              </div>
              <label className="notifications-field">
                <span>Titre <small>{draft.title.length}/55</small></span>
                <input value={draft.title} maxLength={55} onChange={e => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label className="notifications-field">
                <span>Message <small>{draft.message.length}/160</small></span>
                <textarea value={draft.message} maxLength={160} rows={4} onChange={e => setDraft({ ...draft, message: e.target.value })} />
              </label>
              <div className="notifications-ai-note">
                <BulbOutlined />
                {draft.usedProvider
                  ? `Texte propos\u00e9 par ${draft.usedProvider === 'groq' ? 'Groq' : 'Gemini'} \u00b7 moteur \u00e9ditorial partag\u00e9`
                  : "R\u00e9daction manuelle \u00b7 aucune g\u00e9n\u00e9ration IA lanc\u00e9e"}
              </div>
              <div className="notifications-step-actions split">
                <Button onClick={() => setStep(1)}>Modifier le sujet</Button>
                <div>
                  <Button loading={working} icon={<ReloadOutlined />} onClick={() => void generateDraft()}>
                    {draft.usedProvider ? 'Nouvelle version IA' : "Proposer avec l'IA"}
                  </Button>
                  <Button type="primary" onClick={chooseDelivery}>
                    Suivant <SendOutlined />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && draft && (
            <div className="notifications-step-body">
              <div className="notifications-intro">
                <span className="notifications-step-count">03 / MOMENT</span>
                <h2>Quand doit-il partir\u00a0?</h2>
                <p>Vous pouvez programmer le message ou le diffuser d\u00e8s maintenant.</p>
              </div>
              <label className="notifications-field">
                <span>Page ouverte au clic</span>
                <input value={url} maxLength={300} onChange={e => setUrl(e.target.value)} placeholder="/" />
              </label>
              <label className="notifications-field">
                <span>Image de la notification <small>URL affiche TMDB &mdash; optionnel</small></span>
                <input value={image} maxLength={500} onChange={e => setImage(e.target.value)} placeholder="https://image.tmdb.org/t/p/w500/..." />
                {image && <img src={image} alt="" style={{ marginTop: 8, maxHeight: 80, borderRadius: 4, objectFit: 'cover' }} />}
              </label>
              <label className="notifications-field">
                <span>Date et heure programm\u00e9es</span>
                <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              </label>
              <div className="notifications-delivery-note">
                <BellOutlined />
                <div>
                  <strong>{audience === 'free' ? 'Comptes gratuits' : 'Tous les membres abonn\u00e9s'}</strong>
                  <span>
                    {premiumDays > 0
                      ? `${premiumDays} jours Premium seront accord\u00e9s aux comptes gratuits cibl\u00e9s.`
                      : "La campagne sera envoy\u00e9e aux appareils qui ont autoris\u00e9 les notifications."}
                  </span>
                </div>
              </div>
              <div className="notifications-step-actions split">
                <Button onClick={() => setStep(2)}>Retour \u00e0 l&apos;aper\u00e7u</Button>
                <div>
                  <Button loading={working} onClick={() => void create(false)}>Programmer</Button>
                  <Button type="primary" loading={working} icon={<SendOutlined />} onClick={() => void create(true)}>
                    Envoyer maintenant
                  </Button>
                </div>
              </div>
            </div>
          )}
        </Card>

        <aside className="notifications-preview-column">
          <div className="notifications-preview-heading">
            <span>APER\u00c7U</span>
            <small>Visible sur un appareil</small>
          </div>
          <div className="notifications-phone">
            <div className="notifications-phone-notch" />
            <div className="notifications-phone-top"><span>9:41</span><span>&bull;&bull;&bull;</span></div>
            <div className="notifications-push-card">
              <div className="notifications-push-brand">
                <Image src="/logo-centered.png" alt="" width={26} height={26} />
                <div><strong>CHILLERS</strong><small>maintenant</small></div>
                <BellOutlined />
              </div>
              <strong className="notifications-push-title">{previewTitle}</strong>
              <p>{previewMessage}</p>
              {image && (
                <img src={image} alt="" style={{ width: '100%', borderRadius: 4, marginTop: 6, objectFit: 'cover', maxHeight: 120 }} />
              )}
              {premiumDays > 0 && <span className="notifications-push-offer">+ {premiumDays} jours Premium</span>}
            </div>
            <div className="notifications-phone-hint">
              Un aper\u00e7u du message tel qu&apos;il appara\u00eetre dans les notifications.
            </div>
          </div>
          <div className="notifications-editorial-tip">
            <BulbOutlined />
            <span>Les messages courts et pr\u00e9cis donnent une bonne raison de revenir.</span>
          </div>
        </aside>
      </section>

      <section className="notifications-campaigns">
        <div className="notifications-campaign-heading">
          <div>
            <span className="notifications-kicker">SUIVI</span>
            <h2>Vos campagnes</h2>
            <p>Retrouvez les envois programm\u00e9s et leur \u00e9tat.</p>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => void reload()} loading={loading}>Actualiser</Button>
        </div>
        <Card>
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={campaigns}
            pagination={{ pageSize: 8 }}
            scroll={{ x: 850 }}
            columns={columns}
            locale={{ emptyText: 'Aucune campagne. Votre premi\u00e8re prise de parole commence ici.' }}
          />
        </Card>
      </section>
    </main>
  );
}

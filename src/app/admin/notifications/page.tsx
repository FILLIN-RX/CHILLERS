'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { Button, Card, Table, Tag, Typography, message } from '@/components/admin/ui';
import { BellOutlined, BulbOutlined, SendOutlined, ReloadOutlined } from '@/components/admin/icons';
import { adminCancelPushCampaign, adminCreatePushCampaign, adminGeneratePushCampaignDraft, adminGetPushCampaigns, type AdminPushCampaign } from '@/services/admin';

const { Title, Text, Paragraph } = Typography;
const statusColor: Record<string, string> = { scheduled: 'blue', sending: 'processing', sent: 'green', cancelled: 'default', failed: 'red' };
const statusLabel: Record<string, string> = { scheduled: 'Programmée', sending: 'En cours', sent: 'Envoyée', cancelled: 'Annulée', failed: 'Échec' };
type Audience = 'all' | 'free';

export default function AdminNotificationsPage() {
  const [campaigns, setCampaigns] = useState<AdminPushCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [working, setWorking] = useState(false);
  const [step, setStep] = useState(1);
  const [theme, setTheme] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [premiumDays, setPremiumDays] = useState(0);
  const [url, setUrl] = useState('/');
  const [scheduledAt, setScheduledAt] = useState('');
  const [draft, setDraft] = useState<{ title: string; message: string; usedProvider: 'gemini' | 'groq' | null } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try { const res = await adminGetPushCampaigns(); setCampaigns(res.data || []); }
    catch { message.error('Impossible de charger les campagnes.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void reload(); }, 0); return () => window.clearTimeout(timer); }, [reload]);

  const generateDraft = async () => {
    if (!theme.trim()) { message.error('Ajoutez un sujet pour guider le message.'); return; }
    setWorking(true);
    try {
      const res = await adminGeneratePushCampaignDraft({ theme: theme.trim(), audience, grantPremiumDays: premiumDays });
      if (!res.success || !res.data) throw new Error(res.message || 'La génération du message a échoué.');
      setDraft(res.data);
      setStep(2);
    } catch (error: unknown) { message.error(error instanceof Error ? error.message : 'Impossible de générer le message.'); }
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
      message.error('Choisissez une date située au moins une minute dans le futur.'); return;
    }
    setWorking(true);
    try {
      const res = await adminCreatePushCampaign({ theme: theme.trim(), audience, title: draft.title, message: draft.message, url, grantPremiumDays: premiumDays, scheduledAt: sendNow ? undefined : new Date(scheduledAt).toISOString(), sendNow });
      if (!res.success || !res.data) throw new Error(res.message || 'Création impossible');
      if (sendNow && (res.data.deliveryCount || 0) === 0) message.warning('Campagne traitée, mais aucun navigateur abonné n’a accepté le push.');
      else if (sendNow) message.success(`Envoi terminé : ${res.data.deliveryCount} notification(s) acceptée(s).`);
      else message.success('Votre campagne est programmée.');
      setStep(1); setTheme(''); setAudience('all'); setPremiumDays(0); setUrl('/'); setScheduledAt(''); setDraft(null);
      void reload();
    } catch (error: unknown) { message.error(error instanceof Error ? error.message : 'Impossible de créer la campagne.'); }
    finally { setWorking(false); }
  };

  const cancel = async (id: string) => {
    try { const res = await adminCancelPushCampaign(id); if (!res.success) throw new Error(res.message); message.success('Campagne annulée.'); void reload(); }
    catch (error: unknown) { message.error(error instanceof Error ? error.message : 'Annulation impossible.'); }
  };

  const columns = [
    { title: 'Campagne', key: 'campaign', render: (_: unknown, row: AdminPushCampaign) => <div><Text strong>{row.theme}</Text><div style={{ maxWidth: 460, marginTop: 4 }}><Text type="secondary" ellipsis>{row.title} — {row.message}</Text></div></div> },
    { title: 'Public', dataIndex: 'audience', render: (value: string) => value === 'free' ? 'Comptes gratuits' : 'Tous les abonnés' },
    { title: 'Date d’envoi', dataIndex: 'scheduledAt', render: (value: string) => new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) },
    { title: 'État', dataIndex: 'status', render: (value: string) => <Tag color={statusColor[value]}>{statusLabel[value] || value}</Tag> },
    { title: 'Envois', dataIndex: 'deliveryCount', align: 'right' as const, render: (value?: number) => value?.toLocaleString('fr-FR') ?? '—' },
    { title: '', key: 'actions', render: (_: unknown, row: AdminPushCampaign) => row.status === 'scheduled' ? <Button danger size="small" onClick={() => void cancel(row._id)}>Annuler</Button> : null },
  ];

  return <main className="notifications-page">
    <header className="notifications-heading">
      <div><Text className="notifications-kicker">COMMUNAUTÉ · MESSAGES PUSH</Text><Title level={2}>Restez présent au bon moment.</Title><Paragraph>Préparez un message utile, relisez-le comme vos membres le verront, puis choisissez quand l’envoyer.</Paragraph></div>
      <div className="notifications-heading-mark"><BellOutlined /><span>Un message, une bonne raison de revenir.</span></div>
    </header>

    <section className="notifications-workspace">
      <Card className="notifications-builder" title={<div className="notifications-card-title"><span>Créer une campagne</span><Text type="secondary">Étape {step} sur 3</Text></div>}>
        <div className="notifications-steps" aria-label="Étapes de création">
          {[['01', 'Le sujet'], ['02', 'Le message'], ['03', 'L’envoi']].map(([number, label], index) => <div key={number} className={`notifications-step ${step === index + 1 ? 'is-current' : step > index + 1 ? 'is-done' : ''}`}><span>{number}</span><small>{label}</small></div>)}
        </div>

        {step === 1 && <div className="notifications-step-body">
          <div className="notifications-intro"><span className="notifications-step-count">01 / INTENTION</span><h2>Qu’avez-vous à partager ?</h2><p>Donnez le contexte. L’assistant éditorial CHILLERS proposera un texte court, adapté au public choisi.</p></div>
          <label className="notifications-field"><span>Le sujet de votre message</span><textarea value={theme} onChange={event => setTheme(event.target.value)} maxLength={180} rows={3} placeholder="Ex. Une nouvelle sélection de films pour le week-end" /><small>{theme.length}/180</small></label>
          <div className="notifications-field"><span>À qui s’adresse-t-il ?</span><div className="notifications-audiences">
            <button type="button" className={audience === 'all' ? 'selected' : ''} onClick={() => setAudience('all')}><strong>Tous les membres</strong><small>Les personnes abonnées aux notifications</small></button>
            <button type="button" className={audience === 'free' ? 'selected' : ''} onClick={() => setAudience('free')}><strong>Comptes gratuits</strong><small>Les membres sans abonnement actif</small></button>
          </div></div>
          {audience === 'free' && <label className="notifications-field notifications-days"><span>Jours Premium offerts <small>Facultatif · 0 à 90 jours</small></span><input type="number" min={0} max={90} value={premiumDays} onChange={event => setPremiumDays(Math.max(0, Math.min(90, Number(event.target.value) || 0)))} /></label>}
          <div className="notifications-step-actions"><Button loading={working} onClick={continueWithoutAi}>Continuer sans l’IA <SendOutlined /></Button><Button type="primary" size="large" loading={working} onClick={() => void generateDraft()}>Rédiger avec l’IA <BulbOutlined /></Button></div>
        </div>}

        {step === 2 && draft && <div className="notifications-step-body">
          <div className="notifications-intro"><span className="notifications-step-count">02 / MESSAGE</span><h2>{draft.usedProvider ? 'Un texte prêt à vous représenter.' : 'Écrivez votre message.'}</h2><p>{draft.usedProvider ? 'Relisez-le et ajustez chaque mot. Le même moteur IA que les suggestions éditoriales CHILLERS est utilisé ici.' : 'Rédigez le titre et le message vous-même, ou demandez une proposition à l’assistant.'}</p></div>
          <label className="notifications-field"><span>Titre <small>{draft.title.length}/55</small></span><input value={draft.title} maxLength={55} onChange={event => setDraft({ ...draft, title: event.target.value })} /></label>
          <label className="notifications-field"><span>Message <small>{draft.message.length}/160</small></span><textarea value={draft.message} maxLength={160} rows={4} onChange={event => setDraft({ ...draft, message: event.target.value })} /></label>
          <div className="notifications-ai-note"><BulbOutlined />{draft.usedProvider ? `Texte proposé par ${draft.usedProvider === 'groq' ? 'Groq' : 'Gemini'} · moteur éditorial partagé` : 'Rédaction manuelle · aucune génération IA lancée'}</div>
          <div className="notifications-step-actions split"><Button onClick={() => setStep(1)}>Modifier le sujet</Button><div><Button loading={working} icon={<ReloadOutlined />} onClick={() => void generateDraft()}>{draft.usedProvider ? 'Nouvelle version IA' : 'Proposer avec l’IA'}</Button><Button type="primary" onClick={chooseDelivery}>Suivant <SendOutlined /></Button></div></div>
        </div>}

        {step === 3 && draft && <div className="notifications-step-body">
          <div className="notifications-intro"><span className="notifications-step-count">03 / MOMENT</span><h2>Quand doit-il partir ?</h2><p>Vous pouvez programmer le message ou le diffuser dès maintenant.</p></div>
          <label className="notifications-field"><span>Page ouverte au clic</span><input value={url} maxLength={300} onChange={event => setUrl(event.target.value)} placeholder="/" /></label>
          <label className="notifications-field"><span>Date et heure programmées</span><input type="datetime-local" value={scheduledAt} onChange={event => setScheduledAt(event.target.value)} /></label>
          <div className="notifications-delivery-note"><BellOutlined /><div><strong>{audience === 'free' ? 'Comptes gratuits' : 'Tous les membres abonnés'}</strong><span>{premiumDays > 0 ? `${premiumDays} jours Premium seront accordés aux comptes gratuits ciblés.` : 'La campagne sera envoyée aux appareils qui ont autorisé les notifications.'}</span></div></div>
          <div className="notifications-step-actions split"><Button onClick={() => setStep(2)}>Retour à l’aperçu</Button><div><Button loading={working} onClick={() => void create(false)}>Programmer</Button><Button type="primary" loading={working} icon={<SendOutlined />} onClick={() => void create(true)}>Envoyer maintenant</Button></div></div>
        </div>}
      </Card>

      <aside className="notifications-preview-column"><div className="notifications-preview-heading"><span>APERÇU</span><small>Visible sur un appareil</small></div><div className="notifications-phone"><div className="notifications-phone-notch" /><div className="notifications-phone-top"><span>9:41</span><span>•••</span></div><div className="notifications-push-card"><div className="notifications-push-brand"><Image src="/logo-centered.png" alt="" width={26} height={26} /><div><strong>CHILLERS</strong><small>maintenant</small></div><BellOutlined /></div><strong className="notifications-push-title">{draft?.title || theme.trim() || 'Votre prochain message'}</strong><p>{draft?.message || (draft && !draft.usedProvider ? 'Votre message apparaîtra ici pendant que vous le rédigez.' : 'Le texte proposé apparaîtra ici. Ajustez le sujet et le public pour commencer.')}</p>{premiumDays > 0 && <span className="notifications-push-offer">+ {premiumDays} jours Premium</span>}</div><div className="notifications-phone-hint">Un aperçu du message tel qu’il apparaîtra dans les notifications.</div></div><div className="notifications-editorial-tip"><BulbOutlined /><span>Les messages courts et précis donnent une bonne raison de revenir.</span></div></aside>
    </section>

    <section className="notifications-campaigns"><div className="notifications-campaign-heading"><div><span className="notifications-kicker">SUIVI</span><h2>Vos campagnes</h2><p>Retrouvez les envois programmés et leur état.</p></div><Button icon={<ReloadOutlined />} onClick={() => void reload()} loading={loading}>Actualiser</Button></div><Card><Table rowKey="_id" loading={loading} dataSource={campaigns} pagination={{ pageSize: 8 }} scroll={{ x: 850 }} columns={columns} locale={{ emptyText: 'Aucune campagne. Votre première prise de parole commence ici.' }} /></Card></section>
  </main>;
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Empty, Input, Modal, Pagination, Row,
  Select, Space, Spin, Tag, Typography, message,
} from '@/components/admin/ui';
import { MagnifyingGlass, LinkSimple, ArrowsClockwise } from '@phosphor-icons/react';
import {
  adminGetUnmatchedCatalog,
  adminLinkUnmatchedCatalog,
  adminTmdbSearch,
  type AdminUnmatchedCatalogItem,
} from '@/services/admin';
import type { TmdbSearchResult } from '@/types/admin';

const { Title, Text, Paragraph } = Typography;
type CatalogType = 'movie' | 'tv' | 'anime';
type Provider = 'frenchstream' | 'otaku' | 'afroland';
type Candidate = TmdbSearchResult & { media_type: 'movie' | 'tv' };

const typeLabels: Record<CatalogType, string> = { movie: 'Films', tv: 'Séries', anime: 'Animes' };
const providerLabels: Record<Provider, string> = {
  frenchstream: 'FrenchStream',
  otaku: 'French-Manga (W16)',
  afroland: 'AfroLandTV',
};

export default function AdminCataloguePage() {
  const [type, setType] = useState<CatalogType>('movie');
  const [provider, setProvider] = useState<Provider | undefined>();
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminUnmatchedCatalogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminUnmatchedCatalogItem | null>(null);
  const [searchText, setSearchText] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [pendingCandidate, setPendingCandidate] = useState<Candidate | null>(null);
  const [confirmYearMismatch, setConfirmYearMismatch] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await adminGetUnmatchedCatalog({ type, provider, page, q: submittedQuery || undefined });
      if (!result.success || !result.data) throw new Error(result.message || 'Impossible de charger les fiches non liées.');
      setItems(result.data.items);
      setTotal(result.data.total);
      setSelected((current) => result.data!.items.find((item) => item.id === current?.id) || result.data!.items[0] || null);
    } catch (err: any) {
      setError(err?.message || 'Erreur de chargement.');
      setItems([]);
      setTotal(0);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }, [type, provider, page, submittedQuery]);

  useEffect(() => { void loadItems(); }, [loadItems]);

  const runTmdbSearch = async () => {
    const term = searchText.trim() || selected?.title || '';
    if (term.length < 2) return;
    setSearching(true);
    setError('');
    try {
      const kinds: Array<'movie' | 'tv'> = type === 'anime' ? ['movie', 'tv'] : [type];
      const responses = await Promise.all(kinds.map((kind) => adminTmdbSearch(term, kind, selected?.year)));
      const found: Candidate[] = responses.flatMap((response, index) => {
        if (!response.success || !Array.isArray(response.data)) return [];
        return response.data.map((candidate) => ({ ...candidate, media_type: kinds[index] }));
      });
      setCandidates(found);
      if (!found.length) setError('Aucun résultat TMDB. Essaie le titre original ou une variante du titre.');
    } catch (err: any) {
      setError(err?.message || 'Recherche TMDB impossible.');
    } finally {
      setSearching(false);
    }
  };

  const yearMismatch = useMemo(() => {
    if (!selected?.year || !pendingCandidate?.year) return false;
    return Math.abs(selected.year - pendingCandidate.year) > 1;
  }, [selected, pendingCandidate]);

  const confirmLink = async () => {
    if (!selected || !pendingCandidate) return;
    setLinking(true);
    setError('');
    try {
      const result = await adminLinkUnmatchedCatalog(selected.id, {
        tmdbId: pendingCandidate.id,
        mediaType: pendingCandidate.media_type,
        confirmYearMismatch: yearMismatch && confirmYearMismatch,
      });
      if (!result.success) throw new Error(result.message || 'La liaison a échoué.');
      const linkedCount = result.data?.linkedCount || 1;
      message.success(type === 'tv' && linkedCount > 1
        ? `« ${selected.title} » : ${linkedCount} saisons liées à TMDB ${pendingCandidate.id}.`
        : `« ${selected.title} » est lié à TMDB ${pendingCandidate.id}.`);
      setPendingCandidate(null);
      setConfirmYearMismatch(false);
      setCandidates([]);
      await loadItems();
    } catch (err: any) {
      setError(err?.message || 'La liaison a échoué.');
    } finally {
      setLinking(false);
    }
  };

  const changeType = (next: CatalogType) => { setType(next); setPage(1); setCandidates([]); };
  const changeProvider = (next?: Provider) => { setProvider(next); setPage(1); };
  const startSearch = () => { setPage(1); setSubmittedQuery(query.trim()); };

  return (
    <div className="catalog-page catalog-linking-page">
      <header className="catalog-linking-heading">
        <div>
          <span className="catalog-linking-kicker">CHILLERS · CATALOGUE</span>
          <Title level={2}>Liaisons catalogue</Title>
          <p>Rapproche les fiches fournisseurs de leur référence TMDB, puis vérifie le lien avant de l’enregistrer.</p>
        </div>
        <div className="catalog-linking-total"><strong>{total.toLocaleString('fr-FR')}</strong><span>fiches à examiner</span></div>
      </header>

      <p className="catalog-linking-summary-note">La liste commence par les fiches les plus récentes. Les saisons d’une même série peuvent être liées ensemble.</p>
      {error && <Alert type="error" showIcon closable title={error} style={{ marginBottom: 16 }} onClose={() => setError('')} />}

      <Card className="catalog-linking-filters" size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={8} lg={5}>
            <Select value={type} onChange={(next: unknown) => changeType(next as CatalogType)} style={{ width: '100%' }} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} aria-label="Type de catalogue" />
          </Col>
          <Col xs={24} sm={8} lg={5}>
            <Select
              value={provider}
              onChange={(next: unknown) => changeProvider(next as Provider | undefined)}
              allowClear
              placeholder="Tous les fournisseurs"
              style={{ width: '100%' }}
              options={Object.entries(providerLabels).map(([value, label]) => ({ value, label }))}
              aria-label="Fournisseur"
            />
          </Col>
          <Col xs={24} sm={8} lg={14}>
            <Input.Search
              value={query}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
              onSearch={startSearch}
              placeholder="Filtrer les titres du fournisseur"
              enterButton="Filtrer"
              allowClear
            />
          </Col>
        </Row>
      </Card>

      <Row className="catalog-linking-workspace" gutter={[16, 16]} align="top">
        <Col xs={24} lg={10}>
          <Card
            className="catalog-linking-panel"
            size="small"
            title={<Space><span>Fiches fournisseurs</span><Tag>{total.toLocaleString('fr-FR')}</Tag></Space> as unknown as string}
            extra={<Button type="text" icon={<ArrowsClockwise size={18} />} onClick={() => void loadItems()} aria-label="Actualiser" />}
          >
            {loading ? <div style={{ padding: 36, textAlign: 'center' }}><Spin /></div> : items.length ? (
              <Space orientation="vertical" style={{ width: '100%' }} size={8}>
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setSelected(item); setSearchText(item.title); setCandidates([]); }}
                    className={`catalog-source-item${selected?.id === item.id ? ' is-selected' : ''}`}
                  >
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {item.posterUrl && (
                        <img
                          src={item.posterUrl}
                          alt={`Affiche de ${item.title}`}
                          width={52}
                          height={76}
                          loading="lazy"
                          className="catalog-source-poster"
                        />
                      )}
                      <Space orientation="vertical" size={4} style={{ width: '100%', minWidth: 0 }}>
                        <span className="catalog-source-title">{item.title}</span>
                        <span className="catalog-source-year">{item.year || 'Année inconnue'}{item.season ? ` · Saison ${item.season}` : ''}</span>
                        <Space wrap size={6}>
                          <Tag>{providerLabels[item.provider]}</Tag>
                          {item.language && <Tag>{item.language}</Tag>}
                        </Space>
                        {item.description && (
                          <span className="catalog-source-description">{item.description}</span>
                        )}
                      </Space>
                    </div>
                  </button>
                ))}
                <Pagination
                  size="small"
                  current={page}
                  pageSize={30}
                  total={total}
                  showSizeChanger={false}
                  onChange={(next: unknown) => setPage(Number(next))}
                  style={{ paddingTop: 8, textAlign: 'center' }}
                />
              </Space>
            ) : <Empty description="Aucune fiche dans cette page" />}
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card className="catalog-linking-panel catalog-match-panel" title="Référence TMDB" size="small">
            {selected ? (
              <>
                <div className="catalog-selected-source"><span>FICHE FOURNISSEUR SÉLECTIONNÉE</span><strong>{selected.title}</strong><small>{providerLabels[selected.provider]} · {selected.year || 'année inconnue'}{selected.season ? ` · Saison ${selected.season}` : ''}</small></div>
                <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
                  <Input
                    value={searchText}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => setSearchText(event.target.value)}
                    onPressEnter={() => void runTmdbSearch()}
                    placeholder="Titre à rechercher dans TMDB"
                  />
                  <Button type="primary" icon={<MagnifyingGlass size={17} />} loading={searching} onClick={() => void runTmdbSearch()}>Chercher</Button>
                </Space.Compact>
                {candidates.length ? (
                  <Space orientation="vertical" size={10} style={{ width: '100%' }}>
                    {candidates.map((candidate) => (
                      <Card className="catalog-match-candidate" key={`${candidate.media_type}:${candidate.id}`} size="small" styles={{ body: { padding: 12 } }}>
                        <Row gutter={12} align="middle" wrap={false}>
                          <Col flex="none">
                            {candidate.poster ? <img src={candidate.poster} alt="" width={54} height={80} className="catalog-match-poster" /> : <div className="catalog-match-poster-placeholder" />}
                          </Col>
                          <Col flex="auto" style={{ minWidth: 0 }}>
                            <Space wrap size={6}>
                              <Text strong>{candidate.title || candidate.name}</Text>
                              <Tag color={candidate.media_type === 'movie' ? 'blue' : 'green'}>{candidate.media_type === 'movie' ? 'Film' : 'Série'}</Tag>
                              {candidate.year && <Tag>{candidate.year}</Tag>}
                            </Space>
                            {candidate.original_title && <div><Text type="secondary" style={{ fontSize: 12 }}>{candidate.original_title}</Text></div>}
                            {candidate.overview && <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: '4px 0 0', fontSize: 12 }}>{candidate.overview}</Paragraph>}
                          </Col>
                          <Col flex="none">
                            <Button icon={<LinkSimple size={16} />} onClick={() => { setPendingCandidate(candidate); setConfirmYearMismatch(false); }}>Lier</Button>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </Space>
                ) : !searching ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Lance une recherche TMDB pour voir les candidats." /> : null}
              </>
            ) : <Empty description="Sélectionne une fiche fournisseur" />}
          </Card>
        </Col>
      </Row>

      <Modal
        title="Confirmer le lien TMDB"
        open={Boolean(pendingCandidate)}
        onCancel={() => setPendingCandidate(null)}
        onOk={() => void confirmLink()}
        okText="Confirmer le lien"
        cancelText="Annuler"
        confirmLoading={linking}
        okButtonProps={{ disabled: yearMismatch && !confirmYearMismatch }}
        destroyOnHidden
      >
        {pendingCandidate && selected && (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <div><Text type="secondary">Fournisseur : </Text><Text strong>{selected.title}</Text>{selected.year ? ` (${selected.year})` : ''}</div>
            <div><Text type="secondary">TMDB : </Text><Text strong>{pendingCandidate.title || pendingCandidate.name}</Text>{pendingCandidate.year ? ` (${pendingCandidate.year})` : ''}<Tag style={{ marginLeft: 8 }}>{pendingCandidate.media_type === 'movie' ? 'Film' : 'Série'}</Tag></div>
            {yearMismatch && (
              <Alert type="warning" showIcon title="Les années ne correspondent pas" description={<Checkbox checked={confirmYearMismatch} onChange={(event: React.ChangeEvent<HTMLElement>) => setConfirmYearMismatch((event.target as HTMLInputElement).checked)}>J’ai vérifié qu’il s’agit bien de la même œuvre malgré cet écart.</Checkbox>} />
            )}
            <Text type="secondary">
              {selected.type === 'tv'
                ? 'Cette action liera aussi les autres saisons actives encore non liées du même titre chez ce fournisseur. Les saisons déjà liées ne seront pas modifiées.'
                : 'Cette action enregistrera une liaison manuelle et la fiche restera attachée au fournisseur d’origine.'}
            </Text>
          </Space>
        )}
      </Modal>
    </div>
  );
}

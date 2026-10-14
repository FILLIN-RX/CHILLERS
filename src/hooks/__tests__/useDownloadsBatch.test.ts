/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor } from '@testing-library/react';
import { useDownloadsBatch } from '@/hooks/useDownloadsBatch';
import { useDownloadsStore } from '@/store/downloads';
import * as downloadServiceModule from '@/services/downloads';
import * as streamSaverModule from '@/services/streamSaver';
import type { Episode } from '@/types/media';

const DESKTOP_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const IOS_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';

const makeEpisode = (n: number): Episode => ({
  id: `ep-${n}`,
  title: `Épisode ${n}`,
  duration: '24m',
  number: n,
  season: 1,
  thumbnail: '',
  synopsis: '',
});

const EPISODES = [makeEpisode(1), makeEpisode(2), makeEpisode(3)];
const MP4 = 'https://cdn.example.com/video.mkv.mp4?t=token';

type BatchArgs = Parameters<typeof useDownloadsBatch>[0];

const BASE: BatchArgs = {
  tmdbId: '57911',
  seriesTitle: 'Doraemon',
  type: 'series',
  episodes: EPISODES,
  language: 'fr',
};

function useBatch(args: BatchArgs) {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- renderHook exécute le hook pour le test
  return renderHook(() => useDownloadsBatch(args));
}

describe('useDownloadsBatch — téléchargement de sélection en deux étapes', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    useDownloadsStore.setState({
      tasks: [],
      cancelRequested: new Set<string>(),
      controllers: new Map<string, AbortController>(),
    });
    Object.defineProperty(navigator, 'userAgent', {
      value: DESKTOP_UA,
      configurable: true,
    });
    jest.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('étape 1 (gated) : résout tous les liens sans démarrer un seul flux', async () => {
    const resolve = jest
      .spyOn(downloadServiceModule, 'resolveDownloadUrl')
      .mockResolvedValue({ downloadUrl: MP4, fileCode: '' });
    const stream = jest
      .spyOn(streamSaverModule, 'streamDownloadToDisk')
      .mockResolvedValue({ totalBytes: 1 });

    const { result } = useBatch({ ...BASE, gated: true });

    await waitFor(() => expect(result.current.totals.ready).toBe(3));

    expect(resolve).toHaveBeenCalledTimes(3);
    expect(stream).not.toHaveBeenCalled();
    expect(result.current.totals.running).toBe(0);
    expect(
      result.current.tasks.every((t) => t.resolvedUrl?.startsWith('/api/download/file')),
    ).toBe(true);
  });

  it('étape 2 : lance les fichiers un par un, dans l ordre', async () => {
    jest
      .spyOn(downloadServiceModule, 'resolveDownloadUrl')
      .mockResolvedValue({ downloadUrl: MP4, fileCode: '' });

    let active = 0;
    let maxActive = 0;
    const order: string[] = [];
    const stream = jest
      .spyOn(streamSaverModule, 'streamDownloadToDisk')
      .mockImplementation(async (_url, opts) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        order.push(opts.filename);
        await new Promise((r) => setTimeout(r, 10));
        active -= 1;
        return { totalBytes: 1024 };
      });

    const { result } = useBatch({ ...BASE, gated: false });

    await waitFor(() => expect(result.current.totals.done).toBe(3));

    expect(stream).toHaveBeenCalledTimes(3);
    expect(maxActive).toBe(1);
    expect(order).toEqual(['Doraemon_S01E01.mp4', 'Doraemon_S01E02.mp4', 'Doraemon_S01E03.mp4']);
  });

  it('l étape 2 réutilise les liens de l étape 1 au lieu de re-résoudre', async () => {
    const resolve = jest
      .spyOn(downloadServiceModule, 'resolveDownloadUrl')
      .mockResolvedValue({ downloadUrl: MP4, fileCode: '' });
    jest
      .spyOn(streamSaverModule, 'streamDownloadToDisk')
      .mockResolvedValue({ totalBytes: 10 });

    const args: BatchArgs = { ...BASE, gated: true };
    const { result, rerender } = useBatch(args);
    await waitFor(() => expect(result.current.totals.ready).toBe(3));
    const links = result.current.tasks.map((t) => t.resolvedUrl);

    args.gated = false;
    rerender();
    await waitFor(() => expect(result.current.totals.done).toBe(3));

    expect(resolve).toHaveBeenCalledTimes(3);
    expect(result.current.tasks.map((t) => t.resolvedUrl)).toEqual(links);
  });

  it('iOS : aucun flux automatique, les épisodes restent prêts à toucher', async () => {
    Object.defineProperty(navigator, 'userAgent', { value: IOS_UA, configurable: true });

    jest
      .spyOn(downloadServiceModule, 'resolveDownloadUrl')
      .mockResolvedValue({ downloadUrl: MP4, fileCode: '' });
    const stream = jest
      .spyOn(streamSaverModule, 'streamDownloadToDisk')
      .mockResolvedValue({ totalBytes: null });

    const { result } = useBatch({ ...BASE, gated: false });

    await waitFor(() => expect(result.current.totals.ready).toBe(3));

    expect(stream).not.toHaveBeenCalled();
    expect(result.current.totals.done).toBe(0);
  });

  it('une URL de page hébergeur est une erreur, jamais un téléchargement', async () => {
    jest
      .spyOn(downloadServiceModule, 'resolveDownloadUrl')
      .mockResolvedValue({ downloadUrl: 'https://vidlink.pro/movie/123', fileCode: '' });
    const stream = jest
      .spyOn(streamSaverModule, 'streamDownloadToDisk')
      .mockResolvedValue({ totalBytes: 1 });

    const { result } = useBatch({ ...BASE, gated: true });

    await waitFor(() => expect(result.current.totals.failed).toBe(3));

    expect(stream).not.toHaveBeenCalled();
    expect(result.current.tasks.every((t) => t.resolvedUrl === null)).toBe(true);
  });
});

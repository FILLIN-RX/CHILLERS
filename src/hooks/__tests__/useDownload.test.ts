/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useDownload } from '@/hooks/useDownload';
import { useDownloadsStore } from '@/store/downloads';
import { useAuthStore } from '@/stores/useAuthStore';
import { useSubscriptionStore } from '@/stores/useSubscriptionStore';
import * as streamSaverModule from '@/services/streamSaver';
import * as offlineStorageModule from '@/services/offlineStorage';
import * as downloadServiceModule from '@/services/downloads';

describe('useDownload Hook — iOS vs Normal Browser Workflow', () => {
  const originalUserAgent = navigator.userAgent;

  beforeEach(() => {
    // Reset stores
    useDownloadsStore.setState({
      tasks: [],
      cancelRequested: new Set<string>(),
      controllers: new Map<string, AbortController>(),
    });
    useAuthStore.setState({
      user: null,
    });
    useSubscriptionStore.setState({
      globalSubscriptionEnabled: false,
    });

    jest.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it('routes to streamDownloadToDisk (Safari native) when device is iOS, even without subscription', async () => {
    // Configurer iOS Safari
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      configurable: true,
    });

    const streamDiskSpy = jest
      .spyOn(streamSaverModule, 'streamDownloadToDisk')
      .mockResolvedValue({ totalBytes: null });

    const offlineStorageSpy = jest
      .spyOn(offlineStorageModule, 'streamVideoToIndexedDB')
      .mockResolvedValue({ totalBytes: 12345 } as any);

    jest.spyOn(downloadServiceModule, 'resolveDownloadUrl').mockResolvedValue({
      downloadUrl: 'https://cdn.example.com/movie.mp4',
      fileCode: 'abc123',
    });

    const { result } = renderHook(() =>
      useDownload({
        tmdbId: 550,
        type: 'movie',
        title: 'Fight Club',
      })
    );

    // Initialiser la résolution
    await act(async () => {
      await result.current.resolve();
    });

    expect(result.current.status).toBe('ready');

    // Lancer le téléchargement
    await act(async () => {
      await result.current.start();
    });

    // Sur iOS, streamDownloadToDisk DOIT être appelé (et NON streamVideoToIndexedDB)
    expect(streamDiskSpy).toHaveBeenCalledTimes(1);
    expect(offlineStorageSpy).not.toHaveBeenCalled();
    expect(result.current.status).toBe('done');
  });

  it('routes to streamVideoToIndexedDB when on a Normal browser for free non-subscriber users', async () => {
    // Configurer Desktop Chrome
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      configurable: true,
    });
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    });
    Object.defineProperty(navigator, 'maxTouchPoints', {
      value: 0,
      configurable: true,
    });

    const streamDiskSpy = jest
      .spyOn(streamSaverModule, 'streamDownloadToDisk')
      .mockResolvedValue({ totalBytes: null });

    const offlineStorageSpy = jest
      .spyOn(offlineStorageModule, 'streamVideoToIndexedDB')
      .mockResolvedValue({ totalBytes: 12345 } as any);

    jest.spyOn(downloadServiceModule, 'resolveDownloadUrl').mockResolvedValue({
      downloadUrl: 'https://cdn.example.com/movie.mp4',
      fileCode: 'abc123',
    });

    const { result } = renderHook(() =>
      useDownload({
        tmdbId: 550,
        type: 'movie',
        title: 'Fight Club',
      })
    );

    await act(async () => {
      await result.current.resolve();
    });

    await act(async () => {
      await result.current.start();
    });

    // Sur navigateur normal pour utilisateur gratuit, c'est IndexedDB / Background Fetch
    expect(offlineStorageSpy).toHaveBeenCalledTimes(1);
    expect(streamDiskSpy).not.toHaveBeenCalled();
    expect(result.current.status).toBe('done');
  });

  it('routes to streamDownloadToDisk when user is a subscriber on a Normal browser', async () => {
    // Configurer Desktop Chrome
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      configurable: true,
    });

    // Activer l'abonnement
    useAuthStore.setState({
      user: {
        id: '1',
        email: 'user@test.com',
        isSubscriber: true,
      } as any,
    });
    useSubscriptionStore.setState({
      globalSubscriptionEnabled: true,
    });

    const streamDiskSpy = jest
      .spyOn(streamSaverModule, 'streamDownloadToDisk')
      .mockResolvedValue({ totalBytes: 99999 });

    const offlineStorageSpy = jest
      .spyOn(offlineStorageModule, 'streamVideoToIndexedDB');

    jest.spyOn(downloadServiceModule, 'resolveDownloadUrl').mockResolvedValue({
      downloadUrl: 'https://cdn.example.com/movie.mp4',
      fileCode: 'abc123',
    });

    const { result } = renderHook(() =>
      useDownload({
        tmdbId: 550,
        type: 'movie',
        title: 'Fight Club',
      })
    );

    await act(async () => {
      await result.current.resolve();
    });

    await act(async () => {
      await result.current.start();
    });

    // Utilisateur abonné sur Desktop : StreamSaver direct
    expect(streamDiskSpy).toHaveBeenCalledTimes(1);
    expect(offlineStorageSpy).not.toHaveBeenCalled();
    expect(result.current.status).toBe('done');
  });
});

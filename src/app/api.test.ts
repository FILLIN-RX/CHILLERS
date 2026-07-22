import { startDownload } from './api';

// On mock le fetch global
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () =>
      Promise.resolve({
        success: true,
        data: { downloadUrl: 'http://test.com/video.mp4', fileCode: 'abc123' },
      }),
  })
) as jest.Mock;

describe('Download Functionality', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('envoie tmdb_id + title au endpoint download et renvoie downloadUrl', async () => {
    const result = await startDownload('123', 'movie', 'Test Movie');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain('/doodstream/download');
    expect(calledUrl).toContain('tmdb_id=123');
    expect(calledUrl).toContain('title=Test+Movie');

    expect(result).toEqual({ downloadUrl: 'http://test.com/video.mp4', fileCode: 'abc123' });
  });

  it("n'envoie pas tmdb_id quand l'id n'est pas un identifiant TMDB numérique", async () => {
    await startDownload('64f0a1b2c3d4e5f6a7b8c9d0', 'movie', 'Test Movie');

    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).not.toContain('tmdb_id=');
    expect(calledUrl).toContain('title=Test+Movie');
  });
});

import { startDownload } from './api';

// On mock le fetch global
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve({ success: true, m3u8_url: 'http://test.com/video.m3u8' }),
  })
) as jest.Mock;

describe('Download Functionality', () => {
  it('should call startDownload with correct parameters and return url', async () => {
    const mockData = {
      id: '123',
      type: 'movie' as const,
      title: 'Test Movie'
    };

    const m3u8Url = await startDownload(mockData.id, mockData.type, mockData.title);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/download'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ mediaId: '123', mediaType: 'movie', title: 'Test Movie' })
      })
    );
    expect(m3u8Url).toBe('http://test.com/video.m3u8');
  });
});

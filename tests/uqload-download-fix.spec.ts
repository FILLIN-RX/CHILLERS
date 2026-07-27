import { test, expect } from '@playwright/test';

test.describe('Uqload HLS to MP4 Download Test', () => {
  // Test with two different films known to use Uqload
  const filmsToTest = [
    { title: 'The Matrix', tmdbId: 603 },
    { title: 'Inception', tmdbId: 27205 }
  ];

  for (const film of filmsToTest) {
    test(`Download fix: ${film.title} (tmdbId: ${film.tmdbId})`, async ({ page }) => {
      // 1. Navigate to the media page
      await page.goto(`/media/${film.tmdbId}?type=movie`);
      
      // 2. Wait for download button to be ready
      const downloadBtn = page.getByRole('button', { name: /Télécharger/ });
      await expect(downloadBtn).toBeEnabled({ timeout: 20_000 });

      // 3. Setup listener to catch the download request
      const downloadPromise = page.waitForEvent('download');

      // 4. Trigger download
      await downloadBtn.click();
      
      // 5. If it triggers a popup, we need to handle that or intercept the URL
      // If triggerDownload() uses window.open, it opens a new tab.
      // We might need to listen to page requests instead of browser downloads.
      
      const response = await page.waitForResponse(response => 
        response.url().includes('/api/download/stream') || 
        response.url().includes('uqload')
      );

      // Verify it's not an m3u8 playlist if it's the FFmpeg stream
      if (response.url().includes('/api/download/stream')) {
        const headers = response.headers();
        expect(headers['content-type']).toBe('video/mp4');
      }
    });
  }
});

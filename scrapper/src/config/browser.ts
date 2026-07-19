import { chromium, LaunchOptions } from 'playwright';

export const browserConfig: LaunchOptions = {
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu'
  ]
};

export const getBrowser = async () => {
  return await chromium.launch(browserConfig);
};

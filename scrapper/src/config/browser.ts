import { chromium, LaunchOptions, BrowserContext, Page } from 'playwright';

export const browserConfig: LaunchOptions = {
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-blink-features=AutomationControlled'
  ]
};

export const getBrowser = async () => {
  return await chromium.launch(browserConfig);
};

export async function setupFastContext(context: BrowserContext) {
  await context.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
      return route.abort();
    }
    return route.continue();
  });
}

export async function setupFastPage(page: Page) {
  await page.route('**/*', (route) => {
    const resourceType = route.request().resourceType();
    if (['image', 'media', 'font', 'stylesheet'].includes(resourceType)) {
      return route.abort();
    }
    return route.continue();
  });
}


import { Page } from 'playwright';

export async function installDonateOverlayBlocker(page: Page) {
    await page.addInitScript(() => {
        document.addEventListener('DOMContentLoaded', () => {
            document.querySelectorAll('#fs-donate-overlay').forEach(el => el.remove());
        });
        const observer = new MutationObserver(() => {
            document.querySelectorAll('#fs-donate-overlay').forEach(el => el.remove());
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    });
}
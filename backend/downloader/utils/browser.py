from playwright.async_api import async_playwright, Page, Browser
from downloader.config import (
    BROWSER_LAUNCH_TIMEOUT,
    NAVIGATION_TIMEOUT,
    ADBLOCK_PATTERNS,
)


async def create_page() -> tuple[Page, Browser]:
    """Crée un navigateur Chromium avec furtivité et blocage pubs."""
    p = await async_playwright().start()
    browser = await p.chromium.launch(
        headless=True,
        args=[
            "--no-sandbox",
            "--disable-blink-features=AutomationControlled",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--disable-web-security",
            "--disable-features=IsolateOrigins,site-per-process",
            "--window-size=1920,1080",
        ],
    )
    context = await browser.new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent=(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/130.0.0.0 Safari/537.36"
        ),
        locale="en-US",
        timezone_id="America/New_York",
        permissions=["notifications"],
        java_script_enabled=True,
    )

    page = await context.new_page()
    page.set_default_timeout(NAVIGATION_TIMEOUT * 1000)

    # ── Bloqueur publicitaire réseau ──────────────────────────
    async def adblock_route(route):
        url = route.request.url.lower()
        for pattern in ADBLOCK_PATTERNS:
            if pattern in url:
                await route.abort()
                return
        await route.continue_()

    await page.route("**/*", adblock_route)

    # ── Évasion de détection automatisation ───────────────────
    await page.add_init_script("""
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });
        Object.defineProperty(navigator, 'languages', {
            get: () => ['en-US', 'en'],
        });
        window.chrome = { runtime: {} };
    """)

    return page, browser

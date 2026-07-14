import asyncio
from playwright.async_api import Page


M3U8_KEYWORDS = {".m3u8", "master", "playlist", ".mpd"}
IGNORED_EXTENSIONS = {".ts", ".m4s", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".css", ".woff", ".woff2"}


async def listen_for_m3u8(
    page: Page,
    start_url: str,
    timeout: int = 30,
) -> str | None:
    """
    Ouvre start_url dans le navigateur et écoute toutes les requêtes
    réseau jusqu'à intercepter une URL de playlist HLS (.m3u8 / master).
    Utilise la vérification du Content-Type pour une meilleure précision.

    Dès capture, ferme le navigateur et retourne l'URL.
    Retourne None si timeout atteint.
    """
    found_url: str | None = None
    event = asyncio.Event()

    async def handle_response(response):
        nonlocal found_url
        headers = response.headers
        content_type = headers.get("content-type", "").lower()
        
        # Check for HLS content type
        if "application/vnd.apple.mpegurl" in content_type or "application/x-mpegurl" in content_type:
            found_url = response.url
            event.set()

    page.on("response", handle_response)

    try:
        await page.goto(start_url, wait_until="domcontentloaded", timeout=timeout * 1000)

        # Attendre l'URL ou le timeout
        await asyncio.wait_for(event.wait(), timeout=timeout)
        return found_url

    except asyncio.TimeoutError:
        return None
    except Exception:
        return None

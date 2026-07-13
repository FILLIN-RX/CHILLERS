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

    Dès capture, ferme le navigateur et retourne l'URL.
    Retourne None si timeout atteint.
    """
    found_url: str | None = None
    event = asyncio.Event()

    def handle_request(request):
        nonlocal found_url
        url = request.url.lower()

        # Ignorer les extensions inutiles
        for ext in IGNORED_EXTENSIONS:
            if url.endswith(ext):
                return

        # Vérifier les mots-clés de playlist
        for kw in M3U8_KEYWORDS:
            if kw in url:
                found_url = request.url
                event.set()
                return

    page.on("request", handle_request)

    try:
        await page.goto(start_url, wait_until="domcontentloaded", timeout=timeout * 1000)

        # Attendre l'URL ou le timeout
        await asyncio.wait_for(event.wait(), timeout=timeout)
        return found_url

    except asyncio.TimeoutError:
        return None
    except Exception:
        return None

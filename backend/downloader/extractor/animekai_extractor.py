from downloader.config import EXTRACTION_TIMEOUT
from downloader.extractor.base import BaseExtractor
from downloader.utils.browser import create_page
from downloader.utils.network_listener import listen_for_m3u8


def _slugify(title: str) -> str:
    import re
    s = title.lower()
    s = re.sub(r'[^\w\s-]', '', s)
    s = re.sub(r'[\s_]+', '-', s)
    s = re.sub(r'-+', '-', s)
    return s.strip('-')


class AnimeKaiExtractor(BaseExtractor):
    """Extracteur dédié pour les animes via AnimeKai."""

    name = "animekai"

    async def extract_m3u8(
        self,
        media_id: str,
        media_type: str = "movie",
        season: int | None = None,
        episode: int | None = None,
        title: str | None = None,
    ) -> str | None:
        if not title:
            return None

        slug = _slugify(title)
        if media_type == "tv" or media_type == "anime":
            ep = episode or 1
            url = f"https://animekai.to/embed/{slug}?ep={ep}"
        else:
            url = f"https://animekai.to/embed/{slug}"

        page, browser = await create_page()
        try:
            m3u8_url = await listen_for_m3u8(page, url, timeout=EXTRACTION_TIMEOUT)
            return m3u8_url
        finally:
            await browser.close()

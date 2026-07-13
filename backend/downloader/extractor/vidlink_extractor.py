from downloader.config import VIDLINK_BASE, EXTRACTION_TIMEOUT
from downloader.extractor.base import BaseExtractor
from downloader.utils.browser import create_page
from downloader.utils.network_listener import listen_for_m3u8


class VidLinkExtractor(BaseExtractor):
    """Extracteur prioritaire via VidLink (https://vidlink.pro)."""

    name = "vidlink"

    async def extract_m3u8(
        self,
        media_id: str,
        media_type: str = "movie",
        season: int | None = None,
        episode: int | None = None,
    ) -> str | None:
        if media_type == "movie":
            url = f"{VIDLINK_BASE}/movie/{media_id}"
        else:
            season = season or 1
            episode = episode or 1
            url = f"{VIDLINK_BASE}/tv/{media_id}/{season}/{episode}"

        page, browser = await create_page()
        try:
            m3u8_url = await listen_for_m3u8(
                page, url, timeout=EXTRACTION_TIMEOUT
            )
            return m3u8_url
        finally:
            await browser.close()

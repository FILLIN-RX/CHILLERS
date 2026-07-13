import asyncio
import sys
import json

from downloader.extractor.vidlink_extractor import VidLinkExtractor
from downloader.extractor.vidapi_extractor import VidAPIExtractor
from downloader.extractor.animekai_extractor import AnimeKaiExtractor


async def extract_url(
    media_id: str,
    media_type: str = "movie",
    season: int | None = None,
    episode: int | None = None,
    title: str | None = None,
) -> dict:
    """
    Extraction seule : retourne l'URL .m3u8 sans téléchargement.
    """
    is_anime = media_type == "anime"

    if is_anime and title:
        extractors = [AnimeKaiExtractor(), VidLinkExtractor(), VidAPIExtractor()]
    else:
        extractors = [VidLinkExtractor(), VidAPIExtractor()]

    last_error: str | None = None

    for extractor in extractors:
        try:
            m3u8_url = await extractor.extract_m3u8(
                media_id=media_id,
                media_type=media_type,
                season=season,
                episode=episode,
                title=title,
            )
            if m3u8_url:
                return {
                    "success": True,
                    "source": extractor.name,
                    "m3u8_url": m3u8_url,
                }
            last_error = f"{extractor.name}: aucun flux trouvé"
        except Exception as exc:
            last_error = f"{extractor.name}: {exc}"
            continue

    return {
        "success": False,
        "error": last_error or "Aucune source disponible",
        "source": None,
        "m3u8_url": None,
    }


async def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: main.py <media_id> [type] [season] [episode] [title]"}))
        sys.exit(1)

    media_id = sys.argv[1]
    media_type = sys.argv[2] if len(sys.argv) > 2 else "movie"
    season = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else None
    episode = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4].isdigit() else None
    title = sys.argv[5] if len(sys.argv) > 5 else None

    result = await extract_url(media_id, media_type, season, episode, title)
    print(json.dumps(result))


if __name__ == "__main__":
    asyncio.run(main())

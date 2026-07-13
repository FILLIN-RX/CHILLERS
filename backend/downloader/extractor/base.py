from abc import ABC, abstractmethod


class BaseExtractor(ABC):
    """Classe abstraite pour un extracteur de flux HLS."""

    @property
    @abstractmethod
    def name(self) -> str:
        ...

    @abstractmethod
    async def extract_m3u8(
        self,
        media_id: str,
        media_type: str = "movie",
        season: int | None = None,
        episode: int | None = None,
        title: str | None = None,
    ) -> str | None:
        """
        Tente d'intercepter l'URL .m3u8 depuis la source.

        Retourne l'URL du flux HLS ou None si aucun flux trouvé.
        """
        ...

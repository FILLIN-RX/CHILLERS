### provider to be added
    for football 

    [x] https://to.yallapro.cfd/max-1/  → source `yallapro`
        API WP `/wp-json/wp/v2/posts` → page `albaplayer/<slug>/?serv=N` → iframe
        yasirtv ou HLS direct. Intégré dans CHILLERS (/live/sp).

    [x] https://i.kooorah.online/2026/09/ch1.html?match=...  → source `kooorah`
        Programme du jour dans `schedule.koora-tv.click/kooratv.txt` → page du match
        → iframe du player. Intégré dans CHILLERS (/live/sp).

    [x] https://goalakor.space/kora.html?m=86  → source `kora`
        API `cdn.kora-api.org` (charge utile `k1` chiffrée AES-256-GCM).
        Intégré dans CHILLERS (/live/sp).

    [x] https://hesgoalltv.net/#live  → même backend que goalakor (kora)
        Redirige vers d'autres sources : rien de supplémentaire à implémenter,
        couvert par la source `kora`.

    [x] https://streamiz.lol/vipleaguetv/  → source `streamiz`
        Coquille publicitaire → livetv902.me → iframe `emb.apl614.online`.
        Intégré dans CHILLERS (/live/sp).

    [-] https://vipleague.ro/soccer-streams/vtv-f5m87-australia-brazil?l=2588451119
        Page expirée (HTTP 410). La home reste accessible mais c'est une SPA sans
        API identifiée : aucun flux à intégrer. Non implémenté volontairement.

    [-] https://streamonsport.lat/type.php?type=Football
        Faux lecteur (réponse de ~14 octets), aucune diffusion réelle.
        Non implémenté volontairement.

### Récapitulatif

    4 sources opérationnelles agrégées par le backend : kora, kooorah, yallapro, streamiz.
    Endpoints : /api/sports/matches, /api/sports/sources, /api/sports/match/:id/stream
                + relay HLS (/api/sports/match/:source/:matchId/hls/...).
    Frontend : rangée « Autres Sources en Direct » sur /live et sur la Home,
               page player /live/sp/<id>.

### Pipeline Transcodage & Ingestion Live Dédié (À venir)
- [ ] Mettre en place un serveur d'ingestion/transcodage (FFmpeg / Nimble / Flussonic / SRS)
- [ ] Traitement en temps réel des flux directs (Clean feeds / IPTV) avec suppression / remplacement des logos par le watermark officiel CHILLERS
- [ ] Distribution via CDN / Edge Caching HLS (.m3u8 / .ts)

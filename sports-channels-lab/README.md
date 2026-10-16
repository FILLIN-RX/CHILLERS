# sports-channels-lab

Lab isolé (aucune dépendance ajoutée au front/back) pour répondre à la
question : **comment les sites de streams savent que tel match est diffusé
quelque part, et quelles chaînes/serveurs y sont branchés ?**

Principe : comme les concurrents, on **interroge TOUS les providers**, on
**enregistre TOUS les serveurs/chaînes avec leurs liens** (pas seulement le
premier flux « qui joue » comme en prod), puis on **sonde chaque lien**.

## Usage

```bash
npm run scan      # 1. listes des 5 providers + résolution de CHAQUE match
                  #    (brut, sans le filtre « away » : yallapro canal-seul compris)
                  #    options: --providers=kora,liveball --limit=8 --live --no-resolve
npm run iptv      # 2. source « web » : playlist publique iptv-org sports (465),
                  #    filtre foot, probe → même store (provider iptv-org)
npm run probe     # 3. jouabilité de CHAQUE lien (m3u8 ? page ?) → deadAt si mort
npm run report    # 4. fixture fusionné inter-providers → data/report.json
npm run all
```

Stockage : `data/channels.jsonl` (merge par `provider:sourceId:nom:url`,
`firstSeen`/`lastSeen` conservés, probe rafraîchi à part) + `data/fixtures.json`
+ `data/report.json`. Re-scan sans doublon.

## Résultat du run du 2026-10-15

| | |
|---|---|
| Matchs scannés | **141** (liveball 41, kora 25, kooorah/yallapro/streamiz le reste) |
| Liens enregistrés | **168** → 207 après iptv-org |
| Liens jouables | **155/168 (92 %)** |
| Fixtures distincts | 78, dont **14 présents chez plusieurs providers** |
| Lives | 76, dont **70 avec au moins un flux jouable** |
| Libellés de chaînes réels vus | beIN Sport 1-5, TNT 1/2/5, Ziggo Sport, TRT 1, Magenta Sport, Thmaniya… |

Exemple (Lyon vs Crystal Palace, fusion streamiz + kora → 8 liens jouables :
`beIN Sport 2`, `TNT 1`, `Live 1-5`, HLS directs `.m3u8`).

## Comment les concurrents font

1. **Planning** : chaque source publie sa liste du jour (kora
   `api/v1/matches`, liveball HTML, yallapro flux texte…). On les fusionne.
2. **Match → là-bas** : les mêmes clubs écrits différemment d'une source à
   l'autre → comparaison par jetons normalisés + coup d'envoi
   (`fixture-match.ts`). Un match dispo chez 3 providers = 3 fois plus de liens.
3. **Canaux** : kora expose `match.channels[]` nativement (`server_name`,
   `ch`, `edge`, `language`) — le backend actuel écrase tout dans
   `servers[]` ; yallapro publie des entrées « canal seul » filtrées en prod.
4. **Liens** : players iframe (frame.php…), HLS directs extraits du player,
   miroirs. Le probe sépare le jouable du mort.

## Sources « web » publiques identifiées

- **iptv-org/iptv** (playlist `categories/sports.m3u`, 465 chaînes, flux
  publics, mis à jour quotidiennement) — déjà seedé par le module `live`,
  ici filtré sur les diffuseurs de foot. Run : 39 testées, **23 jouables**.
- **iptv-org/epg** : guide programme (match → chaîne qui diffuse, côté TV).
- **iptv-org/api** + **database** : recherche de chaînes par nom/pays.
- Repos communautaires (ex. shovo127/IPTV-By-Shovo) : plus tenus par la
  communauté, qualité inégale — à sonder, jamais à faire confiance d'office.

## Phase 2 (intégration backend, hors lab)

1. Type `MatchChannel` + endpoint `GET /api/sports/match/:id/channels`
   (union des serveurs de TOUS les providers du fixture, probe compris).
2. Persistance Mongo (`MatchChannel`, cron de re-probe → `deadAt`).
3. Drawer « chaînes du match » dans `LivePlayer` (le drawer existe déjà,
   il est alimenté par les chaînes TV génériques aujourd'hui).
4. Logos de chaînes : map locale (beIN/Canal+/TNT…) depuis `meta.logo`/noms.

## Notes

- Exclu du `tsconfig` racine et de l'ESLint front (`sports-channels-lab/**`)
  : sinon `next build` sur Vercel tente de type-checker le lab → échec.
- Aucun `npm install` ici : `tsx` et les services viennent de
  `backend/node_modules` (scripts `../backend/node_modules/.bin/tsx`).
- `data/` est gitignoré.

// CHILLERS - C4 container view (current state)
// Generated 2026-09-22 by architecture-visualization:system-modeler + c4model
// Per-element confidence lives in CHILLERS-analysis-2026-09-22.md; unknowns are modelled explicitly.
// Render: structurizr-cli export -w chillers-containers.dsl -e png -o .
workspace "CHILLERS" "Streaming/OTT platform - current-state containers" {

    model {

        visitor = person "Anonymous visitor" "Browses catalog, watches content, sees AdSense ads"
        subscriber = person "Paid subscriber" "Orange Money / MTN MoMo, admin-validated"
        admin = person "Admin / operator" "Media, dead links, scraping, payment proofs"

        chillers = softwareSystem "CHILLERS platform" "OTT catalog + live TV + offline downloads" {

            web = container "CHILLERS Web" "Next.js 16 / React 19, Vercel" {
                uiPublic = container "Public UI" "Tailwind v4 + custom primitives. 76 'use client' files" "React"
                uiAdmin = container "Admin console" "22 pages, antd v6 isolated to src/app/admin/**" "React"
                routeHandlers = container "Next.js API routes" "src/app/api/* : afroland, live/proxy, requests, nextauth x2, og x2" "TypeScript"
                afrolandResolver = container "AfrolandProvider" "src/lib/providers/afroland.ts - server-side resolve + M3U8 parse of a 3rd-party OTT host. Implements NEITHER StreamingProvider NOR IFRAME_PROVIDERS" "TypeScript"
                clientAuth = container "Client auth + entitlement state" "useAuthStore persisted to localStorage: subscription.plan is browser-editable" "zustand"
                offlineStore = container "Offline library" "IndexedDB chillers_offline_db + service worker" "TypeScript"
            }

            mobile = container "CHILLERS Mobile" "Flutter, talks to https://chillers.onrender.com. CI builds Windows desktop only" "Dart"

            coreApi = container "Core API" "Express 5 on Render free tier. 20+ route mounts" {
                streaming = container "Streaming module" "Provider resolution, LRU cache, circuit breaker, request-time scraping" "TypeScript"
                downloads = container "Download module" "Byte proxy + ffmpeg spawn. No auth middleware on the router" "TypeScript"
                adminMod = container "Admin module" "Payment-proof review, global subscription kill-switch" "TypeScript"
                gateDead = container "premiumFeatureGate middleware" "IMPORTED NOWHERE - dead code" "TypeScript"
            }

            mongo = container "MongoDB" "12 Mongoose models, no migration tooling" "MongoDB"
            goSearcher = container "chillers-searcher" "Go 1.25. Orphan: absent from render.yaml" "Go"
            scrapper = container "scrapper" "Node + Playwright, cron, self-hosted VPS, no CI" "TypeScript"
        }

        tmdb = softwareSystem "TMDB" "Metadata and poster enrichment"
        upstream = softwareSystem "Upstream stream hosts" "FrenchStream, Flemmix, Otaku, Doodstream, Uqload, Vidlink, Streamtape, AfrolandTV"
        ga = softwareSystem "Google Analytics 4 + AdSense" "G-07EF63R64Y, consent mode default denied"

        visitor -> web "Browses and plays"
        subscriber -> web "Subscribes via USSD + screenshot proof"
        admin -> uiAdmin "Operates"
        admin -> adminMod "Approves payment proofs"

        uiPublic -> routeHandlers "fetch /api/*"
        routeHandlers -> coreApi "next.config.ts rewrite /api/:path* -> backendUrl"
        uiPublic -> coreApi "Authorization: Bearer <JWT read from localStorage>"
        clientAuth -> coreApi "supplies the bearer token; also supplies isPremium to the UI"
        afrolandResolver -> upstream "server-side fetch + parse"
        mobile -> coreApi "REST"

        streaming -> upstream "scrapes at request time; spawns npx tsx re-scrape on dead URL"
        streaming -> tmdb "metadata lookup"
        downloads -> upstream "axios stream + ffmpeg -i <user-supplied URL> (SSRF)"
        streaming -> mongo "cached stream URLs, DeadLink records"
        adminMod -> mongo "PaymentProof, SubscriptionPlan, AuditLog"
        coreApi -> mongo "reads / writes"
        gateDead -> streaming "would gate entitlement here IF wired (currently unimported)"

        scrapper -> mongo "nightly cron scrape writes (GitHub Action scraper.yml)"
        scrapper -> upstream "Playwright scrape"
        goSearcher -> coreApi "POST /api/requests/internal/:id/fulfill - UNAUTHENTICATED, mounted 3x"
        uiPublic -> ga "pageviews, ad impressions"

        views {
            systemLandscape landscape {
                include *
                autolayout lr
            }
            container chillers {
                include *
                autolayout lr
            }
        }
    }

    styles {
        element gateDead {
            background #f8d7da
            color #721c24
            border #d00
            strokeWidth 2
        }
        element afrolandResolver {
            background #fff3cd
            border #d00
            strokeWidth 2
        }
        element goSearcher {
            background #fff3cd
            border #856404
        }
        element mobile {
            background #fff3cd
            border #856404
        }
    }
}

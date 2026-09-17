# Microservice Go — `chillers-searcher`

Ce document détaille le fonctionnement interne, l'arborescence, le modèle de concurrence et les procédures de déploiement du microservice **`chillers-searcher`**.

---

## 1. Arborescence Standard du Projet (Go Layout)

Le microservice suit rigoureusement le **Standard Go Project Layout** :

```
chillers-searcher/
├── cmd/
│   └── server/
│       └── main.go              # Point d'entrée : config, injection des dépendances, serveur HTTP, arrêt gracieux
├── internal/
│   ├── config/
│   │   └── config.go            # Chargement et validation des variables d'environnement (.env)
│   ├── domain/
│   │   └── request.go           # Modèles de données typés (SearchQuery, StreamSource, SearchResult, JobState)
│   ├── scraper/
│   │   ├── scraper.go           # Interface unifiée 'Scraper'
│   │   ├── engine.go            # Moteur d'orchestration Fan-Out / Fan-In avec Goroutines et Channels
│   │   ├── client/
│   │   │   └── http_client.go   # Client HTTP partagé avec pool TCP et headers
│   │   └── providers/
│   │       ├── otaku.go         # Scraper Otaku FR (Animes & direct DL)
│   │       └── frenchstream.go  # Scraper FrenchStream (Films & Séries via goquery)
│   ├── handler/
│   │   ├── search_handler.go    # Handlers HTTP POST /search et GET /jobs/:id
│   │   └── health_handler.go    # Handler HTTP GET /health
│   └── notifier/
│       └── webhook.go           # Client HTTP envoyant le résultat vers le Backend Node.js
├── Dockerfile                   # Build multi-stage Docker (< 20 Mo)
├── go.mod                       # Dépendances Go et version du compilateur
└── go.sum                       # Checksums SHA-256 de sécurité
```

---

## 2. Modèle de Concurrence : Fan-Out / Fan-In

Le moteur d'exécution (`internal/scraper/engine.go`) exploite le parallélisme natif de Go :

1. **Fan-Out** : Chaque scraper compatible est instancié dans sa propre **Goroutine** légère (~2 Ko de mémoire).
2. **Context & Timeouts** : Un `context.WithTimeout(ctx, 30*time.Second)` annule automatiquement toutes les requêtes réseau si le délai maximal est atteint.
3. **Fan-In** : Les résultats sont envoyés sur un `chan []domain.StreamSource` unifié, puis agrégés sans aucun blocage.

```go
func (e *Engine) SearchAll(ctx context.Context, query domain.SearchQuery) domain.SearchResult {
    searchCtx, cancel := context.WithTimeout(ctx, e.timeout)
    defer cancel()

    resultsChan := make(chan []domain.StreamSource, len(activeScrapers))
    var wg sync.WaitGroup

    for _, sc := range activeScrapers {
        wg.Add(1)
        go func(s Scraper) {
            defer wg.Done()
            sources, err := s.Search(searchCtx, query)
            if err == nil && len(sources) > 0 {
                resultsChan <- sources
            }
        }(sc)
    }

    go func() {
        wg.Wait()
        close(resultsChan)
    }()

    // Agrégation des résultats
    ...
}
```

---

## 3. Ajouter un Nouveau Scraper / Provider

Pour ajouter une nouvelle source (ex: *Wiflix*, *Darkiworld*), il suffit d'implémenter l'interface `Scraper` définie dans `internal/scraper/scraper.go` :

```go
type Scraper interface {
    Name() string
    Supports(mediaType domain.MediaType) bool
    Search(ctx context.Context, query domain.SearchQuery) ([]domain.StreamSource, error)
}
```

1. Créer le fichier `internal/scraper/providers/mon_scraper.go`.
2. Implémenter les méthodes `Name()`, `Supports()` et `Search()`.
3. L'enregistrer dans `cmd/server/main.go` lors de la création du `Engine` :
   ```go
   engine := scraper.NewEngine(cfg.DefaultTimeout,
       providers.NewOtakuScraper(),
       providers.NewFrenchStreamScraper(),
       providers.NewMonScraper(), // <-- Nouveau scraper
   )
   ```

---

## 4. Variables d'Environnement

| Variable | Description | Valeur par défaut |
| :--- | :--- | :--- |
| `PORT` | Port d'écoute du microservice | `8095` |
| `BACKEND_URL` | URL de base du backend Node.js pour les callbacks | `http://localhost:4000` |
| `SEARCH_TIMEOUT_SECONDS` | Délai d'expiration maximal de recherche | `30` |
| `MAX_CONCURRENT_WORKERS` | Nombre maximal de requêtes parallèles | `10` |

---

## 5. Compilation et Exécution

### En local :
```bash
cd chillers-searcher

# Compiler le binaire
go build -o searcher ./cmd/server

# Lancer le service
./searcher
```

### Avec Docker :
```bash
cd chillers-searcher

# Construire l'image
docker build -t chillers-searcher .

# Lancer le conteneur
docker run -d -p 8095:8095 --name chillers-searcher chillers-searcher
```

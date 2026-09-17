# Documentation CHILLERS Platform & Go Searcher

Bienvenue dans la documentation technique du projet **CHILLERS**.

---

## 📚 Sommaire de la Documentation

1. [**Architecture Globale (`ARCHITECTURE.md`)**](./ARCHITECTURE.md) :
   - Vue d'ensemble des composants (Next.js, Node.js Express, MongoDB, Microservice Go).
   - Diagramme de séquence du flux complet d'une demande de contenu.
   - Interactions inter-services.

2. [**Microservice Go `chillers-searcher` (`GO_MICROSERVICE.md`)**](./GO_MICROSERVICE.md) :
   - Structure standard idiomatic Go (`cmd/`, `internal/`).
   - Modèle de concurrence **Fan-Out / Fan-In** avec Goroutines et Channels.
   - Guide pour ajouter de nouveaux scrapers / providers.
   - Procédures de compilation et de déploiement Docker multi-stage.

3. [**Module de Demandes de Contenus (`CONTENT_REQUESTS.md`)**](./CONTENT_REQUESTS.md) :
   - Interface utilisateur (`RequestModal`, `RequestButton` avec contrainte de `border-radius: 2px`).
   - Schéma du modèle MongoDB `MediaRequest`.
   - Cycle de vie, traitement asynchrone et auto-injection des flux streaming.
   - Dashboard Administrateur sur `/admin/requests`.

4. [**Référence des API (`API_REFERENCE.md`)**](./API_REFERENCE.md) :
   - Spécification détaillée des endpoints HTTP du backend Node.js (`:4000`) et du microservice Go (`:8095`).
   - Schémas JSON de requêtes, réponses et codes de statut.

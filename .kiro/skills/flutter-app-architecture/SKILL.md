---
name: flutter-app-architecture
description: "Use when scaffolding a project, refactoring into layers, creating view models/repositories, configuring dependency injection, or implementing unidirectional data flow (MVVM)."
license: MIT
---

# Flutter App Architecture Skill
Architecture en couches, MVVM, repositories, services, injection de dépendances.

## Structure en couches
```
┌──────────────────────────────────────────┐
│  UI Layer     │  Views + ViewModels       │
├──────────────────────────────────────────┤
│  Logic Layer  │  Use Cases (optionnel)    │
├──────────────────────────────────────────┤
│  Data Layer   │  Repositories + Services  │
└──────────────────────────────────────────┘
```

**Règles :**
- Seules les couches adjacentes communiquent. L'UI ne touche jamais un Service directement.
- Les changements de données se font uniquement dans la Data layer (SSOT = Repository).
- Data flow unidirectionnel : état descend (Data → UI), événements montent (UI → Data).

## ViewModel
```dart
class MediaViewModel extends ChangeNotifier {
  final MediaRepository _repo;
  MediaViewModel(this._repo);

  List<MediaItem> _items = [];
  List<MediaItem> get items => List.unmodifiable(_items);
  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<void> load() async {
    _isLoading = true;
    notifyListeners();
    _items = await _repo.getItems();
    _isLoading = false;
    notifyListeners();
  }
}
```

## Repository (Single Source of Truth)
```dart
class MediaRepository {
  final ApiService _api;
  final StorageService _local;

  Future<List<MediaItem>> getItems() async {
    try {
      final remote = await _api.fetchItems();
      await _local.cache(remote);
      return remote;
    } catch (_) {
      return _local.getCached();
    }
  }
}
```

## Service
- Wraps les endpoints API
- Isole le chargement de données
- Ne maintient aucun état

## Data Storage
- `shared_preferences` → config, préférences
- `sqflite` / `drift` → données relationnelles complexes
- Offline-first : combiner sources locales et distantes dans les Repositories
- Optimistic updates pour une meilleure réactivité perçue

## Conventions
- `StatelessWidget` quand possible
- `final` pour les champs et variables top-level
- `const` constructors autant que possible
- Typage explicite sur les APIs publiques

## Source
- [Flutter app architecture guide](https://docs.flutter.dev/app-architecture/guide)
- [evanca/flutter-ai-rules](https://github.com/evanca/flutter-ai-rules) — MIT

---
name: flutter-dev
description: "Flutter cross-platform development guide covering widget patterns, state management, navigation, performance optimization, and platform-specific implementations. Use when building Flutter apps, creating custom widgets, optimizing performance, or doing cross-platform development."
license: MIT
metadata:
  version: "1.0.0"
  category: mobile
  sources:
    - MiniMax-AI/skills flutter-dev — MIT
    - Flutter Documentation
---

# Flutter Development Guide
Guide pratique pour construire des apps cross-platform avec Flutter 3 et Dart.

## Quick Reference

### Widget Patterns
| Objectif | Widget |
|----------|--------|
| Listes longues | `ListView.builder` |
| Scroll complexe | `CustomScrollView` + Slivers |
| Layout responsive | `LayoutBuilder` + breakpoints |
| Formulaires | `Form` + `TextFormField` + validation |
| Navigation | `Navigator.push` / `GoRouter` |

### Performance Patterns
| Problème | Solution |
|----------|----------|
| Rebuilds inutiles | `const` constructors |
| Repaint isolé | `RepaintBoundary` |
| Listes paresseuses | `ListView.builder` |
| Calcul lourd | `compute()` isolate |
| Images réseau | `cached_network_image` + `memCacheWidth` |

## Principes Core

### Widget Optimization
- `const` constructors partout où possible
- Extraire les widgets statiques en classes `const` séparées
- `Key` sur les items de liste (`ValueKey`, `ObjectKey`)
- `RepaintBoundary` autour des zones animées

### Layout
- Incréments de 8px (8, 16, 24, 32, 48)
- Breakpoints : mobile (<650), tablet (650-1100), desktop (>1100)
- Toujours tester les layouts sur plusieurs tailles d'écran

### Performance
- Profiler avec DevTools avant d'optimiser
- Cible : <16ms par frame pour 60fps
- `compute()` pour le parsing JSON lourd ou traitement d'images
- Ne jamais faire d'appels réseau dans `build()`

### State Management (sans Riverpod/Bloc)
- `setState` pour l'état local simple
- `ChangeNotifier` + `Provider` pour l'état partagé
- `ValueNotifier` pour les valeurs atomiques
- Éviter `setState` dans le widget parent pour un changement local

## Checklist
- [ ] `const` constructors sur tous les widgets statiques
- [ ] `Key` sur les items de liste
- [ ] Pas de widget building dans `build()`
- [ ] Widgets réutilisables dans des fichiers séparés
- [ ] État immutable
- [ ] `dispose()` des controllers et subscriptions
- [ ] Gestion des états loading/error
- [ ] Images cachées et redimensionnées
- [ ] Calcul lourd dans des isolates
- [ ] Test en mode profile (`flutter run --profile`)

## Source
- [MiniMax-AI/skills](https://github.com/MiniMax-AI/skills) — MIT
- [Flutter Documentation](https://docs.flutter.dev)

---
name: flutter-errors
description: "Use when hitting layout errors (RenderFlex overflow, unbounded constraints, RenderBox not laid out), scroll errors, or setState-during-build errors."
license: MIT
---

# Flutter Errors Skill
Solutions pour les erreurs Flutter les plus courantes.

## RenderFlex Overflowed
**Erreur :** `A RenderFlex overflowed by X pixels on the right/bottom.`
**Fix :** Wrapper l'enfant dans `Flexible` ou `Expanded` :
```dart
Row(
  children: [
    Expanded(child: Text('Long text that might overflow')),
    Icon(Icons.info),
  ],
)
```

## Vertical Viewport Given Unbounded Height
**Erreur :** `Vertical viewport was given unbounded height.`
**Fix :** Wrapper le `ListView` dans `Expanded` :
```dart
Column(
  children: [
    Text('Header'),
    Expanded(child: ListView(children: [...])),
  ],
)
```

## InputDecorator Cannot Have Unbounded Width
**Erreur :** `An InputDecorator...cannot have an unbounded width.`
**Fix :** Wrapper dans `Expanded` ou `SizedBox` avec une largeur définie.

## setState Called During Build
**Erreur :** `setState() or markNeedsBuild() called during build.`
**Fix :** Utiliser `addPostFrameCallback` :
```dart
WidgetsBinding.instance.addPostFrameCallback((_) {
  setState(() { ... });
});
```

## ScrollController Attached to Multiple Scroll Views
**Fix :** Chaque scrollable a sa propre instance de `ScrollController`.

## RenderBox Was Not Laid Out
**Fix :** Vérifier les contraintes manquantes — wrapper `ListView` dans `Expanded` dans une `Column`.

## Debugging
- Flutter Inspector dans DevTools pour visualiser les contraintes
- `debugPaintSizeEnabled = true` dans `main()` pour voir les bounds
- [Docs Flutter constraints](https://docs.flutter.dev/ui/layout/constraints)

## Source
- [evanca/flutter-ai-rules](https://github.com/evanca/flutter-ai-rules) — MIT

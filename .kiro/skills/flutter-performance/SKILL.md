---
name: flutter-performance
description: Optimisation de performance Flutter : lazy loading, KeepAlive tabs, images, listes, build context. À utiliser pour analyser ou corriger des problèmes de lenteur dans l'app Chillers Flutter.
---

# Flutter Performance — Guide Chillers

## Règles fondamentales

### 1. Ne jamais faire N appels API simultanés au lancement
- **MAUVAIS** : `Future.wait([call1, call2, ..., call24])` dans `initState`
- **BON** : Charger d'abord les sections critiques (hero, trending), puis les autres en lazy au scroll
- Utiliser des vagues : wave1 = critique (2-3 calls), wave2 = visible (5-6 calls), wave3 = lazy au scroll

### 2. KeepAlive sur les tabs de navigation
- Tout écran dans un `IndexedStack` ou `PageView` de navigation doit implémenter `AutomaticKeepAliveClientMixin`
- Sans ça, chaque switch de tab reconstruit l'écran depuis zéro
```dart
class _HomeScreenState extends State<HomeScreen> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;
  
  @override
  Widget build(BuildContext context) {
    super.build(context); // OBLIGATOIRE avec KeepAlive
    return ...;
  }
}
```

### 3. IndexedStack pour la navigation
- Utiliser `IndexedStack` au lieu de recréer les widgets à chaque tab switch
```dart
body: IndexedStack(
  index: _currentIndex,
  children: _screens,
),
```

### 4. Images réseau — toujours CachedNetworkImage
- Toujours utiliser `cached_network_image` avec `memCacheWidth`/`memCacheHeight`
- Limiter la résolution en mémoire aux dimensions d'affichage réelles
```dart
CachedNetworkImage(
  imageUrl: url,
  memCacheWidth: 200,  // px réels affichés
  memCacheHeight: 300,
  fadeInDuration: Duration(milliseconds: 150),
  placeholder: (ctx, url) => shimmerWidget,
)
```

### 5. Listes longues — toujours ListView.builder
- Jamais `Column(children: items.map(...).toList())` pour plus de 10 items
- Toujours `ListView.builder` ou `SliverList` pour du lazy rendering

### 6. const constructors partout
- Tout widget statique doit avoir `const` : `const SizedBox`, `const Text`, `const Icon`
- Évite les rebuilds inutiles

### 7. RepaintBoundary sur les zones animées
- Wrapper les animations (carousel, shimmer) dans `RepaintBoundary`
- Isole la zone de repaint pour ne pas repeindre tout l'écran

### 8. main.dart — flags de performance
```dart
void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Activer Impeller sur Android (renderer GPU)
  // Déjà activé par défaut sur iOS
  runApp(const ChillersApp());
}
```

### 9. Éviter setState global
- Ne jamais appeler `setState` sur le widget parent pour un changement local
- Utiliser des widgets enfants avec leur propre state ou ValueNotifier

### 10. Shimmer au lieu de spinner
- Un shimmer (squelette gris animé) donne l'impression de chargement rapide
- Un spinner bloque visuellement l'utilisateur

## Patterns Chillers spécifiques

### Lazy loading home en vagues
```dart
Future<void> _loadAllHomeData() async {
  // Wave 1 : critique, affiché immédiatement
  await _loadWave1(); // hero + trending
  if (mounted) setState(() {});
  
  // Wave 2 : sections visibles sans scroll
  _loadWave2(); // matches + popular (pas await)
  
  // Wave 3 : lazy au scroll (ne pas charger au démarrage)
  // _barbieMovies, _madeInChina, etc. → chargés quand l'utilisateur scrolle
}
```

### ScrollController pour déclencher le lazy loading
```dart
void _onMainScroll() {
  final pos = _mainScrollController.position;
  // Charger wave3 seulement quand l'user a scrollé 60% de la page
  if (pos.pixels > pos.maxScrollExtent * 0.6 && !_wave3Loaded) {
    _wave3Loaded = true;
    _loadWave3();
  }
}
```

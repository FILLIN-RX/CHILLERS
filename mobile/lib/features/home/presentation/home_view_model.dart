import 'package:flutter/foundation.dart';
import '../../../core/models/media_item.dart';
import '../../live/domain/live_match.dart';
import '../data/home_repository.dart';

/// ViewModel pour la page d'accueil.
/// Contient toute la logique métier extraite de HomeScreen (1314 lignes → ~250 lignes UI).
///
/// Utilisation dans le widget :
/// ```dart
/// ChangeNotifierProvider(
///   create: (_) => HomeViewModel()..load(),
///   child: Consumer<HomeViewModel>(
///     builder: (ctx, vm, _) => HomeScreen(viewModel: vm),
///   ),
/// )
/// ```
class HomeViewModel extends ChangeNotifier {
  HomeViewModel() : _repo = HomeRepository();

  final HomeRepository _repo;

  // ── État ──────────────────────────────────────────────────────────────────

  bool isLoading = true;
  bool isLoadingMoreFeed = false;
  bool hasMoreFeed = true;
  int _feedPage = 1;

  // Sections home (ancien : 25 variables dans HomeScreen)
  List<Map<String, dynamic>> continueWatching = [];
  List<LiveMatch> liveMatches = [];
  List<MediaItem> heroSlides = [];
  List<MediaItem> trendingAll = [];
  List<MediaItem> newReleases = [];
  List<MediaItem> upcomingMovies = [];
  List<MediaItem> top10Items = [];
  List<MediaItem> popularSeries = [];
  List<MediaItem> animeCollection = [];
  List<MediaItem> infiniteFeedItems = [];

  // Wave 3 — sections profondes
  List<MediaItem> tvForYou = [];
  List<MediaItem> allTimeFavorites = [];
  List<MediaItem> boxOffice = [];
  List<MediaItem> newAnime = [];
  List<MediaItem> martialArts = [];
  List<MediaItem> realityShows = [];
  List<MediaItem> barbieMovies = [];
  List<MediaItem> actionMovies = [];
  List<MediaItem> comedyMovies = [];
  List<MediaItem> actionSeries = [];
  List<MediaItem> africanMovies = [];
  List<MediaItem> africanSeries = [];
  List<MediaItem> saDrama = [];
  List<MediaItem> madeInChina = [];
  List<MediaItem> animationSeries = [];

  String selectedMatchLeague = 'all';

  // ── Chargement ────────────────────────────────────────────────────────────

  Future<void> load() async {
    isLoading = true;
    _feedPage = 1;
    hasMoreFeed = true;
    notifyListeners();

    // Wave 1 : critique — hero visible immédiatement
    final w1 = await _repo.loadWave1();
    continueWatching = w1.continueWatching;
    newReleases = w1.popularMovies;
    popularSeries = w1.popularSeries;
    heroSlides = [...w1.popularMovies.take(5), ...w1.popularSeries.take(4)].take(10).toList();
    trendingAll = w1.popularMovies;
    infiniteFeedItems = w1.popularMovies;
    hasMoreFeed = w1.popularMovies.isNotEmpty;
    isLoading = false;
    notifyListeners();

    // Wave 2 : secondaire — sans bloquer le UI
    final w2 = await _repo.loadWave2();
    liveMatches = w2.matches;
    animeCollection = w2.animes;
    newAnime = w2.animes;
    upcomingMovies = w2.upcoming.isNotEmpty ? w2.upcoming : w1.popularMovies.take(8).toList();

    // Trending combiné films + séries
    final trendAll = <MediaItem>[];
    final maxLen = w2.trendingMovies.length > w2.trendingSeries.length
        ? w2.trendingMovies.length : w2.trendingSeries.length;
    for (int i = 0; i < maxLen; i++) {
      if (i < w2.trendingMovies.length) trendAll.add(w2.trendingMovies[i]);
      if (i < w2.trendingSeries.length) trendAll.add(w2.trendingSeries[i]);
    }
    trendingAll = trendAll.isNotEmpty ? trendAll : w1.popularMovies;
    top10Items = trendingAll.take(10).toList();

    // Hero enrichi
    final mSlice = w1.popularMovies.take(5).toList();
    final sSlice = w1.popularSeries.take(4).toList();
    final aSlice = w2.animes.take(3).toList();
    final heroList = <MediaItem>[];
    final maxHero = [mSlice.length, sSlice.length, aSlice.length].reduce((a, b) => a > b ? a : b);
    for (int i = 0; i < maxHero; i++) {
      if (i < mSlice.length) heroList.add(mSlice[i]);
      if (i < sSlice.length) heroList.add(sSlice[i]);
      if (i < aSlice.length) heroList.add(aSlice[i]);
    }
    heroSlides = heroList.isNotEmpty ? heroList.take(10).toList() : trendingAll.take(7).toList();
    notifyListeners();

    // Wave 3 : arrière-plan — sections profondes
    _loadWave3(w1.popularMovies, w1.popularSeries, w2.trendingMovies);
  }

  Future<void> _loadWave3(
    List<MediaItem> popM,
    List<MediaItem> popTV,
    List<MediaItem> trendM,
  ) async {
    final w3 = await _repo.loadWave3();

    tvForYou = _orFallback(w3['tvForYou'], popTV);
    allTimeFavorites = _orFallback(w3['allTimeFavorites'], trendM);
    boxOffice = _orFallback(w3['boxOffice'], popM);
    martialArts = _orFallback(w3['martialArts'], w3['actionMovies'] ?? []);
    realityShows = _orFallback(w3['realityShows'], popTV);
    barbieMovies = _orFallback(w3['barbieMovies'], w3['comedyMovies'] ?? []);
    actionMovies = w3['actionMovies'] ?? [];
    comedyMovies = w3['comedyMovies'] ?? [];
    actionSeries = w3['actionSeries'] ?? [];
    africanMovies = w3['africanMovies'] ?? [];
    africanSeries = w3['africanSeries'] ?? [];
    saDrama = w3['saDrama'] ?? [];
    madeInChina = w3['madeInChina'] ?? [];
    if ((w3['newAnime'] ?? []).isNotEmpty) newAnime = w3['newAnime']!;
    animationSeries = w3['animationSeries'] ?? [];
    notifyListeners();
  }

  // ── Infinite feed ─────────────────────────────────────────────────────────

  Future<void> loadMoreFeed() async {
    if (isLoadingMoreFeed || !hasMoreFeed) return;
    isLoadingMoreFeed = true;
    notifyListeners();

    final nextPage = _feedPage + 1;
    final items = await _repo.loadMoreFeed(nextPage);

    if (items.isNotEmpty) {
      _feedPage = nextPage;
      infiniteFeedItems = [...infiniteFeedItems, ...items];
      hasMoreFeed = true;
    } else {
      hasMoreFeed = false;
    }
    isLoadingMoreFeed = false;
    notifyListeners();
  }

  // ── Filtres matchs ────────────────────────────────────────────────────────

  void setMatchLeague(String league) {
    selectedMatchLeague = league;
    notifyListeners();
  }

  // ── Helper ────────────────────────────────────────────────────────────────

  List<MediaItem> _orFallback(List<MediaItem>? items, List<MediaItem> fallback) =>
      (items != null && items.isNotEmpty) ? items : fallback;
}

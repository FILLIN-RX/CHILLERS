import '../../../core/models/media_item.dart';
import '../../../core/storage/local_storage.dart';
import '../../live/domain/live_match.dart';
import '../../live/data/live_repository.dart';
import '../../media/data/media_repository.dart';

/// Données d'une vague de chargement de la home.
class HomeWaveData {
  final List<Map<String, dynamic>> continueWatching;
  final List<MediaItem> popularMovies;
  final List<MediaItem> popularSeries;

  const HomeWaveData({
    required this.continueWatching,
    required this.popularMovies,
    required this.popularSeries,
  });
}

class HomeWave2Data {
  final List<LiveMatch> matches;
  final List<MediaItem> trendingMovies;
  final List<MediaItem> trendingSeries;
  final List<MediaItem> animes;
  final List<MediaItem> upcoming;

  const HomeWave2Data({
    required this.matches,
    required this.trendingMovies,
    required this.trendingSeries,
    required this.animes,
    required this.upcoming,
  });
}

/// Repository Home — orchestre le chargement en vagues de la page d'accueil.
/// Extrait la logique qui était dans HomeScreen._loadAllHomeData().
class HomeRepository {
  static final HomeRepository _instance = HomeRepository._internal();
  factory HomeRepository() => _instance;
  HomeRepository._internal();

  final MediaRepository _media = MediaRepository();
  final LiveRepository _live = LiveRepository();
  final LocalStorage _storage = LocalStorage();

  // ── Wave 1 : critique — affiché dès que possible (~3 appels) ─────────────

  Future<HomeWaveData> loadWave1() async {
    final results = await Future.wait([
      _storage.getJsonList('chillers_continue_watching'),
      _media.getPopularMovies(page: 1),
      _media.getPopularSeries(page: 1),
    ]);

    return HomeWaveData(
      continueWatching: results[0] as List<Map<String, dynamic>>,
      popularMovies: results[1] as List<MediaItem>,
      popularSeries: results[2] as List<MediaItem>,
    );
  }

  // ── Wave 2 : secondaire — sections visibles (~6 appels) ──────────────────

  Future<HomeWave2Data> loadWave2() async {
    final results = await Future.wait([
      _live.getMergedMatches(),
      _media.getTrendingMovies(),
      _media.getTrendingSeries(),
      _media.getAnimeSeries(page: 1),
      _media.getUpcomingMovies(page: 1),
    ]);

    return HomeWave2Data(
      matches: results[0] as List<LiveMatch>,
      trendingMovies: results[1] as List<MediaItem>,
      trendingSeries: results[2] as List<MediaItem>,
      animes: results[3] as List<MediaItem>,
      upcoming: results[4] as List<MediaItem>,
    );
  }

  // ── Wave 3 : lazy — sections profondes (~15 appels, en arrière-plan) ──────

  Future<Map<String, List<MediaItem>>> loadWave3() async {
    final results = <String, List<MediaItem>>{};

    await Future.wait([
      _media.getTVForYou(page: 2).then((v) => results['tvForYou'] = v),
      _media.getAllTimeFavorites(page: 1).then((v) => results['allTimeFavorites'] = v),
      _media.getBoxOfficeMovies(page: 1).then((v) => results['boxOffice'] = v),
      _media.getMartialArtsMovies(page: 1).then((v) => results['martialArts'] = v),
      _media.getRealityShows(page: 1).then((v) => results['realityShows'] = v),
      _media.getBarbieMovies(page: 1).then((v) => results['barbieMovies'] = v),
      _media.getActionMovies(page: 1).then((v) => results['actionMovies'] = v),
      _media.getComedyMovies(page: 1).then((v) => results['comedyMovies'] = v),
      _media.getActionSeries(page: 1).then((v) => results['actionSeries'] = v),
      _media.getAfricanMovies(page: 1).then((v) => results['africanMovies'] = v),
      _media.getAfricanSeries(page: 1).then((v) => results['africanSeries'] = v),
      _media.getSADrama(page: 1).then((v) => results['saDrama'] = v),
      _media.getMadeInChina(page: 1).then((v) => results['madeInChina'] = v),
      _media.getNewAnime(page: 1).then((v) => results['newAnime'] = v),
      _media.getAnimationSeries(page: 1).then((v) => results['animationSeries'] = v),
    ]);

    return results;
  }

  // ── Continue watching (persistance locale) ────────────────────────────────

  Future<void> saveContinueWatching(List<Map<String, dynamic>> items) =>
      _storage.saveJsonList('chillers_continue_watching', items);

  Future<List<Map<String, dynamic>>> getContinueWatching() =>
      _storage.getJsonList('chillers_continue_watching');

  // ── Infinite feed ─────────────────────────────────────────────────────────

  Future<List<MediaItem>> loadMoreFeed(int page) async {
    if (page % 3 == 0) return _media.getTopRatedMovies(page: page ~/ 3);
    if (page % 2 == 0) return _media.getPopularSeries(page: page ~/ 2);
    return _media.getPopularMovies(page: page);
  }
}

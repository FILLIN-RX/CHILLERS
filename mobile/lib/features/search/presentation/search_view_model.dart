import 'dart:async';
import 'package:flutter/foundation.dart';
import '../../../core/models/media_item.dart';
import '../data/search_repository.dart';

/// ViewModel pour la recherche avec debounce intégré.
class SearchViewModel extends ChangeNotifier {
  SearchViewModel() : _repo = SearchRepository();

  final SearchRepository _repo;

  bool isLoading = false;
  List<MediaItem> results = [];
  String query = '';
  String? errorMessage;

  Timer? _debounce;
  static const Duration _debounceDuration = Duration(milliseconds: 400);

  // ── Search ────────────────────────────────────────────────────────────────

  void onQueryChanged(String value) {
    query = value;
    errorMessage = null;

    if (value.trim().isEmpty) {
      results = [];
      isLoading = false;
      notifyListeners();
      return;
    }

    // Debounce — évite un appel réseau à chaque frappe
    _debounce?.cancel();
    _debounce = Timer(_debounceDuration, () => _performSearch(value.trim()));
  }

  Future<void> _performSearch(String q) async {
    isLoading = true;
    notifyListeners();

    final items = await _repo.search(q);
    results = items;
    isLoading = false;
    notifyListeners();
  }

  void clear() {
    _debounce?.cancel();
    query = '';
    results = [];
    isLoading = false;
    errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    super.dispose();
  }
}

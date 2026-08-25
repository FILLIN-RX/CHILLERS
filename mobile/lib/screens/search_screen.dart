import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import '../services/api_service.dart';
import 'detail_screen.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController _searchController = TextEditingController();
  final ApiService _apiService = ApiService();
  List<MediaItem> _results = [];
  bool _isLoading = false;

  void _onSearch(String query) async {
    if (query.trim().isEmpty) {
      setState(() => _results = []);
      return;
    }
    setState(() => _isLoading = true);
    final items = await _apiService.searchMedia(query);
    setState(() {
      _results = items;
      _isLoading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: TextField(
          controller: _searchController,
          autofocus: true,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: 'Rechercher un film, série, anime...',
            hintStyle: const TextStyle(color: Colors.white38),
            border: InputBorder.none,
            suffixIcon: IconButton(
              icon: const Icon(Icons.clear, color: Colors.white54),
              onPressed: () {
                _searchController.clear();
                setState(() => _results = []);
              },
            ),
          ),
          onSubmitted: _onSearch,
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _results.isEmpty
              ? const Center(
                  child: Text(
                    'Tapez un titre pour lancer la recherche',
                    style: TextStyle(color: AppTheme.textSecondary),
                  ),
                )
              : GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    childAspectRatio: 0.65,
                    crossAxisSpacing: 8,
                    mainAxisSpacing: 8,
                  ),
                  itemCount: _results.length,
                  itemBuilder: (context, index) {
                    final item = _results[index];
                    return GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => DetailScreen(item: item),
                          ),
                        );
                      },
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: item.poster != null && item.poster!.isNotEmpty
                            ? CachedNetworkImage(
                                imageUrl: item.poster!,
                                fit: BoxFit.cover,
                                placeholder: (context, url) => Container(color: AppTheme.card),
                                errorWidget: (context, url, error) => Container(
                                  color: AppTheme.card,
                                  child: const Icon(Icons.movie, color: Colors.white30),
                                ),
                              )
                            : Container(
                                color: AppTheme.card,
                                child: const Icon(Icons.movie, color: Colors.white30),
                              ),
                      ),
                    );
                  },
                ),
    );
  }
}

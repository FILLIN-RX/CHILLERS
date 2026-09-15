import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../config/theme.dart';
import '../models/media_item.dart';
import '../services/pagination_service.dart';

typedef MediaItemCallback = void Function(MediaItem);

class InfiniteMediaSection extends StatefulWidget {
  final MediaSection section;
  final String title;
  final MediaItemCallback onItemTap;
  final MediaItemCallback onDetailsTab;
  final int itemsPerPage;
  final double itemHeight;
  final double itemWidth;

  const InfiniteMediaSection({
    super.key,
    required this.section,
    required this.title,
    required this.onItemTap,
    required this.onDetailsTab,
    this.itemsPerPage = 20,
    this.itemHeight = 220,
    this.itemWidth = 130,
  });

  @override
  State<InfiniteMediaSection> createState() => _InfiniteMediaSectionState();
}

class _InfiniteMediaSectionState extends State<InfiniteMediaSection> {
  final PaginationService _paginationService = PaginationService();
  late ScrollController _scrollController;
  bool _isDisposed = false;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    _scrollController.addListener(_onScroll);
    _loadInitialData();
  }

  @override
  void dispose() {
    _isDisposed = true;
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadInitialData() async {
    try {
      await _paginationService.loadInitial(widget.section);
      if (!_isDisposed && mounted) {
        setState(() {});
      }
    } catch (e) {
      debugPrint('Error loading initial data: $e');
    }
  }

  void _onScroll() {
    if (!mounted) return;
    
    // Check if scrolled to near the end (last 200 pixels)
    if (_scrollController.position.pixels >= 
        _scrollController.position.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _loadMore() async {
    if (_isDisposed || !mounted) return;
    if (_paginationService.isLoading(widget.section)) return;
    if (!_paginationService.hasMorePages(widget.section)) return;

    try {
      await _paginationService.loadMore(widget.section);
      if (!_isDisposed && mounted) {
        setState(() {});
      }
    } catch (e) {
      debugPrint('Error loading more: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _paginationService.getCache(widget.section);
    final isLoading = _paginationService.isLoading(widget.section);
    final hasMore = _paginationService.hasMorePages(widget.section);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Section Header
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 10.0),
          child: Row(
            children: [
              Text(
                widget.title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
              const Spacer(),
              if (items.isNotEmpty)
                Text(
                  '${items.length}',
                  style: const TextStyle(
                    color: AppTheme.textSecondary,
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
            ],
          ),
        ),

        // Items Grid or Horizontal List
        SizedBox(
          height: widget.itemHeight + 50,
          child: items.isEmpty && !isLoading
              ? Center(
                  child: Text(
                    'Aucun contenu disponible',
                    style: TextStyle(color: Colors.white54),
                  ),
                )
              : ListView.builder(
                  controller: _scrollController,
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: items.length + (hasMore && isLoading ? 1 : 0),
                  itemBuilder: (context, index) {
                    // Show loading indicator at the end
                    if (index == items.length) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: Center(
                          child: SizedBox(
                            width: 40,
                            height: 40,
                            child: CircularProgressIndicator(
                              color: AppTheme.primary,
                              strokeWidth: 2,
                            ),
                          ),
                        ),
                      );
                    }

                    final item = items[index];
                    return _buildMediaCard(item);
                  },
                ),
        ),
      ],
    );
  }

  Widget _buildMediaCard(MediaItem item) {
    return GestureDetector(
      onTap: () => widget.onDetailsTab(item),
      child: Container(
        width: widget.itemWidth,
        margin: const EdgeInsets.symmetric(horizontal: 4),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Poster Image
            ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: item.poster != null && item.poster!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: item.poster!,
                      height: widget.itemHeight - 50,
                      width: widget.itemWidth,
                      fit: BoxFit.cover,
                      placeholder: (context, url) => Container(
                        color: AppTheme.card,
                        child: const Center(
                          child: CircularProgressIndicator(
                            color: AppTheme.primary,
                            strokeWidth: 2,
                          ),
                        ),
                      ),
                      errorWidget: (context, url, error) => Container(
                        color: AppTheme.card,
                        child: const Icon(
                          Icons.movie,
                          color: Colors.white30,
                          size: 40,
                        ),
                      ),
                    )
                  : Container(
                      height: widget.itemHeight - 50,
                      width: widget.itemWidth,
                      color: AppTheme.card,
                      child: const Icon(
                        Icons.movie,
                        color: Colors.white30,
                        size: 40,
                      ),
                    ),
            ),
            const SizedBox(height: 6),

            // Title
            Expanded(
              child: Text(
                item.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
            ),

            // Rating if available
            if (item.rating != null && item.rating!.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 2),
                child: Row(
                  children: [
                    const Icon(Icons.star, color: Colors.amber, size: 12),
                    const SizedBox(width: 2),
                    Text(
                      item.rating!,
                      style: const TextStyle(
                        color: Colors.amber,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

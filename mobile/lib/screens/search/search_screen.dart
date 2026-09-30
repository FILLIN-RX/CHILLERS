import 'package:flutter/material.dart';
import 'optimized_search_screen.dart';

class SearchScreen extends StatelessWidget {
  final String? initialQuery;

  const SearchScreen({super.key, this.initialQuery});

  @override
  Widget build(BuildContext context) {
    return OptimizedSearchScreen(initialQuery: initialQuery);
  }
}

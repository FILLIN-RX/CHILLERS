import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../services/download_service.dart';
import '../../config/theme.dart';

/// Animated in-app notification displayed at the top of the screen
/// when a download completes successfully.
///
/// Style: slide from top, 2px border-radius max per product spec,
/// auto-dismiss after 4 seconds.
class DownloadSuccessOverlay extends StatefulWidget {
  final DownloadTask task;
  final VoidCallback? onTap;
  final VoidCallback? onDismiss;

  const DownloadSuccessOverlay({
    super.key,
    required this.task,
    this.onTap,
    this.onDismiss,
  });

  @override
  State<DownloadSuccessOverlay> createState() => _DownloadSuccessOverlayState();
}

class _DownloadSuccessOverlayState extends State<DownloadSuccessOverlay>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<Offset> _slideAnim;
  late final Animation<double> _fadeAnim;
  late final Animation<double> _progressAnim;

  static const Duration _dismissAfter = Duration(seconds: 4);

  @override
  void initState() {
    super.initState();

    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );

    _slideAnim = Tween<Offset>(
      begin: const Offset(0, -1.2),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic));

    _fadeAnim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOut);

    _progressAnim = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(
        parent: AnimationController(vsync: this, duration: _dismissAfter)
          ..forward(),
        curve: Curves.linear,
      ),
    );

    _ctrl.forward();

    // Auto-dismiss
    Future.delayed(_dismissAfter, () {
      if (mounted) _dismiss();
    });
  }

  void _dismiss() {
    _ctrl.reverse().then((_) {
      if (mounted) widget.onDismiss?.call();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final task = widget.task;
    final subtitle = task.episodeNumber != null
        ? 'S${(task.seasonNumber ?? '1').padLeft(2, '0')}E${task.episodeNumber!.padLeft(2, '0')}'
        : null;

    return SlideTransition(
      position: _slideAnim,
      child: FadeTransition(
        opacity: _fadeAnim,
        child: GestureDetector(
          onTap: () {
            _dismiss();
            widget.onTap?.call();
          },
          child: Container(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              // Sharp corners — max border-radius: 2px per product spec
              borderRadius: BorderRadius.circular(2),
              gradient: const LinearGradient(
                colors: [Color(0xFF111111), Color(0xFF1C1C1E)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.10),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.65),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(2),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // ── Body ──────────────────────────────────────────────────
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 10, 8, 10),
                    child: Row(
                      children: [
                        // Poster thumbnail
                        if (task.poster != null && task.poster!.isNotEmpty)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(2),
                            child: CachedNetworkImage(
                              imageUrl: task.poster!,
                              width: 42,
                              height: 58,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) => _PosterPlaceholder(),
                            ),
                          )
                        else
                          _PosterPlaceholder(),
                        const SizedBox(width: 12),

                        // Text
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Label
                              Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF10B981)
                                          .withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(2),
                                      border: Border.all(
                                        color: const Color(0xFF10B981)
                                            .withValues(alpha: 0.30),
                                        width: 0.8,
                                      ),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.check_circle_rounded,
                                          color: Color(0xFF10B981),
                                          size: 11,
                                        ),
                                        SizedBox(width: 4),
                                        Text(
                                          'TÉLÉCHARGÉ',
                                          style: TextStyle(
                                            color: Color(0xFF10B981),
                                            fontSize: 9,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.8,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 5),
                              // Title
                              Text(
                                task.title,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  height: 1.2,
                                ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                              if (subtitle != null) ...[
                                const SizedBox(height: 2),
                                Text(
                                  subtitle,
                                  style: const TextStyle(
                                    color: Colors.white54,
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),

                        // Arrow action
                        const SizedBox(width: 8),
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(2),
                          ),
                          child: const Icon(
                            Icons.arrow_forward_rounded,
                            color: AppTheme.primary,
                            size: 16,
                          ),
                        ),

                        // Close
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: _dismiss,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            child: const Icon(
                              Icons.close_rounded,
                              color: Colors.white38,
                              size: 16,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // ── Progress bar (auto-dismiss timer) ─────────────────────
                  AnimatedBuilder(
                    animation: _progressAnim,
                    builder: (_, __) => LinearProgressIndicator(
                      value: _progressAnim.value,
                      minHeight: 2,
                      backgroundColor: Colors.white.withValues(alpha: 0.06),
                      valueColor: const AlwaysStoppedAnimation<Color>(
                          Color(0xFF10B981)),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------

class _PosterPlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: 42,
      height: 58,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(2),
      ),
      child: const Icon(Icons.movie_rounded, color: Colors.white24, size: 20),
    );
  }
}

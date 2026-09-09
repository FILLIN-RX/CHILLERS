import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../config/theme.dart';
import '../main.dart';

class AppVideoPlayer extends StatefulWidget {
  final String videoUrl;
  final String title;
  final String? subtitle;
  final bool autoPlay;
  final bool isFullScreen;
  final VoidCallback? onNextEpisode;
  final VoidCallback? onPrevEpisode;
  final bool hasNextEpisode;
  final bool hasPrevEpisode;

  const AppVideoPlayer({
    super.key,
    required this.videoUrl,
    required this.title,
    this.subtitle,
    this.autoPlay = true,
    this.isFullScreen = false,
    this.onNextEpisode,
    this.onPrevEpisode,
    this.hasNextEpisode = false,
    this.hasPrevEpisode = false,
  });

  @override
  State<AppVideoPlayer> createState() => _AppVideoPlayerState();
}

class _AppVideoPlayerState extends State<AppVideoPlayer> {
  // MediaKit engine
  Player? _mediaKitPlayer;
  VideoController? _mediaKitController;

  // VideoPlayer / Chewie fallback engine
  VideoPlayerController? _videoPlayerController;
  ChewieController? _chewieController;

  // WebView engine for embeds (Android / iOS)
  WebViewController? _webViewController;

  bool _isEmbed = false;
  bool _useMediaKit = false;
  bool _isLoading = true;
  String? _errorMessage;

  bool get _isPlatformWebViewSupported {
    if (kIsWeb) return false;
    try {
      return Platform.isAndroid || Platform.isIOS || Platform.isMacOS;
    } catch (_) {
      return false;
    }
  }

  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }

  @override
  void didUpdateWidget(covariant AppVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoUrl != widget.videoUrl) {
      _initializePlayer();
    }
  }

  bool _detectIsEmbed(String url) {
    final lower = url.toLowerCase();
    if (lower.endsWith('.mp4') ||
        lower.endsWith('.m3u8') ||
        lower.endsWith('.mkv') ||
        lower.endsWith('.ts') ||
        lower.endsWith('.webm') ||
        lower.contains('/api/stream') ||
        lower.contains('/api/doodstream/stream') ||
        lower.contains('/api/omnisave/proxy') ||
        lower.contains('playlist.m3u8')) {
      return false;
    }
    if (lower.contains('vidlink.pro') ||
        lower.contains('vidsrc') ||
        lower.contains('/embed') ||
        lower.contains('dood') ||
        lower.contains('uqload') ||
        lower.contains('animekai') ||
        lower.contains('youtube.com') ||
        lower.contains('youtu.be')) {
      return true;
    }
    return false;
  }

  Future<void> _initializePlayer() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    _disposeAllControllers();

    final isEmbedUrl = _detectIsEmbed(widget.videoUrl);
    _isEmbed = isEmbedUrl;

    if (isEmbedUrl && _isPlatformWebViewSupported) {
      // 1. WEBVIEW EMBED ENGINE (Sur Android & iOS)
      try {
        final controller = WebViewController()
          ..setJavaScriptMode(JavaScriptMode.unrestricted)
          ..setBackgroundColor(Colors.black)
          ..setNavigationDelegate(
            NavigationDelegate(
              onPageStarted: (_) {
                if (mounted) setState(() => _isLoading = true);
              },
              onPageFinished: (_) {
                if (mounted) setState(() => _isLoading = false);
              },
              onWebResourceError: (error) {
                if (mounted) {
                  setState(() {
                    _isLoading = false;
                    _errorMessage = error.description;
                  });
                }
              },
            ),
          )
          ..loadRequest(Uri.parse(widget.videoUrl));

        if (mounted) {
          setState(() {
            _webViewController = controller;
            _isLoading = false;
          });
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _isLoading = false;
            _errorMessage = 'Erreur initialisation WebView : $e';
          });
        }
      }
    } else if (!isEmbedUrl && hasMediaKitSupport) {
      // 2. MEDIAKIT ENGINE (Android / iOS / Linux avec libmpv)
      try {
        _useMediaKit = true;
        final player = Player();
        final controller = VideoController(player);

        _mediaKitPlayer = player;
        _mediaKitController = controller;

        await player.open(
          Media(widget.videoUrl),
          play: widget.autoPlay,
        );

        if (mounted) {
          setState(() => _isLoading = false);
        }
      } catch (e) {
        debugPrint('[AppVideoPlayer] MediaKit échec, tentative fallback video_player: $e');
        _initFallbackVideoPlayer();
      }
    } else if (!isEmbedUrl) {
      // 3. CHEWIE / VIDEO_PLAYER FALLBACK (Direct streams)
      _initFallbackVideoPlayer();
    } else {
      // 4. EMBED SUR LINUX DESKTOP (Pas de webview natif Linux)
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _initFallbackVideoPlayer() async {
    _useMediaKit = false;
    try {
      final uri = Uri.parse(widget.videoUrl);
      _videoPlayerController = VideoPlayerController.networkUrl(uri);
      await _videoPlayerController!.initialize();

      _chewieController = ChewieController(
        videoPlayerController: _videoPlayerController!,
        autoPlay: widget.autoPlay,
        looping: false,
        aspectRatio: _videoPlayerController!.value.aspectRatio > 0
            ? _videoPlayerController!.value.aspectRatio
            : 16 / 9,
        materialProgressColors: ChewieProgressColors(
          playedColor: AppTheme.primary,
          handleColor: AppTheme.primary,
          backgroundColor: Colors.white24,
          bufferedColor: Colors.white38,
        ),
        playbackSpeeds: const [0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
        allowFullScreen: true,
        allowMuting: true,
        showControls: true,
      );

      if (mounted) {
        setState(() => _isLoading = false);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Impossible de charger le flux vidéo : $e';
        });
      }
    }
  }

  void _disposeAllControllers() {
    _mediaKitPlayer?.dispose();
    _mediaKitPlayer = null;
    _mediaKitController = null;

    _chewieController?.dispose();
    _chewieController = null;
    _videoPlayerController?.dispose();
    _videoPlayerController = null;

    _webViewController = null;
  }

  @override
  void dispose() {
    _disposeAllControllers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Container(
        color: Colors.black,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(color: AppTheme.primary),
              const SizedBox(height: 14),
              Text(
                _isEmbed ? 'Chargement du lecteur web...' : 'Initialisation du lecteur vidéo...',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }

    if (_errorMessage != null) {
      return Container(
        color: Colors.black,
        padding: const EdgeInsets.all(20),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off_rounded, color: Colors.redAccent, size: 48),
            const SizedBox(height: 12),
            const Text(
              'Erreur de lecture',
              style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 6),
            Text(
              _errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
              ),
              onPressed: _initializePlayer,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Réessayer'),
            ),
          ],
        ),
      );
    }

    // A. Affichage Embed (Android / iOS avec WebView)
    if (_isEmbed && _webViewController != null) {
      return Container(
        color: Colors.black,
        child: WebViewWidget(controller: _webViewController!),
      );
    }

    // B. Affichage Embed sur Linux Desktop (Informations & Compatibilité)
    if (_isEmbed && !_isPlatformWebViewSupported) {
      return Container(
        color: const Color(0xFF0F0F12),
        padding: const EdgeInsets.all(24),
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppTheme.primary.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.phone_android_rounded, color: AppTheme.primary, size: 40),
            ),
            const SizedBox(height: 16),
            Text(
              widget.title,
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            if (widget.subtitle != null) ...[
              const SizedBox(height: 4),
              Text(
                widget.subtitle!,
                style: const TextStyle(color: AppTheme.primary, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ],
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white12),
              ),
              child: const Text(
                'Source Web Embed (VidLink / FrenchStream)\nOpérationnel nativement sur mobile Android & iOS via WebView.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
              ),
            ),
          ],
        ),
      );
    }

    // C. Affichage MediaKit
    if (_useMediaKit && _mediaKitController != null) {
      return Container(
        color: Colors.black,
        child: Video(
          controller: _mediaKitController!,
          controls: MaterialVideoControls,
        ),
      );
    }

    // D. Affichage Fallback Chewie
    if (_chewieController != null) {
      return Container(
        color: Colors.black,
        child: Chewie(controller: _chewieController!),
      );
    }

    return const SizedBox.shrink();
  }
}

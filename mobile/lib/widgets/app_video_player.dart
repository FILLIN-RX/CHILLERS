import 'dart:async';
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
  final bool isLive;
  final bool isFullScreen;
  final Duration? initialPosition;
  final void Function(Duration position, Duration duration)? onProgress;
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
    this.isLive = false,
    this.isFullScreen = false,
    this.initialPosition,
    this.onProgress,
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
  StreamSubscription? _mediaKitPositionSub;
  StreamSubscription? _mediaKitDurationSub;
  StreamSubscription? _mediaKitErrorSub;
  StreamSubscription? _mediaKitBufferingSub;
  Duration _currentMediaKitDuration = Duration.zero;

  // VideoPlayer / Chewie fallback engine
  VideoPlayerController? _videoPlayerController;
  ChewieController? _chewieController;

  // WebView engine for embeds (Android / iOS)
  WebViewController? _webViewController;

  bool _isEmbed = false;
  bool _useMediaKit = false;
  bool _isLoading = true;
  bool _isBuffering = false;
  String? _errorMessage;
  bool _hasSeekedInitial = false;
  int _autoRetryCount = 0;
  Timer? _stallTimer;

  bool get _isLiveStream =>
      widget.isLive ||
      widget.videoUrl.toLowerCase().contains('.m3u8') ||
      widget.videoUrl.toLowerCase().contains('/hls/');

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
      _hasSeekedInitial = false;
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
      _isBuffering = false;
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
        final player = Player(
          configuration: const PlayerConfiguration(
            bufferSize: 16 * 1024 * 1024,
          ),
        );
        final controller = VideoController(player);

        _mediaKitPlayer = player;
        _mediaKitController = controller;

        _mediaKitDurationSub = player.stream.duration.listen((dur) {
          _currentMediaKitDuration = dur;
          if (!_hasSeekedInitial && widget.initialPosition != null && dur > Duration.zero) {
            _hasSeekedInitial = true;
            player.seek(widget.initialPosition!);
          }
        });

        _mediaKitPositionSub = player.stream.position.listen((pos) {
          if (widget.onProgress != null && _currentMediaKitDuration > Duration.zero) {
            widget.onProgress!(pos, _currentMediaKitDuration);
          }
        });

        _mediaKitBufferingSub = player.stream.buffering.listen((buffering) {
          if (mounted) setState(() => _isBuffering = buffering);
          if (buffering && _isLiveStream) {
            _stallTimer?.cancel();
            _stallTimer = Timer(const Duration(seconds: 8), () {
              if (_isBuffering && mounted) {
                debugPrint('[AppVideoPlayer] Live stream stalled, attempting auto-reconnect...');
                _retryPlayLive();
              }
            });
          } else {
            _stallTimer?.cancel();
          }
        });

        _mediaKitErrorSub = player.stream.error.listen((err) {
          debugPrint('[AppVideoPlayer] MediaKit error: $err');
          _handlePlaybackFailure(err.toString());
        });

        await player.open(
          Media(
            widget.videoUrl,
            httpHeaders: {
              'User-Agent':
                  'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
            },
          ),
          play: widget.autoPlay,
        );

        if (mounted) {
          setState(() {
            _isLoading = false;
            _autoRetryCount = 0;
          });
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

  void _handlePlaybackFailure(String error) {
    if (_autoRetryCount < 3 && _isLiveStream) {
      _autoRetryCount++;
      debugPrint('[AppVideoPlayer] Auto-reconnect live stream attempt $_autoRetryCount/3...');
      Future.delayed(Duration(milliseconds: 1000 * _autoRetryCount), () {
        if (mounted) _initializePlayer();
      });
      return;
    }
    if (mounted) {
      setState(() {
        _isLoading = false;
        _errorMessage = 'Connexion au direct instable ou interrompue.';
      });
    }
  }

  void _retryPlayLive() {
    _autoRetryCount = 0;
    _initializePlayer();
  }

  Future<void> _initFallbackVideoPlayer() async {
    _useMediaKit = false;
    try {
      final isLocalFile = File(widget.videoUrl).existsSync();
      if (isLocalFile) {
        _videoPlayerController = VideoPlayerController.file(File(widget.videoUrl));
      } else {
        final uri = Uri.parse(widget.videoUrl);
        _videoPlayerController = VideoPlayerController.networkUrl(
          uri,
          httpHeaders: {
            'User-Agent':
                'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
          },
        );
      }
      await _videoPlayerController!.initialize();

      if (widget.initialPosition != null && widget.initialPosition! > Duration.zero) {
        await _videoPlayerController!.seekTo(widget.initialPosition!);
      }

      _videoPlayerController!.addListener(_fallbackVideoListener);

      _chewieController = ChewieController(
        videoPlayerController: _videoPlayerController!,
        autoPlay: widget.autoPlay,
        isLive: _isLiveStream,
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
        _handlePlaybackFailure(e.toString());
      }
    }
  }

  void _fallbackVideoListener() {
    if (_videoPlayerController != null && _videoPlayerController!.value.isInitialized) {
      final pos = _videoPlayerController!.value.position;
      final dur = _videoPlayerController!.value.duration;
      if (widget.onProgress != null && dur > Duration.zero) {
        widget.onProgress!(pos, dur);
      }
    }
  }

  void _disposeAllControllers() {
    _stallTimer?.cancel();
    _stallTimer = null;

    _mediaKitPositionSub?.cancel();
    _mediaKitPositionSub = null;
    _mediaKitDurationSub?.cancel();
    _mediaKitDurationSub = null;
    _mediaKitErrorSub?.cancel();
    _mediaKitErrorSub = null;
    _mediaKitBufferingSub?.cancel();
    _mediaKitBufferingSub = null;

    _mediaKitPlayer?.dispose();
    _mediaKitPlayer = null;
    _mediaKitController = null;

    if (_videoPlayerController != null) {
      _videoPlayerController!.removeListener(_fallbackVideoListener);
      _videoPlayerController!.dispose();
      _videoPlayerController = null;
    }

    _chewieController?.dispose();
    _chewieController = null;

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
                _isEmbed
                    ? 'Chargement du lecteur web...'
                    : _isLiveStream
                        ? 'Connexion au direct HD...'
                        : 'Initialisation du lecteur vidéo...',
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
            const Icon(Icons.wifi_tethering_off_rounded, color: Colors.redAccent, size: 48),
            const SizedBox(height: 12),
            Text(
              _isLiveStream ? 'Flux Direct Indisponible' : 'Erreur de lecture',
              style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
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
                padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
              ),
              onPressed: _retryPlayLive,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Recharger le direct'),
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

    Widget playerBody;

    // C. Affichage MediaKit
    if (_useMediaKit && _mediaKitController != null) {
      playerBody = Video(
        controller: _mediaKitController!,
        controls: MaterialVideoControls,
      );
    } else if (_chewieController != null) {
      // D. Affichage Fallback Chewie
      playerBody = Chewie(controller: _chewieController!);
    } else {
      playerBody = const SizedBox.shrink();
    }

    return Stack(
      children: [
        Positioned.fill(child: Container(color: Colors.black, child: playerBody)),
        if (_isBuffering && !_isLoading)
          Positioned(
            top: 12,
            right: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.white24),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 10,
                    height: 10,
                    child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                  ),
                  SizedBox(width: 6),
                  Text(
                    'Optimisation buffer...',
                    style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}

import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'package:video_player/video_player.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../config/theme.dart';
import '../main.dart';
import '../services/cast_service.dart';
import '../services/native_bridge.dart';
import 'cast_modal.dart';

enum PlayerAspectRatioMode {
  fit, // Format d'origine (bandes noires si nécessaire)
  cover, // Plein écran sans bandes noires (Zoom 18:9, 20:9)
  fill, // Étiré
}

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

class _AppVideoPlayerState extends State<AppVideoPlayer> with TickerProviderStateMixin {
  // MediaKit engine
  Player? _mediaKitPlayer;
  VideoController? _mediaKitController;
  StreamSubscription? _mediaKitPositionSub;
  StreamSubscription? _mediaKitDurationSub;
  StreamSubscription? _mediaKitErrorSub;
  StreamSubscription? _mediaKitBufferingSub;
  StreamSubscription? _mediaKitPlayingSub;
  StreamSubscription? _pipSubscription;

  // VideoPlayer fallback engine
  VideoPlayerController? _videoPlayerController;

  // WebView engine pour les embeds sur mobile (Android / iOS)
  WebViewController? _webViewController;
  bool _isMobileWebView = false;

  bool _useMediaKit = false;
  bool _isLoading = true;
  bool _isBuffering = false;
  bool _isPlaying = true;
  String? _errorMessage;
  bool _hasSeekedInitial = false;
  int _autoRetryCount = 0;
  Timer? _stallTimer;

  // Durations
  Duration _currentPosition = Duration.zero;
  Duration _totalDuration = Duration.zero;

  // Contrôles UI & Auto-hide
  bool _showControls = true;
  Timer? _controlsTimer;
  bool _isDraggingSeek = false;
  double _dragSeekPositionMs = 0;

  // Mode Verrouillage (Child Lock / Cadenas)
  bool _isLocked = false;
  bool _showLockedIcon = false;
  Timer? _lockedIconTimer;

  // Aspect Ratio & Zoom
  PlayerAspectRatioMode _aspectRatioMode = PlayerAspectRatioMode.fit;
  String? _aspectRatioHudText;
  Timer? _aspectRatioHudTimer;

  // Gestes Tactiles : Luminosité & Volume
  double _brightness = 0.5;
  bool _showBrightnessHud = false;
  Timer? _brightnessHudTimer;

  double _volume = 0.5;
  bool _showVolumeHud = false;
  Timer? _volumeHudTimer;

  // Double-tap Seek Animation
  bool _showLeftSeekRipple = false;
  bool _showRightSeekRipple = false;
  Timer? _rippleTimer;
  DateTime _lastTapTime = DateTime.now();
  Offset _lastTapPosition = Offset.zero;

  // Picture-in-Picture
  bool _isInPip = false;

  // Vitesse de lecture
  double _playbackSpeed = 1.0;

  bool get _isLiveStream =>
      widget.isLive ||
      widget.videoUrl.toLowerCase().contains('.m3u8') ||
      widget.videoUrl.toLowerCase().contains('/hls/');

  @override
  void initState() {
    super.initState();
    _initNativeListeners();
    _initializePlayer();
    _startControlsTimer();
  }

  void _initNativeListeners() {
    _pipSubscription = NativeBridge.instance.onPipModeChanged.listen((inPip) {
      if (mounted) {
        setState(() {
          _isInPip = inPip;
          if (inPip) {
            _showControls = false;
          }
        });
      }
    });

    NativeBridge.instance.getBrightness().then((b) {
      if (mounted && b >= 0) setState(() => _brightness = b);
    });

    NativeBridge.instance.getVolume().then((v) {
      if (mounted) setState(() => _volume = v);
    });
  }

  @override
  void didUpdateWidget(covariant AppVideoPlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.videoUrl != widget.videoUrl) {
      _hasSeekedInitial = false;
      _initializePlayer();
    }
  }

  Future<void> _initializePlayer() async {
    setState(() {
      _isLoading = true;
      _isBuffering = false;
      _errorMessage = null;
      _currentPosition = Duration.zero;
      _totalDuration = Duration.zero;
      _isPlaying = widget.autoPlay;
    });

    _disposeAllControllers();

    if (hasMediaKitSupport) {
      // 1. MEDIAKIT ENGINE NATIF (GPU / libmpv - Linux, Windows, macOS, Android, iOS)
      try {
        _useMediaKit = true;
        final player = Player(
          configuration: const PlayerConfiguration(
            bufferSize: 32 * 1024 * 1024,
          ),
        );
        final controller = VideoController(player);

        _mediaKitPlayer = player;
        _mediaKitController = controller;

        _mediaKitDurationSub = player.stream.duration.listen((dur) {
          if (mounted) {
            setState(() => _totalDuration = dur);
          }
          if (!_hasSeekedInitial && widget.initialPosition != null && dur > Duration.zero) {
            _hasSeekedInitial = true;
            player.seek(widget.initialPosition!);
          }
        });

        _mediaKitPositionSub = player.stream.position.listen((pos) {
          if (mounted && !_isDraggingSeek) {
            setState(() => _currentPosition = pos);
          }
          if (widget.onProgress != null && _totalDuration > Duration.zero) {
            widget.onProgress!(pos, _totalDuration);
          }
        });

        _mediaKitPlayingSub = player.stream.playing.listen((playing) {
          if (mounted) setState(() => _isPlaying = playing);
        });

        _mediaKitBufferingSub = player.stream.buffering.listen((buffering) {
          if (mounted) setState(() => _isBuffering = buffering);
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
        debugPrint('[AppVideoPlayer] MediaKit échec, fallback video_player: $e');
        _initFallbackVideoPlayer();
      }
    } else {
      _initFallbackVideoPlayer();
    }
  }

  bool get _isPlatformWebViewSupported {
    if (kIsWeb) return false;
    try {
      return Platform.isAndroid || Platform.isIOS;
    } catch (_) {
      return false;
    }
  }

  void _handlePlaybackFailure(String error) {
    if (_isPlatformWebViewSupported &&
        (error.contains('Failed to recognize file format') ||
            widget.videoUrl.contains('vidlink.pro') ||
            widget.videoUrl.contains('vidsrc') ||
            widget.videoUrl.contains('/embed'))) {
      _initMobileWebView();
      return;
    }

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
        _errorMessage = 'Impossible de charger le flux vidéo : $error';
      });
    }
  }

  void _initMobileWebView() {
    try {
      _useMediaKit = false;
      _isMobileWebView = true;
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

      if (widget.autoPlay) {
        await _videoPlayerController!.play();
      }

      _videoPlayerController!.addListener(_fallbackVideoListener);

      if (mounted) {
        setState(() {
          _isLoading = false;
          _totalDuration = _videoPlayerController!.value.duration;
          _isPlaying = _videoPlayerController!.value.isPlaying;
        });
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
      final playing = _videoPlayerController!.value.isPlaying;
      final buffering = _videoPlayerController!.value.isBuffering;

      if (mounted) {
        setState(() {
          if (!_isDraggingSeek) _currentPosition = pos;
          _totalDuration = dur;
          _isPlaying = playing;
          _isBuffering = buffering;
        });
      }
      if (widget.onProgress != null && dur > Duration.zero) {
        widget.onProgress!(pos, dur);
      }
    }
  }

  void _disposeAllControllers() {
    _stallTimer?.cancel();
    _stallTimer = null;
    _controlsTimer?.cancel();
    _controlsTimer = null;
    _lockedIconTimer?.cancel();
    _brightnessHudTimer?.cancel();
    _volumeHudTimer?.cancel();
    _aspectRatioHudTimer?.cancel();
    _rippleTimer?.cancel();

    _mediaKitPositionSub?.cancel();
    _mediaKitPositionSub = null;
    _mediaKitDurationSub?.cancel();
    _mediaKitDurationSub = null;
    _mediaKitPlayingSub?.cancel();
    _mediaKitPlayingSub = null;
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

    _webViewController = null;
    _isMobileWebView = false;
  }

  @override
  void dispose() {
    _pipSubscription?.cancel();
    _disposeAllControllers();
    super.dispose();
  }

  // ── Contrôles de Lecture (Play, Pause, Seek, Rate) ──

  void _togglePlayPause() {
    NativeBridge.instance.selectionHaptic();
    if (_useMediaKit && _mediaKitPlayer != null) {
      _mediaKitPlayer!.playOrPause();
    } else if (_videoPlayerController != null) {
      if (_videoPlayerController!.value.isPlaying) {
        _videoPlayerController!.pause();
      } else {
        _videoPlayerController!.play();
      }
    }
    _resetControlsTimer();
  }

  void _seekRelative(int seconds) {
    NativeBridge.instance.lightHaptic();
    final targetMs = (_currentPosition.inMilliseconds + (seconds * 1000)).clamp(
      0,
      _totalDuration.inMilliseconds > 0 ? _totalDuration.inMilliseconds : 99999999,
    );
    final target = Duration(milliseconds: targetMs);

    if (_useMediaKit && _mediaKitPlayer != null) {
      _mediaKitPlayer!.seek(target);
    } else if (_videoPlayerController != null) {
      _videoPlayerController!.seekTo(target);
    }

    setState(() => _currentPosition = target);
    _resetControlsTimer();
  }

  void _seekToPosition(Duration position) {
    if (_useMediaKit && _mediaKitPlayer != null) {
      _mediaKitPlayer!.seek(position);
    } else if (_videoPlayerController != null) {
      _videoPlayerController!.seekTo(position);
    }
    setState(() => _currentPosition = position);
  }

  void _cyclePlaybackSpeed() {
    NativeBridge.instance.selectionHaptic();
    final speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    final currentIndex = speeds.indexOf(_playbackSpeed);
    final nextSpeed = speeds[(currentIndex + 1) % speeds.length];

    if (_useMediaKit && _mediaKitPlayer != null) {
      _mediaKitPlayer!.setRate(nextSpeed);
    } else if (_videoPlayerController != null) {
      _videoPlayerController!.setPlaybackSpeed(nextSpeed);
    }

    setState(() => _playbackSpeed = nextSpeed);
    _resetControlsTimer();
  }

  // ── Aspect Ratio / Zoom sans bandes noires ──

  void _cycleAspectRatio() {
    NativeBridge.instance.lightHaptic();
    setState(() {
      if (_aspectRatioMode == PlayerAspectRatioMode.fit) {
        _aspectRatioMode = PlayerAspectRatioMode.cover;
        _aspectRatioHudText = 'Plein Écran (Zoom 18:9 / 20:9)';
      } else if (_aspectRatioMode == PlayerAspectRatioMode.cover) {
        _aspectRatioMode = PlayerAspectRatioMode.fill;
        _aspectRatioHudText = 'Étiré (100% Surface)';
      } else {
        _aspectRatioMode = PlayerAspectRatioMode.fit;
        _aspectRatioHudText = 'Format Original (Ajuster)';
      }
    });

    _aspectRatioHudTimer?.cancel();
    _aspectRatioHudTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) setState(() => _aspectRatioHudText = null);
    });
  }

  BoxFit get _currentBoxFit {
    switch (_aspectRatioMode) {
      case PlayerAspectRatioMode.cover:
        return BoxFit.cover;
      case PlayerAspectRatioMode.fill:
        return BoxFit.fill;
      case PlayerAspectRatioMode.fit:
        return BoxFit.contain;
    }
  }

  // ── Picture-in-Picture ──

  Future<void> _enterPip() async {
    NativeBridge.instance.mediumHaptic();
    setState(() => _showControls = false);
    await NativeBridge.instance.enterPip(
      aspectRatioNumerator: 16,
      aspectRatioDenominator: 9,
    );
  }

  // ── Mode Verrouillage (Screen Lock) ──

  void _toggleScreenLock() {
    NativeBridge.instance.mediumHaptic();
    setState(() {
      _isLocked = !_isLocked;
      if (_isLocked) {
        _showControls = false;
        _showLockedIcon = true;
        _lockedIconTimer?.cancel();
        _lockedIconTimer = Timer(const Duration(seconds: 3), () {
          if (mounted) setState(() => _showLockedIcon = false);
        });
      } else {
        _showControls = true;
        _showLockedIcon = false;
      }
    });
  }

  // ── Gestes : Double-Tap & Glissements (Luminosité / Volume) ──

  void _handleTapDown(TapDownDetails details, double screenWidth) {
    final now = DateTime.now();
    final pos = details.localPosition;
    final diff = now.difference(_lastTapTime).inMilliseconds;

    if (diff < 300 && (pos - _lastTapPosition).distance < 60) {
      // Double Tap détecté !
      if (_isLocked) return;

      if (pos.dx < screenWidth * 0.4) {
        // Double tap gauche : -10s
        _seekRelative(-10);
        setState(() => _showLeftSeekRipple = true);
        _rippleTimer?.cancel();
        _rippleTimer = Timer(const Duration(milliseconds: 650), () {
          if (mounted) setState(() => _showLeftSeekRipple = false);
        });
      } else if (pos.dx > screenWidth * 0.6) {
        // Double tap droite : +10s
        _seekRelative(10);
        setState(() => _showRightSeekRipple = true);
        _rippleTimer?.cancel();
        _rippleTimer = Timer(const Duration(milliseconds: 650), () {
          if (mounted) setState(() => _showRightSeekRipple = false);
        });
      }
    } else {
      // Simple tap : toggle controls ou afficher icône cadenas si verrouillé
      if (_isLocked) {
        setState(() => _showLockedIcon = true);
        _lockedIconTimer?.cancel();
        _lockedIconTimer = Timer(const Duration(seconds: 3), () {
          if (mounted) setState(() => _showLockedIcon = false);
        });
      } else {
        setState(() => _showControls = !_showControls);
        if (_showControls) _startControlsTimer();
      }
    }

    _lastTapTime = now;
    _lastTapPosition = pos;
  }

  void _handleVerticalDragUpdate(DragUpdateDetails details, double screenWidth, double screenHeight) {
    if (_isLocked) return;

    final dx = details.localPosition.dx;
    final dy = details.delta.dy;
    final deltaPercent = -dy / (screenHeight * 0.7);

    if (dx < screenWidth * 0.5) {
      // Côté GAUCHE : Luminosité
      final newB = (_brightness + deltaPercent).clamp(0.01, 1.0);
      _brightness = newB;
      NativeBridge.instance.setBrightness(newB);
      setState(() => _showBrightnessHud = true);
      _brightnessHudTimer?.cancel();
      _brightnessHudTimer = Timer(const Duration(seconds: 2), () {
        if (mounted) setState(() => _showBrightnessHud = false);
      });
    } else {
      // Côté DROIT : Volume Sonore
      final newV = (_volume + deltaPercent).clamp(0.0, 1.0);
      _volume = newV;
      NativeBridge.instance.setVolume(newV);
      if (_useMediaKit && _mediaKitPlayer != null) {
        _mediaKitPlayer!.setVolume(newV * 100);
      }
      setState(() => _showVolumeHud = true);
      _volumeHudTimer?.cancel();
      _volumeHudTimer = Timer(const Duration(seconds: 2), () {
        if (mounted) setState(() => _showVolumeHud = false);
      });
    }
  }

  void _startControlsTimer() {
    _controlsTimer?.cancel();
    _controlsTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && _isPlaying && !_isDraggingSeek) {
        setState(() => _showControls = false);
      }
    });
  }

  void _resetControlsTimer() {
    if (_showControls) {
      _startControlsTimer();
    }
  }

  String _formatDuration(Duration d) {
    final h = d.inHours;
    final m = d.inMinutes % 60;
    final s = d.inSeconds % 60;
    if (h > 0) {
      return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    if (_isInPip) {
      // En mode Picture-in-Picture, rendu vidéo épuré sans overlay
      return Container(
        color: Colors.black,
        child: _buildVideoSurface(),
      );
    }

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
                _isLiveStream
                    ? 'Connexion au direct HD...'
                    : 'Initialisation du lecteur vidéo...',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
        ),
      );
    }

    if (_isMobileWebView && _webViewController != null) {
      return Container(
        color: Colors.black,
        child: WebViewWidget(controller: _webViewController!),
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
              label: const Text('Recharger'),
            ),
          ],
        ),
      );
    }

    return LayoutBuilder(
      builder: (context, constraints) {
        final screenWidth = constraints.maxWidth;
        final screenHeight = constraints.maxHeight;

        return Stack(
          children: [
            // 1. Surface Vidéo Native
            Positioned.fill(
              child: Container(
                color: Colors.black,
                child: _buildVideoSurface(),
              ),
            ),

            // 2. Détecteur de Gestes Tactiles (Double-Tap & Swipe Luminosité/Volume)
            Positioned.fill(
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTapDown: (details) => _handleTapDown(details, screenWidth),
                onVerticalDragUpdate: (details) =>
                    _handleVerticalDragUpdate(details, screenWidth, screenHeight),
              ),
            ),

            // 3. Animation Double-Tap Ripple Gauche (-10s)
            if (_showLeftSeekRipple)
              Positioned(
                left: 30,
                top: 0,
                bottom: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                    ),
                    child: const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.replay_10_rounded, color: Colors.white, size: 40),
                        SizedBox(height: 4),
                        Text('-10s', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              ),

            // 4. Animation Double-Tap Ripple Droite (+10s)
            if (_showRightSeekRipple)
              Positioned(
                right: 30,
                top: 0,
                bottom: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.6),
                      shape: BoxShape.circle,
                    ),
                    child: const Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.forward_10_rounded, color: Colors.white, size: 40),
                        SizedBox(height: 4),
                        Text('+10s', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                      ],
                    ),
                  ),
                ),
              ),

            // 5. HUD Jauge Luminosité (Gauche)
            if (_showBrightnessHud)
              Positioned(
                left: 24,
                top: screenHeight * 0.25,
                bottom: screenHeight * 0.25,
                child: _buildVerticalGestureHud(
                  icon: _brightness > 0.5 ? Icons.brightness_7_rounded : Icons.brightness_4_rounded,
                  value: _brightness,
                  label: '${(_brightness * 100).round()}%',
                ),
              ),

            // 6. HUD Jauge Volume (Droite)
            if (_showVolumeHud)
              Positioned(
                right: 24,
                top: screenHeight * 0.25,
                bottom: screenHeight * 0.25,
                child: _buildVerticalGestureHud(
                  icon: _volume <= 0
                      ? Icons.volume_off_rounded
                      : _volume < 0.5
                          ? Icons.volume_down_rounded
                          : Icons.volume_up_rounded,
                  value: _volume,
                  label: '${(_volume * 100).round()}%',
                ),
              ),

            // 7. HUD Badge Aspect Ratio
            if (_aspectRatioHudText != null)
              Positioned(
                top: 24,
                left: 0,
                right: 0,
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: AppTheme.primary.withValues(alpha: 0.4)),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.aspect_ratio_rounded, color: AppTheme.primary, size: 16),
                        const SizedBox(width: 8),
                        Text(
                          _aspectRatioHudText!,
                          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

            // 8. Indicateur Buffering
            if (_isBuffering && !_isLoading)
              Positioned(
                top: 14,
                right: 14,
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
                        'Buffering HD...',
                        style: TextStyle(color: Colors.white70, fontSize: 10, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ),

            // 9. Bouton Déverrouillage Flottant (Quand Écran Verrouillé)
            if (_isLocked && _showLockedIcon)
              Positioned(
                left: 20,
                top: 20,
                child: GestureDetector(
                  onTap: _toggleScreenLock,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withValues(alpha: 0.9),
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: AppTheme.primary.withValues(alpha: 0.4),
                          blurRadius: 12,
                          spreadRadius: 2,
                        ),
                      ],
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.lock_rounded, color: Colors.white, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Appuyez pour Déverrouiller',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

            // 10. OVERLAY COMPLET DES CONTRÔLES (Si déverrouillé et affiché)
            if (!_isLocked && _showControls)
              Positioned.fill(
                child: _buildControlsOverlay(context),
              ),
          ],
        );
      },
    );
  }

  Widget _buildVideoSurface() {
    if (_useMediaKit && _mediaKitController != null) {
      return Video(
        controller: _mediaKitController!,
        fit: _currentBoxFit,
        controls: (state) => const SizedBox.shrink(),
      );
    } else if (_videoPlayerController != null && _videoPlayerController!.value.isInitialized) {
      return Center(
        child: FittedBox(
          fit: _currentBoxFit,
          child: SizedBox(
            width: _videoPlayerController!.value.size.width,
            height: _videoPlayerController!.value.size.height,
            child: VideoPlayer(_videoPlayerController!),
          ),
        ),
      );
    }
    return const SizedBox.shrink();
  }

  Widget _buildVerticalGestureHud({
    required IconData icon,
    required double value,
    required String label,
  }) {
    return Container(
      width: 44,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.75),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: Colors.white.withValues(alpha: 0.15)),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: AppTheme.primary, size: 22),
          const SizedBox(height: 8),
          Expanded(
            child: RotatedBox(
              quarterTurns: 3,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: value.clamp(0.0, 1.0),
                  backgroundColor: Colors.white24,
                  valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
                  minHeight: 6,
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            label,
            style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildControlsOverlay(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Colors.black87,
            Colors.transparent,
            Colors.transparent,
            Colors.black87,
          ],
          stops: [0.0, 0.25, 0.7, 1.0],
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // ── BARRE SUPÉRIEURE ──
          SafeArea(
            bottom: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              child: Row(
                children: [
                  // Cadenas (Screen Lock)
                  IconButton(
                    icon: const Icon(Icons.lock_open_rounded, color: Colors.white70),
                    tooltip: 'Verrouiller l\'écran',
                    onPressed: _toggleScreenLock,
                  ),
                  const SizedBox(width: 4),
                  // Titre du média
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.title,
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        if (widget.subtitle != null)
                          Text(
                            widget.subtitle!,
                            style: const TextStyle(color: AppTheme.primary, fontSize: 11, fontWeight: FontWeight.w600),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                      ],
                    ),
                  ),
                  // Vitesse de lecture
                  TextButton(
                    onPressed: _cyclePlaybackSpeed,
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      minimumSize: Size.zero,
                    ),
                    child: Text(
                      '${_playbackSpeed}x',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                    ),
                  ),
                  // Format d'affichage (Aspect Ratio / Zoom)
                  IconButton(
                    icon: const Icon(Icons.aspect_ratio_rounded, color: Colors.white70),
                    tooltip: 'Changer le format d\'affichage (Zoom / Étirer)',
                    onPressed: _cycleAspectRatio,
                  ),
                  // Diffusion Smart TV (Cast / DLNA)
                  IconButton(
                    icon: Icon(
                      CastService().isConnected ? Icons.cast_connected_rounded : Icons.cast_rounded,
                      color: CastService().isConnected ? Colors.greenAccent : Colors.white70,
                    ),
                    tooltip: 'Diffuser sur Smart TV',
                    onPressed: () {
                      _showControls = false;
                      CastModal.show(
                        context,
                        videoUrl: widget.videoUrl,
                        title: widget.title,
                      );
                    },
                  ),
                  // Mode Picture-in-Picture
                  IconButton(
                    icon: const Icon(Icons.picture_in_picture_alt_rounded, color: Colors.white70),
                    tooltip: 'Mode Flottant (Picture-in-Picture)',
                    onPressed: _enterPip,
                  ),
                ],
              ),
            ),
          ),

          // ── CONTRÔLES CENTRAUX (Saut -10s, Play/Pause, Saut +10s) ──
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.hasPrevEpisode) ...[
                IconButton(
                  icon: const Icon(Icons.skip_previous_rounded, color: Colors.white70, size: 32),
                  tooltip: 'Épisode précédent',
                  onPressed: () {
                    NativeBridge.instance.selectionHaptic();
                    widget.onPrevEpisode?.call();
                  },
                ),
                const SizedBox(width: 16),
              ],
              IconButton(
                icon: const Icon(Icons.replay_10_rounded, color: Colors.white, size: 36),
                tooltip: 'Reculer de 10s',
                onPressed: () => _seekRelative(-10),
              ),
              const SizedBox(width: 20),
              GestureDetector(
                onTap: _togglePlayPause,
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withValues(alpha: 0.9),
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: AppTheme.primary.withValues(alpha: 0.4),
                        blurRadius: 16,
                      ),
                    ],
                  ),
                  child: Icon(
                    _isPlaying ? Icons.pause_rounded : Icons.play_arrow_rounded,
                    color: Colors.white,
                    size: 38,
                  ),
                ),
              ),
              const SizedBox(width: 20),
              IconButton(
                icon: const Icon(Icons.forward_10_rounded, color: Colors.white, size: 36),
                tooltip: 'Avancer de 10s',
                onPressed: () => _seekRelative(10),
              ),
              if (widget.hasNextEpisode) ...[
                const SizedBox(width: 16),
                IconButton(
                  icon: const Icon(Icons.skip_next_rounded, color: Colors.white70, size: 32),
                  tooltip: 'Épisode suivant',
                  onPressed: () {
                    NativeBridge.instance.selectionHaptic();
                    widget.onNextEpisode?.call();
                  },
                ),
              ],
            ],
          ),

          // ── BARRE INFÉRIEURE (Timeline & Durées) ──
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Text(
                        _formatDuration(_isDraggingSeek
                            ? Duration(milliseconds: _dragSeekPositionMs.round())
                            : _currentPosition),
                        style: const TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                      Expanded(
                        child: SliderTheme(
                          data: SliderTheme.of(context).copyWith(
                            trackHeight: 3,
                            thumbShape: const RoundSliderThumbShape(enabledThumbRadius: 6),
                            overlayShape: const RoundSliderOverlayShape(overlayRadius: 12),
                            activeTrackColor: AppTheme.primary,
                            inactiveTrackColor: Colors.white24,
                            thumbColor: AppTheme.primary,
                          ),
                          child: Slider(
                            value: _isDraggingSeek
                                ? _dragSeekPositionMs
                                : _currentPosition.inMilliseconds
                                    .toDouble()
                                    .clamp(0.0, _totalDuration.inMilliseconds.toDouble().clamp(1.0, double.infinity)),
                            min: 0.0,
                            max: _totalDuration.inMilliseconds > 0
                                ? _totalDuration.inMilliseconds.toDouble()
                                : 1.0,
                            onChangeStart: (val) {
                              _isDraggingSeek = true;
                              _dragSeekPositionMs = val;
                            },
                            onChanged: (val) {
                              setState(() => _dragSeekPositionMs = val);
                            },
                            onChangeEnd: (val) {
                              _isDraggingSeek = false;
                              _seekToPosition(Duration(milliseconds: val.round()));
                              _resetControlsTimer();
                            },
                          ),
                        ),
                      ),
                      Text(
                        _formatDuration(_totalDuration),
                        style: const TextStyle(color: Colors.white38, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

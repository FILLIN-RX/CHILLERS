import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../services/native_bridge.dart';
import '../main_navigation.dart';
import '../onboarding/onboarding_screen.dart';
import 'splash_beams.dart';

/// Brand intro CHILLERS — même partition que le rendu de `brand/intro` :
/// jaillissement sur noir pur, impact à 0,5 s, arc de néon sur le contour,
/// désintégration en faisceaux verticaux, plongée de caméra puis noir.
/// Aucun texte : seul le glyphe, centré.
const double _kSeconds = 3.5;
const double _kBurst = 0.06;
const double _kImpact = 0.5;
const double _kBreak = 1.02;
const double _kBreakEnd = 2.42;
const double _kPlungeEnd = 3.14;

const Color _kCyan = Color(0xFF39E6FF);
const Color _kMag = Color(0xFFF42A7C);
const Color _kViolet = Color(0xFF7C3AED);

double _inv(double t, double a, double b) => ((t - a) / (b - a)).clamp(0.0, 1.0).toDouble();
double _smooth(double u) => u * u * (3 - 2 * u);
double _outCubic(double u) => 1 - math.pow(1 - u, 3).toDouble();
double _outExpo(double u) => u >= 1 ? 1 : 1 - math.pow(2, -9 * u).toDouble();
double _inCubic(double u) => u * u * u;

/// Bruit déterministe : la même image donne toujours le même tremblement.
double _rnd(double n, [double salt = 0]) {
  final x = math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
  return x - x.floorToDouble();
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  final List<Timer> _timers = [];

  @override
  void initState() {
    super.initState();
    _c = AnimationController(vsync: this, duration: const Duration(milliseconds: 3500));
    _playCinematicSequence();
  }

  void _at(int ms, void Function() fn) => _timers.add(Timer(Duration(milliseconds: ms), fn));

  Future<void> _playCinematicSequence() async {
    await Future.delayed(const Duration(milliseconds: 150));
    if (!mounted) return;
    NativeBridge.instance.mediumHaptic();
    _c.forward();

    // l'impact de 0,5 s et la plongée de 2,42 s tombent côté haptique
    _at(650, () {
      if (mounted) NativeBridge.instance.lightHaptic();
    });
    _at(2570, () {
      if (mounted) NativeBridge.instance.lightHaptic();
    });

    // la transition démarre pendant la plongée : le fondu se superpose au noir
    await Future.delayed(const Duration(milliseconds: 3200));
    if (!mounted) return;

    final prefs = await SharedPreferences.getInstance();
    final bool hasSeenOnboarding = prefs.getBool('has_seen_onboarding_v1') ?? false;

    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 650),
        pageBuilder: (context, animation, secondaryAnimation) => hasSeenOnboarding
            ? MainNavigation(key: MainNavigation.navKey)
            : const OnboardingScreen(),
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  void dispose() {
    for (final t in _timers) {
      t.cancel();
    }
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.sizeOf(context);
    final markSize = math.min(screen.width, screen.height) * 0.44;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0A0A),
      body: AnimatedBuilder(
        animation: _c,
        builder: (context, child) {
          final t = _c.value * _kSeconds;

          // 3 images de shake à la révélation, puis un ring-out décroissant
          final post = t - _kImpact;
          final hit = post >= 0 && post < 0.05;
          final ring = post <= 0
              ? 0.0
              : (hit ? 1.0 : 1.0 - _inv(t, _kImpact + 0.05, _kImpact + 0.3));
          final amp = (hit ? 22.0 : 0.0) + ring * 10.0;
          final frame = (t * 60).roundToDouble();
          final shake = Offset(
            amp == 0 ? 0.0 : (_rnd(frame, 71) - 0.5) * amp,
            amp == 0 ? 0.0 : (_rnd(frame, 73) - 0.5) * amp,
          );
          final rot = amp == 0 ? 0.0 : (_rnd(frame, 79) - 0.5) * 0.01;
          final push = 1 + 0.07 * _inCubic(_inv(t, _kBreakEnd, _kPlungeEnd));

          return Stack(
            fit: StackFit.expand,
            alignment: Alignment.center,
            children: [
              const DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: Alignment(0, -0.15),
                    radius: 1.15,
                    colors: [Color(0xFF120611), Color(0xFF0A0A0A)],
                    stops: [0.0, 0.72],
                  ),
                ),
                child: SizedBox.expand(),
              ),
              Transform.rotate(
                angle: rot,
                child: Transform.translate(
                  offset: shake,
                  child: Transform.scale(
                    scale: push,
                    child: Stack(
                      fit: StackFit.expand,
                      alignment: Alignment.center,
                      children: [
                        CustomPaint(painter: _HazePainter(t)),
                        _Mark(t: t, size: markSize),
                        CustomPaint(painter: _BeamPainter(t, markSize)),
                      ],
                    ),
                  ),
                ),
              ),
              const IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.center,
                      radius: 0.95,
                      colors: [Color(0x00000000), Color(0x00000000), Color(0xD9000000)],
                      stops: [0.0, 0.55, 1.0],
                    ),
                  ),
                  child: SizedBox.expand(),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Le glyphe : apparition en surexposition, aberration chromatique à l'impact,
/// puis dissolution pendant que les faisceaux partent vers la caméra.
class _Mark extends StatelessWidget {
  const _Mark({required this.t, required this.size});

  final double t;
  final double size;

  @override
  Widget build(BuildContext context) {
    final q = _inv(t, _kBurst, _kImpact);
    if (q <= 0) return const SizedBox.shrink();

    final settle = _inv(t, _kImpact, _kImpact + 0.22);
    final scale = (0.34 + 0.66 * _outExpo(q)) *
        (1 + 0.03 * math.sin(settle * math.pi) * (1 - settle));
    final fade = 1.0 - _smooth(_inv(t, _kBreak, _kBreak + 0.46));
    if (fade <= 0.002) return const SizedBox.shrink();

    final flick = t < _kImpact ? 0.55 + 0.45 * _rnd((t * 60).roundToDouble(), 51) : 1.0;
    final over = (((3.4 - 2.4 * _outCubic(q)) * flick - 1) * 0.5).clamp(0.0, 0.9).toDouble();
    final ab = (15 * (1 - _outCubic(_inv(t, _kImpact, _kImpact + 0.36))) + 2.5).clamp(0.0, 24.0).toDouble();

    return Opacity(
      opacity: (fade * (0.35 + 0.65 * q)).clamp(0.0, 1.0).toDouble(),
      child: Transform.scale(
        scale: scale,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // halo néon — un dégradé coûte bien moins cher qu'un flou par image
            _Glow(diameter: size * (1.5 + 0.9 * over)),
            _chromatic(_kCyan, -ab, 0.42 * flick),
            _chromatic(_kMag, ab, 0.42 * flick),
            _asset(),
            if (over > 0.01)
              Opacity(
                opacity: over,
                child: ColorFiltered(
                  colorFilter: const ColorFilter.mode(Colors.white, BlendMode.srcIn),
                  child: _asset(),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _asset() => Image.asset(
        'assets/brand/mark.webp',
        width: size,
        height: size,
        filterQuality: FilterQuality.medium,
      );

  Widget _chromatic(Color color, double dx, double opacity) => Transform.translate(
        offset: Offset(dx, 0),
        child: Opacity(
          opacity: opacity.clamp(0.0, 1.0).toDouble(),
          child: ColorFiltered(
            colorFilter: ColorFilter.mode(color, BlendMode.srcIn),
            child: _asset(),
          ),
        ),
      );
}

class _Glow extends StatelessWidget {
  const _Glow({required this.diameter});

  final double diameter;

  @override
  Widget build(BuildContext context) => IgnorePointer(
        child: SizedBox(
          width: diameter,
          height: diameter,
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  _kMag.withValues(alpha: 0.32),
                  _kViolet.withValues(alpha: 0.13),
                  Colors.transparent,
                ],
                stops: const [0.0, 0.45, 1.0],
              ),
            ),
          ),
        ),
      );
}

/// Fumée volumétrique derrière le glyphe.
class _HazePainter extends CustomPainter {
  _HazePainter(this.t);

  final double t;

  @override
  void paint(Canvas canvas, Size size) {
    final a = _inv(t, 0.1, 0.9) * (1 - 0.7 * _inv(t, _kBreakEnd + 0.4, _kSeconds));
    if (a <= 0) return;
    final c = Offset(size.width / 2, size.height / 2);
    final paint = Paint()..blendMode = BlendMode.plus;
    for (var i = 0; i < 10; i++) {
      final phase = _rnd(i, 21) * 6.283;
      final speed = 0.25 + _rnd(i, 23) * 0.5;
      final r = size.shortestSide * (0.3 + _rnd(i, 29) * 0.55);
      final pos = Offset(
        c.dx + math.cos(phase + t * speed) * size.width * (0.25 + _rnd(i, 31) * 0.5),
        c.dy + math.sin(phase * 1.7 + t * speed * 0.8) * size.height * (0.1 + _rnd(i, 37) * 0.35),
      );
      final color = i % 3 == 0 ? _kMag : (i % 3 == 1 ? _kCyan : _kViolet);
      paint.shader = RadialGradient(
        colors: [color.withValues(alpha: 0.05 * a * (0.4 + _rnd(i, 41) * 0.6)), Colors.transparent],
      ).createShader(Rect.fromCircle(center: pos, radius: r));
      canvas.drawCircle(pos, r, paint);
    }
    paint.shader = null;
  }

  @override
  bool shouldRepaint(_HazePainter old) => old.t != t;
}

/// Faisceaux laser verticaux, arc de néon, flare anamorphique et flash d'impact.
class _BeamPainter extends CustomPainter {
  _BeamPainter(this.t, this.markSize);

  final double t;
  final double markSize;

  /// pas d'échantillonnage de kSplashColumns, en espace unité (-1..1)
  static const double _step = 2 / 56;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final half = markSize / 2;

    if (t >= _kBreak - 0.05) _beams(canvas, size, c, half);
    _arc(canvas, c, half);
    _flare(canvas, size, c);
  }

  void _beams(Canvas canvas, Size size, Offset c, double half) {
    final layer = Offset.zero & size;
    canvas.saveLayer(layer, Paint()..blendMode = BlendMode.plus);
    final paint = Paint();
    final beamW = _step * half * 1.15;

    for (var i = 0; i < kSplashColumns.length; i++) {
      final col = kSplashColumns[i];
      final energy = col[3] / 1000;
      // les colonnes de profil varient peu : on ré-étale la couverture 0.8..1.0
      final dens = ((energy - 0.8) / 0.2).clamp(0.0, 1.0).toDouble();
      final p = _inv(t - _kBreak - (1 - dens) * 0.18, 0, 1.5 + 0.62 * _rnd(i, 7));
      if (p <= 0) continue;

      final f = 1 / (1 - 0.9 * math.min(p, 0.985));
      final env = _smooth((p / 0.16).clamp(0.0, 1.0).toDouble()) *
          (1 - _smooth(((p - 0.7) / 0.3).clamp(0.0, 1.0).toDouble()));
      final hot = energy > 0.994;
      final alpha = (math.pow(env * (1 - 0.45 * p) * (0.35 + 0.65 * dens), 1.25).toDouble() *
                  (hot ? 1.3 : 1.0))
              .clamp(0.0, 1.0)
              .toDouble();
      if (alpha < 0.012) continue;

      final x = c.dx + col[0] / 1000 * half * f + (0.5 - _rnd(i, 11)) * 44 * p * p;
      final top = c.dy + col[1] / 1000 * half * f;
      final bot = c.dy + col[2] / 1000 * half * f;
      final h = math.max(3.0, bot - top);
      final w = math.max(1.2, beamW * f);
      final body = hot ? Colors.white : (col[4] == 1 ? _kCyan : _kMag);

      // laser : traîne qui traverse le plan en s'allongeant vers la caméra
      paint.color = body.withValues(alpha: (alpha * (hot ? 0.26 : 0.13)).clamp(0.0, 1.0).toDouble());
      canvas.drawRect(Rect.fromLTWH(x - w * 0.8, top - h * (0.5 + 1.3 * p), w * 1.6, h * (1 + 2.6 * p)), paint);
      // corps du faisceau
      paint.color = body.withValues(alpha: (alpha * 0.8).clamp(0.0, 1.0).toDouble());
      canvas.drawRect(Rect.fromLTWH(x - w / 2, top, w, h), paint);
      // ruban chromatique décalé
      paint.color = (hot ? _kCyan : _kViolet).withValues(alpha: (alpha * 0.18).clamp(0.0, 1.0).toDouble());
      canvas.drawRect(Rect.fromLTWH(x - w * 2.4, top + h * 0.06, w * 1.5, h * 0.88), paint);
    }

    // estompe les extrémités hautes/basses sans flou : un seul masque dstIn
    final fade = Paint()
      ..blendMode = BlendMode.dstIn
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Colors.transparent, Colors.white, Colors.white, Colors.transparent],
        stops: [0.0, 0.16, 0.84, 1.0],
      ).createShader(layer);
    canvas.drawRect(layer, fade);
    canvas.restore();
  }

  /// Un point d'arc électrique qui remonte le contour du glyphe (façon Saber).
  void _arc(Canvas canvas, Offset c, double half) {
    final a = _inv(t, _kImpact + 0.04, _kBreak + 0.3);
    if (a <= 0 || a >= 1 || kSplashColumns.isEmpty) return;
    final col = kSplashColumns[(a * (kSplashColumns.length - 1)).round()];
    final pos = Offset(c.dx + col[0] / 1000 * half, c.dy + col[1] / 1000 * half);
    const r = 26.0;
    final glow = math.sin(a * math.pi);
    canvas.drawCircle(
      pos,
      r,
      Paint()
        ..blendMode = BlendMode.plus
        ..shader = RadialGradient(
          colors: [
            Colors.white.withValues(alpha: 0.95 * glow),
            _kCyan.withValues(alpha: 0.5 * glow),
            Colors.transparent,
          ],
          stops: const [0.0, 0.35, 1.0],
        ).createShader(Rect.fromCircle(center: pos, radius: r)),
    );
  }

  void _flare(Canvas canvas, Size size, Offset c) {
    if (t < _kImpact - 0.02) return;
    final decay = math.exp(-_inv(t, _kImpact, _kImpact + 0.9) * 3.4);
    final life = 1 - _smooth(_inv(t, _kBreak + 0.4, _kBreakEnd));
    final a = (0.14 + 0.46 * decay) * life;
    if (a <= 0.004) return;

    final paint = Paint()..blendMode = BlendMode.plus;
    // streak anamorphique
    final streak = Rect.fromLTWH(0, c.dy - 2.5, size.width, 5);
    paint.shader = LinearGradient(
      colors: [Colors.transparent, Colors.white.withValues(alpha: a), Colors.transparent],
    ).createShader(streak);
    canvas.drawRect(streak, paint);
    // coeur optique
    const r = 0.24;
    final radius = size.shortestSide * r;
    paint.shader = RadialGradient(
      colors: [
        Colors.white.withValues(alpha: a * 0.5),
        _kCyan.withValues(alpha: a * 0.18),
        Colors.transparent,
      ],
      stops: const [0.0, 0.25, 1.0],
    ).createShader(Rect.fromCircle(center: c, radius: radius));
    canvas.drawCircle(c, radius, paint);
    paint.shader = null;

    final flash = (1 - _inv(t, _kImpact - 0.02, _kImpact + 0.07)).clamp(0.0, 1.0).toDouble();
    if (flash > 0) {
      canvas.drawRect(
        Offset.zero & size,
        Paint()
          ..color = const Color(0xFFE6F9FF).withValues(alpha: flash * 0.34)
          ..blendMode = BlendMode.srcOver,
      );
    }
  }

  @override
  bool shouldRepaint(_BeamPainter old) => old.t != t || old.markSize != markSize;
}

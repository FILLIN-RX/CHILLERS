import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';

class AuthPosterWall extends StatefulWidget {
  const AuthPosterWall({super.key});

  @override
  State<AuthPosterWall> createState() => _AuthPosterWallState();
}

class _AuthPosterWallState extends State<AuthPosterWall>
    with TickerProviderStateMixin {
  late final AnimationController _controllerSlow;
  late final AnimationController _controllerFast;

  static const List<List<String>> _columns = [
    // Column 1
    [
      "https://image.tmdb.org/t/p/original/pEEI5mMoyZrbapzWC6vB6UmesDW.jpg",
      "https://image.tmdb.org/t/p/original/dFwseuSlDUNiwMuElDb3OAOQ8En.jpg",
      "https://image.tmdb.org/t/p/original/kP8jJIkmX0vWEYiqQ9c5zU0dvcn.jpg",
      "https://image.tmdb.org/t/p/original/rfRLWbxLZPq2eboKPsBvh1NgNwM.jpg",
      "https://image.tmdb.org/t/p/original/1CuYfdSqpIjsWIaCftQKBCjNlG.jpg",
    ],
    // Column 2
    [
      "https://image.tmdb.org/t/p/original/m2FaGlQUKMMFE6nUMwFTcIWbnEi.jpg",
      "https://image.tmdb.org/t/p/original/fN4YJFr6d1Zx2fNBlzGLyShO6sc.jpg",
      "https://image.tmdb.org/t/p/original/eHELFF4BBxmEk5JyhV017Xcgvwy.jpg",
      "https://image.tmdb.org/t/p/original/19SvZsTB6UINUZowkBsPSGZUNxD.jpg",
      "https://image.tmdb.org/t/p/original/gF6Ijrq5bixh4qemCuroRwXtbBc.jpg",
    ],
    // Column 3
    [
      "https://image.tmdb.org/t/p/original/mDCR1frpUvGfIKksuM440VLb7X9.jpg",
      "https://image.tmdb.org/t/p/original/myJdCnJEsFsMmjKhKopQ32lkcP3.jpg",
      "https://image.tmdb.org/t/p/original/b2bt3UomRX41rHHZmIsSNmXzidU.jpg",
      "https://image.tmdb.org/t/p/original/8hsSCYpO5XFSAVnn70YehKslgFt.jpg",
      "https://image.tmdb.org/t/p/original/iwCeOpuBtuTP1kLosqgniey5OvX.jpg",
    ],
    // Column 4
    [
      "https://image.tmdb.org/t/p/original/eSS5mvSG84UUuvtbHel5Yu3Wik4.jpg",
      "https://image.tmdb.org/t/p/original/7bOuu1SRALGwsG2fLCTvRkCmQBj.jpg",
      "https://image.tmdb.org/t/p/original/oLld47ZT1I3iecM3OWhIphohQUJ.jpg",
      "https://image.tmdb.org/t/p/original/vuxZITXEqsBHBUhc1TKEU8mxvc.jpg",
      "https://image.tmdb.org/t/p/original/sJDjdYGDFdx9uftetPPjH7Jwing.jpg",
    ],
  ];

  @override
  void initState() {
    super.initState();
    _controllerSlow = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 45),
    )..repeat();

    _controllerFast = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 38),
    )..repeat();
  }

  @override
  void dispose() {
    _controllerSlow.dispose();
    _controllerFast.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        // ── 1. Animated Poster Columns ──
        Transform.rotate(
          angle: -0.02,
          child: Transform.scale(
            scale: 1.08,
            child: LayoutBuilder(
              builder: (context, constraints) {
                const int colCount = 4;
                const double spacing = 8.0;
                final double colWidth = (constraints.maxWidth - (colCount - 1) * spacing) / colCount;
                final double itemHeight = colWidth * 1.5;
                final double singleItemStride = itemHeight + spacing;

                return SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  physics: const NeverScrollableScrollPhysics(),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: List.generate(colCount, (colIndex) {
                      final isDown = colIndex % 2 == 1;
                      final isFast = colIndex % 2 != 0;
                      final controller = isFast ? _controllerFast : _controllerSlow;
                      final posters = _columns[colIndex % _columns.length];
                      final fullList = [...posters, ...posters, ...posters];
                      final double loopHeight = posters.length * singleItemStride;

                      return Container(
                        width: colWidth,
                        height: constraints.maxHeight,
                        margin: EdgeInsets.only(
                          right: colIndex < colCount - 1 ? spacing : 0,
                        ),
                        clipBehavior: Clip.antiAlias,
                        decoration: const BoxDecoration(
                          borderRadius: BorderRadius.zero,
                        ),
                        child: AnimatedBuilder(
                          animation: controller,
                          builder: (context, child) {
                            final progress = controller.value;
                            final double offsetY = isDown
                                ? -(1.0 - progress) * loopHeight
                                : -progress * loopHeight;

                            return Transform.translate(
                              offset: Offset(0, offsetY),
                              child: OverflowBox(
                                alignment: Alignment.topCenter,
                                minHeight: 0,
                                maxHeight: double.infinity,
                                minWidth: 0,
                                maxWidth: colWidth,
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: fullList.map((url) {
                                    return Container(
                                      width: colWidth,
                                      height: itemHeight,
                                      margin: const EdgeInsets.only(bottom: spacing),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(8),
                                        color: const Color(0xFF18181B),
                                      ),
                                      clipBehavior: Clip.antiAlias,
                                      child: CachedNetworkImage(
                                        imageUrl: url,
                                        fit: BoxFit.cover,
                                        placeholder: (context, url) => Container(
                                          color: const Color(0xFF18181B),
                                        ),
                                        errorWidget: (context, url, error) => Container(
                                          color: const Color(0xFF18181B),
                                        ),
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ),
                            );
                          },
                        ),
                      );
                    }),
                  ),
                );
              },
            ),
          ),
        ),

        // ── 2. Light Cinematic Overlay Gradients (posters remain clearly visible) ──
        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0x88060608), // Top subtle darkening for status bar
                  Color(0x44060608), // Center semi-transparent
                  Color(0xAA060608), // Bottom soft gradient
                ],
                stops: [0.0, 0.45, 1.0],
              ),
            ),
          ),
        ),

        Positioned.fill(
          child: Container(
            decoration: const BoxDecoration(
              gradient: RadialGradient(
                center: Alignment.center,
                radius: 1.2,
                colors: [
                  Colors.transparent,
                  Color(0x44060608),
                  Color(0x88060608),
                ],
                stops: [0.2, 0.7, 1.0],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../auth/presentation/social_login_buttons.dart';
import 'logo_mark.dart';
import 'welcome_illustrations.dart';

/// Primera pantalla para usuarios sin sesión (ruta `/login`).
///
/// Arranca con el logo exactamente donde lo deja el último frame del splash
/// (`assets/animations/splash.json`, 390x844 en `BoxFit.cover`) y lo lleva
/// al encabezado; después entran las tres slides y el área de login social.
/// Con `MediaQuery.disableAnimations` todo se muestra ya en su estado final.
class WelcomeScreen extends StatefulWidget {
  const WelcomeScreen({super.key});

  /// Duración del fade con el que la ruta entra sobre el splash. Mientras
  /// dura, el logo se queda quieto encima del último frame del Lottie.
  static const handoffDuration = Duration(milliseconds: 350);

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen>
    with SingleTickerProviderStateMixin {
  static final _handoffMs = WelcomeScreen.handoffDuration.inMilliseconds;
  static final _introMs = _handoffMs + 1300;

  late final AnimationController _intro =
      AnimationController(
        vsync: this,
        duration: Duration(milliseconds: _introMs),
      )..addStatusListener((status) {
        if (status == AnimationStatus.completed) {
          setState(() => _introDone = true);
        }
      });

  late final Animation<double> _landing = _interval(
    130,
    780,
    Curves.easeInOutCubic,
  );
  late final Animation<double> _illustrationIn = _interval(585, 1040);
  late final Animation<double> _textIn = _interval(715, 1170);
  late final Animation<double> _footerIn = _interval(845, 1300);

  final _pageController = PageController();
  int _page = 0;
  bool _introDone = false;
  bool _started = false;

  /// Tramo del intro en ms contados desde que termina el fade de la ruta.
  Animation<double> _interval(
    int beginMs,
    int endMs, [
    Curve curve = Curves.easeOutCubic,
  ]) => CurvedAnimation(
    parent: _intro,
    curve: Interval(
      (_handoffMs + beginMs) / _introMs,
      (_handoffMs + endMs) / _introMs,
      curve: curve,
    ),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (MediaQuery.disableAnimationsOf(context)) {
      _intro.value = 1;
    } else {
      _intro.forward();
    }
  }

  @override
  void dispose() {
    _intro.dispose();
    _pageController.dispose();
    super.dispose();
  }

  void _goTo(int page) {
    if (MediaQuery.disableAnimationsOf(context)) {
      _pageController.jumpToPage(page);
    } else {
      _pageController.animateToPage(
        page,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final slides = [
      (l10n.welcomeSlide1Title, l10n.welcomeSlide1Body),
      (l10n.welcomeSlide2Title, l10n.welcomeSlide2Body),
      (l10n.welcomeSlide3Title, l10n.welcomeSlide3Body),
    ];

    return Scaffold(
      body: LayoutBuilder(
        builder: (context, constraints) {
          final geometry = _SplashGeometry(
            screen: constraints.biggest,
            topInset: MediaQuery.paddingOf(context).top,
          );
          return Stack(
            children: [
              _SplashGlow(geometry: geometry, fade: _landing),
              SafeArea(
                child: Column(
                  children: [
                    const SizedBox(height: _SplashGeometry.headerHeight),
                    Expanded(
                      child: PageView.builder(
                        key: const Key('welcome_pages'),
                        controller: _pageController,
                        itemCount: slides.length,
                        onPageChanged: (page) => setState(() => _page = page),
                        itemBuilder: (context, index) => _Slide(
                          illustration: switch (index) {
                            0 => ChatIllustration(
                              active: _introDone && _page == 0,
                            ),
                            1 => RankingIllustration(
                              active: _introDone && _page == 1,
                            ),
                            _ => StreakIllustration(
                              active: _introDone && _page == 2,
                            ),
                          },
                          title: slides[index].$1,
                          body: slides[index].$2,
                          illustrationIn: _illustrationIn,
                          textIn: _textIn,
                        ),
                      ),
                    ),
                    _Reveal(
                      animation: _footerIn,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.screenPad,
                          AppSpacing.lg,
                          AppSpacing.screenPad,
                          AppSpacing.lg,
                        ),
                        child: Column(
                          children: [
                            _PageDots(
                              count: slides.length,
                              current: _page,
                              onTap: _goTo,
                            ),
                            const SizedBox(height: AppSpacing.xl),
                            const _PressScale(child: SocialLoginButtons()),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              _LandingLogo(geometry: geometry, progress: _landing),
            ],
          );
        },
      ),
    );
  }
}

/// Traduce coordenadas del Lottie del splash (390x844, `BoxFit.cover`) a la
/// pantalla, y define dónde termina el logo en el encabezado.
class _SplashGeometry {
  _SplashGeometry({required this.screen, required this.topInset})
    : scale = math.max(screen.width / 390, screen.height / 844) {
    origin = Offset(
      (screen.width - 390 * scale) / 2,
      (screen.height - 844 * scale) / 2,
    );
  }

  static const headerHeight = 100.0;
  static const _headerMark = 44.0;
  static const _headerFont = 26.0;
  static const _headerGap = 10.0;

  final Size screen;
  final double topInset;
  final double scale;
  late final Offset origin;

  Offset map(double x, double y) => origin + Offset(x, y) * scale;

  // Último frame del splash: isotipo de 140 en (125, 300). El paquete
  // `lottie` dibuja cada texto con la caja de `TextPainter` arriba en
  // (origen.y - tamaño de fuente), no sobre la línea de base: el wordmark
  // arranca en (89.19, 506.02 - 40).
  Rect get markStart => map(125, 300) & Size.square(140 * scale);

  Rect wordmarkStart(_WordmarkMetrics m) =>
      map(89.19, 506.02 - _WordmarkMetrics.fontSize) & m.size * scale;

  Rect markEnd(_WordmarkMetrics m) {
    final k = _headerFont / _WordmarkMetrics.fontSize;
    final width = _headerMark + _headerGap + m.size.width * k;
    final top = topInset + (headerHeight - _headerMark) / 2;
    return Rect.fromLTWH(
      (screen.width - width) / 2,
      top,
      _headerMark,
      _headerMark,
    );
  }

  Rect wordmarkEnd(_WordmarkMetrics m) {
    final k = _headerFont / _WordmarkMetrics.fontSize;
    final mark = markEnd(m);
    final size = m.size * k;
    return Rect.fromLTWH(
      mark.right + _headerGap,
      mark.center.dy - size.height / 2,
      size.width,
      size.height,
    );
  }
}

/// Un tramo de texto tal como lo dibuja el paquete `lottie`: carácter por
/// carácter (sin kerning), avanzando el ancho de cada uno más el tracking.
typedef _LottieRun = ({String text, double dx, FontWeight weight});

class _LottieText extends CustomPainter {
  _LottieText(
    this.runs, {
    required this.fontSize,
    required this.color,
    this.tracking = 0,
  });

  final List<_LottieRun> runs;
  final double fontSize;
  final Color color;

  /// Tracking del Lottie (`tr`); en px vale tr/10 * tamaño/100.
  final double tracking;

  double get _tracking => tracking / 10 * fontSize / 100;

  Iterable<(TextPainter, Offset)> _glyphs() sync* {
    for (final run in runs) {
      var x = run.dx;
      for (final char in run.text.characters) {
        final painter = TextPainter(
          text: TextSpan(
            text: char,
            style: TextStyle(
              fontFamily: 'PlusJakartaSans',
              fontSize: fontSize,
              fontWeight: run.weight,
              color: color,
            ),
          ),
          textDirection: TextDirection.ltr,
        )..layout();
        final offset = Offset(x, 0);
        x += painter.width + _tracking;
        yield (painter, offset);
      }
    }
  }

  Size measure() {
    var size = Size.zero;
    for (final (painter, offset) in _glyphs()) {
      size = Size(
        math.max(size.width, offset.dx + painter.width),
        math.max(size.height, painter.height),
      );
      painter.dispose();
    }
    return size;
  }

  @override
  void paint(Canvas canvas, Size size) {
    for (final (painter, offset) in _glyphs()) {
      painter.paint(canvas, offset);
      painter.dispose();
    }
  }

  @override
  bool shouldRepaint(_LottieText oldDelegate) => false;
}

/// "openfluent" del último frame del splash: "fluent" arranca 96.70 px
/// después de "open" (89.19 y 185.89 en el Lottie).
final _wordmark = _LottieText(
  const [
    (text: 'open', dx: 0, weight: FontWeight.w500),
    (text: 'fluent', dx: 96.70, weight: FontWeight.w800),
  ],
  fontSize: _WordmarkMetrics.fontSize,
  color: AppColors.primaryDark,
  tracking: -1,
);

class _WordmarkMetrics {
  _WordmarkMetrics() : size = _wordmark.measure();

  static const fontSize = 40.0;

  final Size size;
}

/// Isotipo + wordmark que "aterrizan" del centro (splash) al encabezado.
class _LandingLogo extends StatelessWidget {
  const _LandingLogo({required this.geometry, required this.progress});

  final _SplashGeometry geometry;
  final Animation<double> progress;

  @override
  Widget build(BuildContext context) {
    final metrics = _WordmarkMetrics();
    final markFrom = geometry.markStart;
    final markTo = geometry.markEnd(metrics);
    final wordFrom = geometry.wordmarkStart(metrics);
    final wordTo = geometry.wordmarkEnd(metrics);
    return AnimatedBuilder(
      animation: progress,
      builder: (context, _) {
        final t = progress.value;
        final mark = Rect.lerp(markFrom, markTo, t)!;
        final word = Rect.lerp(wordFrom, wordTo, t)!;
        return Stack(
          children: [
            Positioned.fromRect(
              rect: mark,
              child: Semantics(
                label: AppLocalizations.of(context).appTitle,
                header: true,
                child: LogoMark(size: mark.width),
              ),
            ),
            Positioned.fromRect(
              rect: word,
              child: ExcludeSemantics(
                child: FittedBox(
                  child: SizedBox.fromSize(
                    size: metrics.size,
                    child: CustomPaint(painter: _wordmark),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

/// Resplandor teal del splash (`bg-glow`), que se apaga mientras aterriza el
/// logo.
class _SplashGlow extends StatelessWidget {
  const _SplashGlow({required this.geometry, required this.fade});

  final _SplashGeometry geometry;
  final Animation<double> fade;

  @override
  Widget build(BuildContext context) {
    final size = 550 * geometry.scale;
    return Positioned.fromRect(
      rect: Rect.fromCenter(
        center: geometry.map(195, 455),
        width: size,
        height: size,
      ),
      child: IgnorePointer(
        child: FadeTransition(
          opacity: ReverseAnimation(fade),
          child: DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: RadialGradient(
                colors: [
                  AppColors.primary.withValues(alpha: 0.1),
                  AppColors.primary.withValues(alpha: 0),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Slide extends StatelessWidget {
  const _Slide({
    required this.illustration,
    required this.title,
    required this.body,
    required this.illustrationIn,
    required this.textIn,
  });

  final Widget illustration;
  final String title;
  final String body;
  final Animation<double> illustrationIn;
  final Animation<double> textIn;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPad),
      child: LayoutBuilder(
        builder: (context, constraints) => Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Flexible(
              child: _Reveal(
                animation: illustrationIn,
                child: ExcludeSemantics(
                  // Decorativas: escalan con el espacio, no con el texto
                  // del sistema.
                  child: MediaQuery.withNoTextScaling(
                    child: FittedBox(
                      fit: BoxFit.scaleDown,
                      child: illustration,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            // Con texto grande o pantallas chicas el copy puede no entrar:
            // se queda con hasta 60 % del alto y scrollea.
            ConstrainedBox(
              constraints: BoxConstraints(
                maxHeight: constraints.maxHeight * 0.6,
              ),
              child: _Reveal(
                animation: textIn,
                child: SingleChildScrollView(
                  child: Column(
                    children: [
                      Text(
                        title,
                        textAlign: TextAlign.center,
                        style: theme.headlineMedium,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        body,
                        textAlign: TextAlign.center,
                        style: theme.bodyLarge?.copyWith(
                          color: AppColors.textSecondary,
                          height: 1.45,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Entrada escalonada: fade + subida de 24 px.
class _Reveal extends StatelessWidget {
  const _Reveal({required this.animation, required this.child});

  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(0, 0.08),
          end: Offset.zero,
        ).animate(animation),
        child: child,
      ),
    );
  }
}

class _PageDots extends StatelessWidget {
  const _PageDots({
    required this.count,
    required this.current,
    required this.onTap,
  });

  final int count;
  final int current;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final duration = MediaQuery.disableAnimationsOf(context)
        ? Duration.zero
        : const Duration(milliseconds: 250);
    return Semantics(
      label: l10n.welcomePageLabel(current + 1, count),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          for (var i = 0; i < count; i++)
            GestureDetector(
              key: Key('welcome_dot_$i'),
              behavior: HitTestBehavior.opaque,
              onTap: () => onTap(i),
              // Área táctil de 32×48 (WCAG 2.2 pide ≥24) con el punto
              // centrado; 48 de ancho separaba demasiado los puntos.
              child: SizedBox(
                width: 32,
                height: 48,
                child: Center(
                  child: AnimatedContainer(
                    duration: duration,
                    curve: Curves.easeOutCubic,
                    width: i == current ? 24 : 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: i == current
                          ? AppColors.primary
                          : AppColors.border,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Feedback de presión para los botones del área de CTA: se hunden a 0.97
/// mientras el dedo está apoyado. No intercepta el tap.
class _PressScale extends StatefulWidget {
  const _PressScale({required this.child});

  final Widget child;

  @override
  State<_PressScale> createState() => _PressScaleState();
}

class _PressScaleState extends State<_PressScale> {
  bool _pressed = false;

  void _set(bool pressed) {
    if (_pressed != pressed) setState(() => _pressed = pressed);
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: (_) => _set(true),
      onPointerUp: (_) => _set(false),
      onPointerCancel: (_) => _set(false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1,
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}

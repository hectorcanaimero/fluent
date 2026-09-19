import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Ilustraciones animadas de las slides de bienvenida. Cada una tiene un
/// tamaño de diseño fijo (la slide la escala con `FittedBox`) y reproduce su
/// animación una vez cada vez que su slide queda activa. Con
/// `MediaQuery.disableAnimations` se muestran directamente en el estado final.
abstract class _Illustration extends StatefulWidget {
  const _Illustration({super.key, required this.active});

  final bool active;

  Duration get duration;

  Widget buildFrame(BuildContext context, double t);

  @override
  State<_Illustration> createState() => _IllustrationState();
}

class _IllustrationState extends State<_Illustration>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );

  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _sync(wasActive: _initialized && widget.active);
    _initialized = true;
  }

  @override
  void didUpdateWidget(_Illustration oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync(wasActive: oldWidget.active);
  }

  void _sync({required bool wasActive}) {
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.value = 1;
    } else if (widget.active && !wasActive) {
      _controller.forward(from: 0);
    } else if (!widget.active && wasActive) {
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) => widget.buildFrame(context, _controller.value),
    );
  }
}

/// Progreso 0..1 de `t` dentro del tramo [begin, end], con curva.
double _phase(
  double t,
  double begin,
  double end, [
  Curve curve = Curves.easeOutCubic,
]) => curve.transform(((t - begin) / (end - begin)).clamp(0.0, 1.0));

/// Aparición con fade + escala desde 0.9 (o desde un desplazamiento).
Widget _pop(double p, Widget child, {Offset from = Offset.zero}) {
  return Opacity(
    opacity: p.clamp(0.0, 1.0),
    child: Transform.translate(
      offset: from * (1 - p),
      child: Transform.scale(scale: 0.9 + 0.1 * p, child: child),
    ),
  );
}

/// Texto que se "tipea" sin mover el layout: la parte aún no escrita se
/// pinta transparente.
Widget _typed(String text, double p, TextStyle style) {
  final visible = (text.length * p).round();
  return Text.rich(
    TextSpan(
      style: style,
      children: [
        TextSpan(text: text.substring(0, visible)),
        TextSpan(
          text: text.substring(visible),
          style: const TextStyle(color: Colors.transparent),
        ),
      ],
    ),
  );
}

// ---------------------------------------------------------------------------
// Slide 1: un tutor que se acuerda de vos.

class ChatIllustration extends _Illustration {
  const ChatIllustration({super.key, required super.active});

  // La conversación es de práctica en inglés, igual que en la app real.
  static const _tutor = 'Welcome back! How was your trip to Lisbon?';
  static const _user = 'I goed to the beach every day!';

  @override
  Duration get duration => const Duration(milliseconds: 3400);

  @override
  Widget buildFrame(BuildContext context, double t) {
    const bubbleText = TextStyle(
      fontSize: 15,
      fontWeight: FontWeight.w500,
      height: 1.45,
    );
    final tutorIn = _phase(t, 0, 0.1);
    final tutorTyping = _phase(t, 0.08, 0.4, Curves.linear);
    final userIn = _phase(t, 0.45, 0.55);
    final userTyping = _phase(t, 0.5, 0.72, Curves.linear);
    final correctionIn = _phase(t, 0.78, 0.95, Curves.easeOutBack);

    return SizedBox(
      width: 320,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _pop(
            tutorIn,
            from: const Offset(0, 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const CircleAvatar(
                  radius: 16,
                  backgroundColor: AppColors.primary,
                  child: Icon(
                    Icons.auto_awesome,
                    size: 16,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(width: 10),
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                      vertical: AppSpacing.md,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      border: Border.all(color: AppColors.border),
                      borderRadius: const BorderRadius.only(
                        topLeft: Radius.circular(18),
                        topRight: Radius.circular(18),
                        bottomRight: Radius.circular(18),
                        bottomLeft: Radius.circular(4),
                      ),
                    ),
                    child: _typed(
                      _tutor,
                      tutorTyping,
                      bubbleText.copyWith(color: AppColors.textPrimary),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Align(
            alignment: Alignment.centerRight,
            child: _pop(
              userIn,
              from: const Offset(0, 12),
              Container(
                constraints: const BoxConstraints(maxWidth: 250),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg,
                  vertical: AppSpacing.md,
                ),
                decoration: const BoxDecoration(
                  // `primaryDark`: blanco sobre `primary` no llega a AA (MEJ-01).
                  color: AppColors.primaryDark,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(18),
                    topRight: Radius.circular(18),
                    bottomLeft: Radius.circular(18),
                    bottomRight: Radius.circular(4),
                  ),
                ),
                child: _typed(
                  _user,
                  userTyping,
                  bubbleText.copyWith(color: Colors.white),
                ),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerRight,
            child: _pop(
              correctionIn,
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                decoration: BoxDecoration(
                  color: AppColors.goldSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.lightbulb_outline,
                      size: 16,
                      color: AppColors.goldText,
                    ),
                    SizedBox(width: AppSpacing.sm),
                    Flexible(
                      child: Text.rich(
                        TextSpan(
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.goldText,
                          ),
                          children: [
                            TextSpan(
                              text: 'I goed',
                              style: TextStyle(
                                decoration: TextDecoration.lineThrough,
                              ),
                            ),
                            TextSpan(text: '  →  '),
                            TextSpan(
                              text: 'I went',
                              style: TextStyle(fontWeight: FontWeight.w800),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Slide 2: practicá con tus amigos.

class RankingIllustration extends _Illustration {
  const RankingIllustration({super.key, required super.active});

  static const _rowHeight = 56.0;

  @override
  Duration get duration => const Duration(milliseconds: 3000);

  @override
  Widget buildFrame(BuildContext context, double t) {
    final l10n = AppLocalizations.of(context);
    // Sumás puntos y pasás del 3.º al 2.º puesto.
    final climb = _phase(t, 0.6, 0.85, Curves.easeInOutCubic);
    final yourXp = 1090 + (150 * _phase(t, 0.55, 0.8)).round();
    final rows = [
      (name: 'Camila', xp: 1320, color: AppColors.accent, from: 0.0, to: 0.0),
      (name: 'Thiago', xp: 1180, color: AppColors.gold, from: 1.0, to: 2.0),
      (
        name: l10n.welcomeRankingYou,
        xp: yourXp,
        color: AppColors.primary,
        from: 2.0,
        to: 1.0,
      ),
      (
        name: 'Lucía',
        xp: 860,
        color: AppColors.primaryDark,
        from: 3.0,
        to: 3.0,
      ),
    ];

    return Container(
      width: 320,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: SizedBox(
        height: _rowHeight * rows.length,
        child: Stack(
          children: [
            // La fila propia se dibuja al final para que pase por encima.
            for (final (i, row) in [
              for (final (i, r) in rows.indexed)
                if (i != 2) (i, r),
              (2, rows[2]),
            ])
              Positioned(
                left: 0,
                right: 0,
                top: _rowHeight * (row.from + (row.to - row.from) * climb),
                height: _rowHeight,
                child: _pop(
                  _phase(t, i * 0.1, i * 0.1 + 0.3),
                  from: const Offset(32, 0),
                  _RankingRow(
                    position: (climb < 0.5 ? row.from : row.to).round() + 1,
                    name: row.name,
                    xp: row.xp,
                    color: row.color,
                    highlighted: i == 2,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _RankingRow extends StatelessWidget {
  const _RankingRow({
    required this.position,
    required this.name,
    required this.xp,
    required this.color,
    required this.highlighted,
  });

  final int position;
  final String name;
  final int xp;
  final Color color;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 2),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      decoration: BoxDecoration(
        color: highlighted ? AppColors.primarySoft : null,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 20,
            child: Text(
              '$position',
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: AppColors.textSecondary,
              ),
            ),
          ),
          CircleAvatar(
            radius: 16,
            backgroundColor: color,
            child: Text(
              name.characters.first,
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              name,
              style: const TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          Text(
            '$xp XP',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: highlighted
                  ? AppColors.primaryDark
                  : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Slide 3: 10 minutos, dos veces al día.

class StreakIllustration extends _Illustration {
  const StreakIllustration({super.key, required super.active});

  @override
  Duration get duration => const Duration(milliseconds: 2800);

  @override
  Widget buildFrame(BuildContext context, double t) {
    final l10n = AppLocalizations.of(context);
    final flame = _phase(t, 0, 0.25, Curves.easeOutBack);
    final ring = _phase(t, 0.1, 0.65, Curves.easeInOutCubic);
    final streak = _phase(t, 0.6, 0.8, Curves.easeOutBack);

    return SizedBox(
      width: 300,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(
            dimension: 170,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned.fill(
                  child: CustomPaint(painter: _RingPainter(ring)),
                ),
                Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Transform.scale(
                        scale: flame,
                        child: const Icon(
                          Icons.local_fire_department,
                          size: 48,
                          color: AppColors.accent,
                        ),
                      ),
                      Text(
                        '${(10 * ring).round()} min',
                        style: const TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w800,
                          color: AppColors.textPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  top: -4,
                  right: -28,
                  child: _pop(
                    streak,
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.goldSoft,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                      ),
                      child: Text(
                        l10n.welcomeStreakDays(12),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          color: AppColors.goldText,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          FittedBox(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _SessionPill(
                  icon: Icons.wb_sunny_outlined,
                  label: l10n.welcomeSessionMorning,
                  done: _phase(t, 0.45, 0.6, Curves.easeOutBack),
                ),
                const SizedBox(width: AppSpacing.md),
                _SessionPill(
                  icon: Icons.nightlight_outlined,
                  label: l10n.welcomeSessionEvening,
                  done: _phase(t, 0.7, 0.85, Curves.easeOutBack),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  const _RingPainter(this.progress);

  final double progress;

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 12.0;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(
      rect,
      0,
      2 * math.pi,
      false,
      paint..color = AppColors.primarySoft,
    );
    if (progress > 0) {
      canvas.drawArc(
        rect,
        -math.pi / 2,
        2 * math.pi * progress,
        false,
        paint..color = AppColors.primary,
      );
    }
  }

  @override
  bool shouldRepaint(_RingPainter oldDelegate) =>
      oldDelegate.progress != progress;
}

class _SessionPill extends StatelessWidget {
  const _SessionPill({
    required this.icon,
    required this.label,
    required this.done,
  });

  final IconData icon;
  final String label;

  /// 0..1 (con rebote): cuánto se completó la sesión.
  final double done;

  @override
  Widget build(BuildContext context) {
    final complete = done >= 0.5;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.lg,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: complete ? AppColors.primarySoft : AppColors.surface,
        border: Border.all(
          color: complete ? AppColors.primarySoft : AppColors.border,
        ),
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: AppColors.textSecondary),
          const SizedBox(width: AppSpacing.sm),
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Transform.scale(
            scale: done.clamp(0.0, 1.2),
            child: const Icon(
              Icons.check_circle,
              size: 18,
              color: AppColors.primaryDark,
            ),
          ),
        ],
      ),
    );
  }
}

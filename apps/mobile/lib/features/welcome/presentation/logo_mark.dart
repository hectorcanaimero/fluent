import 'package:flutter/material.dart';

import '../../../app/theme.dart';

/// Isotipo de la propuesta B "Spark" (`assets/icon/logo.svg`), dibujado con
/// paths para que escale nítido sin depender de un paquete de SVG. El
/// sistema de coordenadas es el viewBox 96x96 del SVG.
class LogoMark extends StatelessWidget {
  const LogoMark({super.key, this.size = 96});

  final double size;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: const _LogoMarkPainter(),
    );
  }
}

class _LogoMarkPainter extends CustomPainter {
  const _LogoMarkPainter();

  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 96);
    canvas.drawPath(
      Path()
        ..moveTo(63.296, 44.672)
        ..relativeCubicTo(-6.912, 0.128, -13.248, 5.184, -14.272, 12.864)
        ..relativeCubicTo(-0.704, -6.592, -6.4, -12.864, -14.016, -12.864)
        ..relativeLineTo(-6.464, 0)
        ..relativeCubicTo(-7.424, 0, -14.848, 5.568, -14.848, 14.016)
        ..relativeLineTo(0, 30.016)
        ..relativeLineTo(11.264, 0)
        ..relativeCubicTo(7.552, 0, 14.72, -5.696, 14.72, -14.144)
        ..relativeLineTo(0, -0.576)
        ..relativeCubicTo(0, -3.392, 2.624, -6.656, 6.4, -6.656)
        ..relativeLineTo(16.704, 0)
        ..relativeCubicTo(6.976, 0, 12.992, -5.184, 13.952, -13.504)
        ..relativeLineTo(0, -9.152)
        ..relativeLineTo(-13.44, 0)
        ..close(),
      Paint()..color = AppColors.accent,
    );
    canvas.drawPath(
      Path()
        ..moveTo(28.736, 7.168)
        ..relativeCubicTo(-8.576, 0, -15.04, 6.72, -15.04, 14.464)
        ..relativeLineTo(0, 7.68)
        ..relativeCubicTo(0, 6.976, 5.44, 15.36, 15.424, 15.296)
        ..relativeLineTo(5.248, 0)
        ..relativeCubicTo(6.208, 0.064, 11.392, -3.648, 13.44, -9.856)
        ..relativeCubicTo(1.088, -3.52, 4.096, -5.504, 7.04, -5.504)
        ..relativeLineTo(12.992, 0)
        ..relativeCubicTo(7.552, 0, 14.464, -5.568, 14.464, -13.696)
        ..relativeLineTo(0, -8.384)
        ..relativeLineTo(-53.568, 0)
        ..close(),
      Paint()..color = AppColors.primary,
    );
    canvas.drawPath(
      Path()
        ..moveTo(49.024, 36.544)
        ..relativeCubicTo(0.448, 2.176, 1.28, 4.416, 2.496, 5.568)
        ..relativeCubicTo(1.344, 1.28, 5.12, 2.432, 5.12, 2.432)
        ..relativeCubicTo(0, 0, -4.096, 0.768, -5.696, 2.752)
        ..relativeCubicTo(-1.408, 1.856, -1.92, 4.864, -1.92, 4.864)
        ..relativeCubicTo(0, 0, -0.768, -3.776, -2.624, -5.312)
        ..relativeCubicTo(-1.664, -1.344, -4.928, -2.048, -4.928, -2.304)
        ..relativeCubicTo(3.84, -1.024, 5.376, -2.048, 6.208, -3.776)
        ..relativeCubicTo(0.768, -1.472, 1.088, -2.112, 1.344, -4.224)
        ..close(),
      Paint()..color = AppColors.gold,
    );
  }

  @override
  bool shouldRepaint(_LogoMarkPainter oldDelegate) => false;
}

import 'package:flutter/material.dart';

import '../../app/theme.dart';

/// Caja del path de la chispa, en las unidades del SVG del logo
/// (`assets/icon/logo.svg`).
const sparkSize = Size(15.168, 15.616);

/// La chispa dorada del logo (propuesta B "Spark"), con origen en la
/// esquina superior izquierda de [sparkSize].
Path buildSparkPath() => Path()
  ..moveTo(7.552, 0)
  ..relativeCubicTo(0.448, 2.176, 1.28, 4.416, 2.496, 5.568)
  ..relativeCubicTo(1.344, 1.28, 5.12, 2.432, 5.12, 2.432)
  ..relativeCubicTo(0, 0, -4.096, 0.768, -5.696, 2.752)
  ..relativeCubicTo(-1.408, 1.856, -1.92, 4.864, -1.92, 4.864)
  ..relativeCubicTo(0, 0, -0.768, -3.776, -2.624, -5.312)
  ..relativeCubicTo(-1.664, -1.344, -4.928, -2.048, -4.928, -2.304)
  ..relativeCubicTo(3.84, -1.024, 5.376, -2.048, 6.208, -3.776)
  ..relativeCubicTo(0.768, -1.472, 1.088, -2.112, 1.344, -4.224)
  ..close();

/// La chispa sola, centrada en un cuadrado de [size].
class SparkMark extends StatelessWidget {
  const SparkMark({super.key, this.size = 16, this.color = AppColors.gold});

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      size: Size.square(size),
      painter: _SparkPainter(color),
    );
  }
}

class _SparkPainter extends CustomPainter {
  const _SparkPainter(this.color);

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.height / sparkSize.height;
    canvas
      ..translate((size.width - sparkSize.width * scale) / 2, 0)
      ..scale(scale);
    canvas.drawPath(buildSparkPath(), Paint()..color = color);
  }

  @override
  bool shouldRepaint(_SparkPainter oldDelegate) => oldDelegate.color != color;
}

/// Identidad del tutor: la chispa sobre un círculo `primaryDark`. Es
/// decorativa (el texto de la burbuja ya dice quién habla).
class SparkAvatar extends StatelessWidget {
  const SparkAvatar({super.key, this.size = 32});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: const BoxDecoration(
          color: AppColors.primaryDark,
          shape: BoxShape.circle,
        ),
        alignment: Alignment.center,
        child: SparkMark(size: size / 2),
      ),
    );
  }
}

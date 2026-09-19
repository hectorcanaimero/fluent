import 'package:flutter/material.dart';

import '../../app/theme.dart';

/// MEJ-02: placeholder de carga con un "shimmer" simple (solo opacidad, sin
/// paquete nuevo) en vez del `CircularProgressIndicator` genérico — no dice
/// nada sobre la forma del contenido que está por aparecer.
class SkeletonBox extends StatefulWidget {
  const SkeletonBox({
    super.key,
    this.width,
    required this.height,
    this.borderRadius = AppRadius.md,
  });

  final double? width;
  final double height;
  final double borderRadius;

  @override
  State<SkeletonBox> createState() => _SkeletonBoxState();
}

class _SkeletonBoxState extends State<SkeletonBox>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );
  late final Animation<double> _opacity = Tween<double>(
    begin: 0.4,
    end: 1.0,
  ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Con "reducir animaciones" el placeholder queda quieto en vez de latir
    // sin fin.
    if (MediaQuery.disableAnimationsOf(context)) {
      _controller.value = 1;
    } else if (!_controller.isAnimating) {
      _controller.repeat(reverse: true);
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
      animation: _opacity,
      builder: (context, child) =>
          Opacity(opacity: _opacity.value, child: child),
      child: Container(
        width: widget.width,
        height: widget.height,
        decoration: BoxDecoration(
          color: AppColors.border,
          borderRadius: BorderRadius.circular(widget.borderRadius),
        ),
      ),
    );
  }
}

/// Fila genérica de skeleton (título corto + línea larga), reutilizada por
/// las pantallas con listas (Grupo, Memoria, Nueva sesión).
class SkeletonListTile extends StatelessWidget {
  const SkeletonListTile({super.key, this.padding});

  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding:
          padding ?? const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: const [
          Expanded(child: SkeletonBox(height: 16)),
          SizedBox(width: AppSpacing.md),
          SkeletonBox(width: 40, height: 16),
        ],
      ),
    );
  }
}

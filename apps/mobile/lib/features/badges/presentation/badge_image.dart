import 'package:flutter/material.dart';

import '../../../app/theme.dart';

/// Matriz de luminancia (Rec. 709): pasa la imagen a escala de grises.
const _grayscale = ColorFilter.matrix([
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0.2126, 0.7152, 0.0722, 0, 0, //
  0, 0, 0, 1, 0,
]);

/// Imagen de una insignia (PNG circular de 512 px en el storage). Siempre
/// ocupa [size]: mientras carga, sin red o sin URL muestra un círculo
/// neutro, así el layout no salta. Bloqueada: en gris y atenuada.
class BadgeImage extends StatelessWidget {
  const BadgeImage({
    super.key,
    required this.url,
    required this.size,
    required this.earned,
  });

  final String? url;
  final double size;
  final bool earned;

  @override
  Widget build(BuildContext context) {
    final placeholder = Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        color: AppColors.locked,
        shape: BoxShape.circle,
      ),
    );
    final url = this.url;
    final image = url == null
        ? placeholder
        : Image.network(
            url,
            width: size,
            height: size,
            fit: BoxFit.contain,
            // Cache al tamaño en pantalla, no a 512 px.
            cacheWidth: (size * MediaQuery.devicePixelRatioOf(context)).round(),
            loadingBuilder: (context, child, progress) =>
                progress == null ? child : placeholder,
            errorBuilder: (context, error, stack) => placeholder,
          );
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: size,
        child: earned
            ? image
            : Opacity(
                opacity: 0.45,
                child: ColorFiltered(
                  key: const Key('badge_locked_filter'),
                  colorFilter: _grayscale,
                  child: image,
                ),
              ),
      ),
    );
  }
}

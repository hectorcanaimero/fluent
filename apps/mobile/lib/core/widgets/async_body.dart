import 'package:flutter/material.dart';

import '../../app/theme.dart';
import '../../l10n/gen/app_localizations.dart';

/// Reemplaza el patrón `FutureBuilder` que solo mira `snapshot.hasData`
/// (MAL-09): sin esto, un error deja la pantalla girando para siempre en
/// vez de mostrar algo accionable.
class AsyncBody<T> extends StatelessWidget {
  const AsyncBody({
    super.key,
    required this.snapshot,
    required this.builder,
    required this.onRetry,
    this.skeleton,
  });

  final AsyncSnapshot<T> snapshot;
  final Widget Function(T data) builder;
  final VoidCallback onRetry;

  /// MEJ-02: skeleton por pantalla mientras carga, en vez del spinner
  /// genérico. `null` conserva el spinner (pantallas que todavía no tienen
  /// uno propio).
  final WidgetBuilder? skeleton;

  @override
  Widget build(BuildContext context) {
    // Al reintentar, FutureBuilder conserva el error anterior mientras carga
    // y sin esto se seguía mostrando. Una recarga con datos previos, en
    // cambio, los mantiene a la vista en vez de volver al skeleton.
    if (snapshot.connectionState == ConnectionState.waiting &&
        (snapshot.hasError || !snapshot.hasData)) {
      return _loading(context);
    }
    if (snapshot.hasError) {
      final l10n = AppLocalizations.of(context);
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                l10n.commonLoadErrorTitle,
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.commonLoadErrorBody,
                style: Theme.of(context).textTheme.bodySmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              ElevatedButton(onPressed: onRetry, child: Text(l10n.commonRetry)),
            ],
          ),
        ),
      );
    }
    if (!snapshot.hasData) return _loading(context);
    return builder(snapshot.data as T);
  }

  Widget _loading(BuildContext context) {
    final skeletonBuilder = skeleton;
    return skeletonBuilder != null
        ? skeletonBuilder(context)
        : const Center(child: CircularProgressIndicator());
  }
}

import '../../../core/api/models.dart';

/// Snapshot que consume la pantalla de proveedores: estado de auth (para
/// saber qué proveedores están conectados) más el catálogo de modelos.
class ProvidersData {
  const ProvidersData({
    required this.me,
    required this.catalog,
    this.statuses = const {},
  });

  final MeResponse me;
  final ModelsCatalog catalog;

  /// Detalle por proveedor (incluye crédito), de `GET
  /// /providers/:provider/status`. Solo se pide para proveedores
  /// conectados.
  final Map<String, ProviderStatusResult> statuses;

  ProviderInfo? providerInfo(String provider) {
    for (final p in me.providers) {
      if (p.provider == provider) return p;
    }
    return null;
  }

  bool isConnected(String provider) =>
      providerInfo(provider)?.status == 'active';

  /// MAL-11: con al menos un proveedor activo, la pantalla deja de ser un
  /// callejón sin salida y muestra un CTA para volver a practicar.
  bool get hasActiveProvider => me.providers.any((p) => p.status == 'active');
}

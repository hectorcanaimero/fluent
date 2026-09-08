import '../storage/token_store.dart';

/// Contrato mínimo que necesita el interceptor de refresh del [ApiClient].
/// Lo implementa `InsforgeAuthClient` (T2); mantenerlo separado evita que
/// `core/http` dependa de `features/auth`.
abstract class TokenRefresher {
  /// Intenta refrescar la sesión. Devuelve el nuevo par de tokens o `null`
  /// si el refresh falló (en ese caso quien llama debe cerrar sesión).
  Future<AuthTokens?> refresh(String refreshToken);
}

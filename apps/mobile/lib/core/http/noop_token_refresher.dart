import '../storage/token_store.dart';
import 'token_refresher.dart';

/// Refresher que nunca logra refrescar. Se usa como valor por defecto hasta
/// que T2 conecta `InsforgeAuthClient` como [TokenRefresher] real.
class NoopTokenRefresher implements TokenRefresher {
  const NoopTokenRefresher();

  @override
  Future<AuthTokens?> refresh(String refreshToken) async => null;
}

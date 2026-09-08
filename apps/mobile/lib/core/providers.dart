import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/data/auth_controller.dart';
import '../features/auth/domain/auth_state.dart';
import 'api/fake_api.dart';
import 'api/fluent_api.dart';
import 'api/http_fluent_api.dart';
import 'env.dart';
import 'http/api_client.dart';
import 'http/noop_token_refresher.dart';
import 'http/token_refresher.dart';
import 'storage/token_store.dart';

/// Providers raíz compartidos por toda la app. Cada feature agrega los
/// suyos en su propio `providers.dart` y depende de estos.
final tokenStoreProvider = Provider<TokenStore>((ref) {
  return SecureTokenStore();
});

/// T2 sobreescribe este provider con `InsforgeAuthClient`, que implementa
/// [TokenRefresher] contra InsForge. Hasta entonces no hay forma de
/// refrescar y el interceptor de [ApiClient] simplemente cierra la sesión.
final tokenRefresherProvider = Provider<TokenRefresher>((ref) {
  return const NoopTokenRefresher();
});

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(
    tokenStore: ref.watch(tokenStoreProvider),
    tokenRefresher: ref.watch(tokenRefresherProvider),
  );
});

/// La app entera depende de esta interfaz, nunca de `FakeApi` o
/// `HttpFluentApi` directamente. El toggle es `USE_FAKE_API`.
final fluentApiProvider = Provider<FluentApi>((ref) {
  if (Env.useFakeApi) {
    return FakeApi();
  }
  return HttpFluentApi(ref.watch(apiClientProvider));
});

/// `null` usa la detección del sistema. Ajustes (T8) lo cambia con un
/// `StateProvider` para dejar elegir `es` o `pt-BR` manualmente.
final localeOverrideProvider = StateProvider<Locale?>((ref) => null);

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
      return AuthController(
        tokenStore: ref.watch(tokenStoreProvider),
        api: ref.watch(fluentApiProvider),
      );
    });

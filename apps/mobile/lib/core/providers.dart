import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/data/auth_controller.dart';
import '../features/auth/data/insforge_auth_client.dart';
import '../features/auth/domain/auth_state.dart';
import '../features/providers/data/oauth_launcher.dart';
import '../features/settings/data/reminder_service.dart';
import '../features/session/data/speech_service.dart';
import '../features/session/data/tts_service.dart';
import 'api/fake_api.dart';
import 'api/fluent_api.dart';
import 'api/http_fluent_api.dart';
import 'env.dart';
import 'http/api_client.dart';
import 'http/token_refresher.dart';
import 'share/share_service.dart';
import 'storage/token_store.dart';

/// Providers raíz compartidos por toda la app. Cada feature agrega los
/// suyos en su propio `providers.dart` y depende de estos.
final tokenStoreProvider = Provider<TokenStore>((ref) {
  return SecureTokenStore();
});

/// Cliente REST de auth contra InsForge (SPEC-06 §6). Login y registro lo
/// usan directamente; también sirve de [TokenRefresher] para `ApiClient`.
final insforgeAuthClientProvider = Provider<InsforgeAuthClient>((ref) {
  return InsforgeAuthClient();
});

final tokenRefresherProvider = Provider<TokenRefresher>((ref) {
  return ref.watch(insforgeAuthClientProvider);
});

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(
    tokenStore: ref.watch(tokenStoreProvider),
    tokenRefresher: ref.watch(tokenRefresherProvider),
  );
  // Cierra el stream de `onSessionExpired` (MAL-02). En la app el cliente vive
  // lo que la app, pero los tests crean y tiran contenedores a pares.
  ref.onDispose(client.dispose);
  return client;
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

/// Si ya se mostró la pantalla explicativa de permiso de micrófono
/// (SPEC-06 §5) en esta sesión de la app. Se pide una sola vez, la
/// primera vez que se entra a `/session/new`.
final micPrimerShownProvider = StateProvider<bool>((ref) => false);

/// Abre el navegador para el PKCE de OpenRouter (SPEC-06 §7). Con
/// `USE_FAKE_API=true` se simula el login y el retorno del deep link.
final oauthLauncherProvider = Provider<OAuthLauncher>((ref) {
  if (Env.useFakeApi) {
    return FakeOAuthLauncher();
  }
  return const FlutterWebAuthOAuthLauncher();
});

/// Reconocimiento de voz (SPEC-06 §5). Con `USE_FAKE_API=true` no toca el
/// micrófono real; los tests simulan resultados con `FakeSpeechService`.
final speechServiceProvider = Provider<SpeechService>((ref) {
  if (Env.useFakeApi) {
    return FakeSpeechService();
  }
  return SpeechToTextService();
});

/// Texto a voz del tutor (SPEC-06 §5).
final ttsServiceProvider = Provider<TtsService>((ref) {
  if (Env.useFakeApi) {
    return FakeTtsService();
  }
  return FlutterTtsService();
});

/// Compartir el resumen semanal por WhatsApp (SPEC-06 §4.7).
final shareServiceProvider = Provider<ShareService>((ref) {
  return const SharePlusService();
});

/// Recordatorios locales (SPEC-06 §8). Con `USE_FAKE_API=true` no toca
/// notificaciones reales.
final reminderServiceProvider = Provider<ReminderService>((ref) {
  if (Env.useFakeApi) {
    return FakeReminderService();
  }
  return FlutterLocalNotificationsReminderService();
});

final authControllerProvider =
    StateNotifierProvider<AuthController, AuthState>((ref) {
      return AuthController(
        tokenStore: ref.watch(tokenStoreProvider),
        api: ref.watch(fluentApiProvider),
        // Revoca el refresh token en InsForge al cerrar sesión (MAL-02).
        authClient: ref.watch(insforgeAuthClientProvider),
        // Un 401 que no se pudo refrescar borra los tokens dentro de
        // `ApiClient`; sin este aviso el estado seguía en `authenticated` y
        // la app quedaba "zombi" hasta reiniciarla (MAL-02).
        sessionExpired: ref.watch(apiClientProvider).onSessionExpired,
      );
    });

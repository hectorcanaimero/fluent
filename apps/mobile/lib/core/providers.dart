import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_timezone/flutter_timezone.dart';

import '../features/auth/data/auth_controller.dart';
import '../features/auth/data/insforge_auth_client.dart';
import '../features/auth/data/social_sign_in.dart';
import '../features/auth/domain/auth_state.dart';
import '../features/providers/data/oauth_launcher.dart';
import '../features/settings/data/reminder_service.dart';
import '../features/session/data/speech_service.dart';
import '../features/session/data/tts_service.dart';
import 'api/fake_api.dart';
import 'api/fluent_api.dart';
import 'api/http_fluent_api.dart';
import 'api/models.dart';
import 'env.dart';
import 'http/api_client.dart';
import 'http/token_refresher.dart';
import 'share/share_service.dart';
import 'http/caching_token_store.dart';
import 'storage/token_store.dart';

/// Providers raíz compartidos por toda la app. Cada feature agrega los
/// suyos en su propio `providers.dart` y depende de estos.
final tokenStoreProvider = Provider<TokenStore>((ref) {
  // `CachingTokenStore` envuelve al almacén real para que `ApiClient` no vaya
  // al keychain/keystore en cada petición (MEJ-15). Tiene que ir aquí, en el
  // provider compartido: si envolviera solo dentro de `ApiClient`, las
  // escrituras de `AuthController` (login, logout) se saltarían la caché y
  // quedaría vieja.
  return CachingTokenStore(SecureTokenStore());
});

/// Cliente REST de auth contra InsForge (SPEC-06 §6). El login social lo
/// usa directamente; también sirve de [TokenRefresher] para `ApiClient`.
final insforgeAuthClientProvider = Provider<InsforgeAuthClient>((ref) {
  return InsforgeAuthClient();
});

final socialSignInProvider = Provider<SocialSignIn>((ref) {
  if (Env.useFakeApi) return FakeSocialSignIn();
  return InsforgeSocialSignIn(
    authClient: ref.watch(insforgeAuthClientProvider),
    launcher: ref.watch(oauthLauncherProvider),
  );
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

/// Pasa a `true` cuando la animación del splash terminó su primera pasada.
/// El router no sale de `/splash` antes, para que no se corte a la mitad.
final splashDoneProvider = StateProvider<bool>((ref) => false);

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

/// Zona horaria IANA del dispositivo (MAL-12), con `'UTC'` de reserva si el
/// plugin nativo falla. Un `FutureProvider` en vez de leer el plugin
/// directo para que los tests puedan sobreescribirlo sin tocar
/// `flutter_timezone`.
final timezoneProvider = FutureProvider<String>((ref) async {
  try {
    return await FlutterTimezone.getLocalTimezone();
  } catch (_) {
    return 'UTC';
  }
});

/// MAL-13: si se puede empezar una sesión ahora mismo (hay al menos un
/// proveedor activo). Fuente única para el CTA de Home, sus chips de
/// temas rápidos y la pestaña Practicar de `HomeShell`, que antes lo
/// derivaban cada uno por su cuenta y quedaban inconsistentes. Se
/// invalida al conectar/desconectar un proveedor (`ProvidersScreen`).
final canPracticeProvider = FutureProvider<bool>((ref) async {
  final me = await ref.watch(fluentApiProvider).getMe();
  // MAL-24: sin proveedor propio, la sesión de cortesía también habilita
  // practicar — ver `HomeData.canPractice`.
  return me.hasActiveProvider || me.courtesySessionAvailable;
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

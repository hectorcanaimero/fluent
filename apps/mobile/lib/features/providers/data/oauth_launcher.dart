import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

/// Abstrae `flutter_web_auth_2` para poder simular el flujo de PKCE de
/// OpenRouter (SPEC-06 §7) en tests sin abrir un navegador real.
abstract class OAuthLauncher {
  /// Abre [url] en el navegador del sistema y espera el redirect a
  /// `$callbackUrlScheme://...`. Devuelve la URL de retorno completa.
  Future<String> authenticate({
    required String url,
    required String callbackUrlScheme,
  });
}

class FlutterWebAuthOAuthLauncher implements OAuthLauncher {
  const FlutterWebAuthOAuthLauncher();

  @override
  Future<String> authenticate({
    required String url,
    required String callbackUrlScheme,
  }) {
    return FlutterWebAuth2.authenticate(
      url: url,
      callbackUrlScheme: callbackUrlScheme,
    );
  }
}

/// Simula el deep link de retorno del PKCE de OpenRouter (SPEC-02 §(PKCE),
/// contrato tras MAL-18), sin abrir nada. Se usa con `USE_FAKE_API` y en
/// tests.
class FakeOAuthLauncher implements OAuthLauncher {
  /// `'done'` simula `?done=1` (éxito, el caso por defecto); `'error'`
  /// simula `?error=access_denied`; cualquier otro valor se manda tal cual
  /// como query string, para simular un deep link sin `done` ni `error`.
  FakeOAuthLauncher({this.result = 'done'});

  final String result;

  @override
  Future<String> authenticate({
    required String url,
    required String callbackUrlScheme,
  }) async {
    return switch (result) {
      'done' => '$callbackUrlScheme://oauth/openrouter?done=1',
      'error' => '$callbackUrlScheme://oauth/openrouter?error=access_denied',
      _ => '$callbackUrlScheme://oauth/openrouter?$result',
    };
  }
}

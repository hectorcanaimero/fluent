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

/// Simula un login exitoso devolviendo el deep link de retorno
/// directamente, sin abrir nada. Se usa con `USE_FAKE_API` y en tests.
class FakeOAuthLauncher implements OAuthLauncher {
  FakeOAuthLauncher({this.code = 'fake-authorization-code'});

  final String code;

  @override
  Future<String> authenticate({
    required String url,
    required String callbackUrlScheme,
  }) async {
    return '$callbackUrlScheme://oauth/openrouter?code=$code';
  }
}

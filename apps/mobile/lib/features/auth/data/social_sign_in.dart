import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../../../core/env.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/storage/token_store.dart';
import '../../providers/data/oauth_launcher.dart';
import 'insforge_auth_client.dart';

enum SocialProvider { google, apple }

abstract class SocialSignIn {
  /// `null` si el usuario cerró el navegador sin terminar.
  Future<AuthTokens?> signIn(SocialProvider provider);
}

/// Login social por OAuth + PKCE contra InsForge: pide la URL del
/// proveedor, la abre en el navegador del sistema, espera el redirect con
/// `insforge_code` y lo canjea por la sesión.
class InsforgeSocialSignIn implements SocialSignIn {
  InsforgeSocialSignIn({
    required InsforgeAuthClient authClient,
    required OAuthLauncher launcher,
    Random? random,
  }) : _authClient = authClient,
       _launcher = launcher,
       _random = random ?? Random.secure();

  final InsforgeAuthClient _authClient;
  final OAuthLauncher _launcher;
  final Random _random;

  /// En web el popup vuelve a `auth.html` (mismo origen), que le pasa la URL
  /// a `flutter_web_auth_2`; en móvil vuelve al deep link de la app.
  static String get redirectUri => kIsWeb
      ? '${Uri.base.origin}/auth.html'
      : '${Env.oauthCallbackScheme}://oauth/insforge';

  @override
  Future<AuthTokens?> signIn(SocialProvider provider) async {
    final verifier = _codeVerifier();
    final authUrl = await _authClient.oauthAuthUrl(
      provider: provider.name,
      redirectUri: redirectUri,
      codeChallenge: codeChallengeFor(verifier),
    );

    final String result;
    try {
      result = await _launcher.authenticate(
        url: authUrl,
        callbackUrlScheme: kIsWeb ? 'https' : Env.oauthCallbackScheme,
      );
    } on PlatformException catch (e) {
      if (e.code == 'CANCELED') return null;
      rethrow;
    }

    final params = Uri.parse(result).queryParameters;
    final code = params['insforge_code'];
    if (code == null) {
      throw ApiException(
        code: ApiErrorCode.unauthenticated,
        message: params['error'] ?? 'oauth sign-in failed',
        statusCode: null,
      );
    }
    return _authClient.exchangeOAuthCode(code: code, codeVerifier: verifier);
  }

  /// RFC 7636: 32 bytes aleatorios en base64url sin padding (43 caracteres).
  String _codeVerifier() {
    final bytes = List<int>.generate(32, (_) => _random.nextInt(256));
    return base64UrlEncode(bytes).replaceAll('=', '');
  }

  @visibleForTesting
  static String codeChallengeFor(String verifier) =>
      base64UrlEncode(sha256.convert(ascii.encode(verifier)).bytes)
          .replaceAll('=', '');
}

/// Con `USE_FAKE_API` entra directo, sin navegador ni InsForge.
class FakeSocialSignIn implements SocialSignIn {
  @override
  Future<AuthTokens?> signIn(SocialProvider provider) async =>
      const AuthTokens(accessToken: 'fake-access', refreshToken: 'fake-refresh');
}

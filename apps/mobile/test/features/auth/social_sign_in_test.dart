import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/data/insforge_auth_client.dart';
import 'package:fluent_mobile/features/auth/data/social_sign_in.dart';
import 'package:fluent_mobile/features/auth/data/oauth_launcher.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeClient extends InsforgeAuthClient {
  _FakeClient() : super(anonKey: 'k', baseUrl: 'https://insforge.local');

  String? challenge;
  String? verifier;

  @override
  Future<String> oauthAuthUrl({
    required String provider,
    required String redirectUri,
    required String codeChallenge,
  }) async {
    challenge = codeChallenge;
    return 'https://accounts.google.com/auth';
  }

  @override
  Future<AuthTokens> exchangeOAuthCode({
    required String code,
    required String codeVerifier,
  }) async {
    verifier = codeVerifier;
    return AuthTokens(accessToken: 'access-$code', refreshToken: 'refresh');
  }
}

class _Launcher implements OAuthLauncher {
  _Launcher(this.respond);
  final Future<String> Function() respond;

  @override
  Future<String> authenticate({
    required String url,
    required String callbackUrlScheme,
  }) => respond();
}

void main() {
  test('code challenge = base64url(sha256(verifier)) sin padding', () {
    expect(
      InsforgeSocialSignIn.codeChallengeFor(
        'dBjftJeZ4CVP-mJ92K1lTRjc6BAPuRTNQzKuoCk7uNM',
      ),
      // Calculado aparte con hashlib + base64.urlsafe_b64encode de Python.
      'bJj3Ip_NKklaRlldc91kbk6iarONbsnxd_YcWvpmC2U',
    );
  });

  test(
    'canjea insforge_code con el verifier que corresponde al challenge',
    () async {
      final client = _FakeClient();
      final signIn = InsforgeSocialSignIn(
        authClient: client,
        launcher: _Launcher(
          () async => 'fluent://oauth/insforge?insforge_code=abc',
        ),
      );

      final tokens = await signIn.signIn(SocialProvider.google);

      expect(tokens?.accessToken, 'access-abc');
      expect(
        InsforgeSocialSignIn.codeChallengeFor(client.verifier!),
        client.challenge,
      );
    },
  );

  test('cerrar el navegador devuelve null, no un error', () async {
    final signIn = InsforgeSocialSignIn(
      authClient: _FakeClient(),
      launcher: _Launcher(
        () async => throw PlatformException(code: 'CANCELED'),
      ),
    );

    expect(await signIn.signIn(SocialProvider.google), isNull);
  });

  test('un redirect con ?error lanza ApiException', () async {
    final signIn = InsforgeSocialSignIn(
      authClient: _FakeClient(),
      launcher: _Launcher(
        () async => 'fluent://oauth/insforge?error=access_denied',
      ),
    );

    expect(
      () => signIn.signIn(SocialProvider.google),
      throwsA(isA<ApiException>()),
    );
  });
}

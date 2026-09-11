import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/fluent_api.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/data/auth_controller.dart';
import 'package:fluent_mobile/features/auth/data/insforge_auth_client.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

const _tokens = AuthTokens(accessToken: 'access-1', refreshToken: 'refresh-1');

/// `InsforgeAuthClient` que anota los logout remotos que recibe.
class _RecordingAuthClient extends InsforgeAuthClient {
  _RecordingAuthClient({required Dio dio, this.fails = false}) : super(dio: dio);

  final bool fails;
  final List<String> logouts = [];

  @override
  Future<void> logout(String accessToken) async {
    logouts.add(accessToken);
    if (fails) throw DioException(requestOptions: RequestOptions(path: '/'));
  }
}

_RecordingAuthClient _authClient({bool fails = false}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://insforge.local'));
  dio.httpClientAdapter = DioAdapter(dio: dio);
  return _RecordingAuthClient(dio: dio, fails: fails);
}

AuthController _controller({
  required TokenStore tokenStore,
  FluentApi? api,
  InsforgeAuthClient? authClient,
  Stream<void>? sessionExpired,
}) {
  return AuthController(
    tokenStore: tokenStore,
    api: api ?? FakeApi(artificialDelay: Duration.zero),
    authClient: authClient,
    sessionExpired: sessionExpired,
  );
}

void main() {
  group('AuthController · sesión expirada (MAL-02)', () {
    test('el aviso de ApiClient pasa el estado a unauthenticated', () async {
      final store = InMemoryTokenStore()..write(_tokens);
      final expired = StreamController<void>.broadcast();
      final controller = _controller(
        tokenStore: store,
        sessionExpired: expired.stream,
      );
      addTearDown(() {
        controller.dispose();
        expired.close();
      });

      await controller.bootstrap();
      expect(controller.state.status, AuthStatus.authenticated);

      expired.add(null);
      await Future<void>.delayed(Duration.zero);

      expect(controller.state.status, AuthStatus.unauthenticated);
    });

    test('sin suscripción el controlador sigue funcionando', () async {
      final controller = _controller(tokenStore: InMemoryTokenStore());
      addTearDown(controller.dispose);

      await controller.bootstrap();

      expect(controller.state.status, AuthStatus.unauthenticated);
    });
  });

  group('AuthController · logout remoto (MAL-02)', () {
    test('revoca el token en InsForge antes de borrarlo', () async {
      final store = InMemoryTokenStore()..write(_tokens);
      final client = _authClient();
      final controller = _controller(tokenStore: store, authClient: client);
      addTearDown(controller.dispose);

      await controller.logout();

      expect(client.logouts, [_tokens.accessToken]);
      expect(await store.read(), isNull);
      expect(controller.state.status, AuthStatus.unauthenticated);
    });

    test('sin tokens guardados no llama al logout remoto', () async {
      final client = _authClient();
      final controller = _controller(
        tokenStore: InMemoryTokenStore(),
        authClient: client,
      );
      addTearDown(controller.dispose);

      await controller.logout();

      expect(client.logouts, isEmpty);
      expect(controller.state.status, AuthStatus.unauthenticated);
    });
  });
}

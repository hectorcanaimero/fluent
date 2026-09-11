import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/fluent_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/data/auth_controller.dart';
import 'package:fluent_mobile/features/auth/data/insforge_auth_client.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

const _tokens = AuthTokens(accessToken: 'access-1', refreshToken: 'refresh-1');

/// `FluentApi` que falla `getMe()` con lo que se le indique.
class _FailingMeApi extends FakeApi {
  _FailingMeApi(this.error) : super(artificialDelay: Duration.zero);

  final Object error;

  @override
  Future<MeResponse> getMe() async => throw error;
}

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

  group('AuthController · arranque sin red (MAL-03)', () {
    test('un 401 sí borra los tokens y manda a unauthenticated', () async {
      final store = InMemoryTokenStore()..write(_tokens);
      final controller = _controller(
        tokenStore: store,
        api: _FailingMeApi(
          const ApiException(
            code: ApiErrorCode.unauthenticated,
            message: 'token vencido',
            statusCode: 401,
          ),
        ),
      );
      addTearDown(controller.dispose);

      await controller.bootstrap();

      expect(controller.state.status, AuthStatus.unauthenticated);
      expect(await store.read(), isNull);
    });

    test('un error de red conserva los tokens y deja el estado en error', () async {
      final store = InMemoryTokenStore()..write(_tokens);
      final controller = _controller(
        tokenStore: store,
        api: _FailingMeApi(
          const ApiException(
            code: ApiErrorCode.unknown,
            message: 'network error',
            statusCode: null,
          ),
        ),
      );
      addTearDown(controller.dispose);

      await controller.bootstrap();

      expect(controller.state.status, AuthStatus.error);
      expect(await store.read(), isNotNull);
    });

    test('un 500 tampoco cierra la sesión', () async {
      final store = InMemoryTokenStore()..write(_tokens);
      final controller = _controller(
        tokenStore: store,
        api: _FailingMeApi(
          const ApiException(
            code: ApiErrorCode.internal,
            message: 'boom',
            statusCode: 500,
          ),
        ),
      );
      addTearDown(controller.dispose);

      await controller.bootstrap();

      expect(controller.state.status, AuthStatus.error);
      expect(await store.read(), isNotNull);
    });

    test('una excepción que no es ApiException tampoco cierra la sesión', () async {
      final store = InMemoryTokenStore()..write(_tokens);
      final controller = _controller(
        tokenStore: store,
        api: _FailingMeApi(StateError('inesperado')),
      );
      addTearDown(controller.dispose);

      await controller.bootstrap();

      expect(controller.state.status, AuthStatus.error);
      expect(await store.read(), isNotNull);
    });

    test('retry() vuelve a intentar y recupera la sesión', () async {
      final store = InMemoryTokenStore()..write(_tokens);
      var failing = true;
      final controller = AuthController(
        tokenStore: store,
        api: _ToggleMeApi(() => failing),
      );
      addTearDown(controller.dispose);

      await controller.bootstrap();
      expect(controller.state.status, AuthStatus.error);

      failing = false;
      await controller.retry();

      expect(controller.state.status, AuthStatus.authenticated);
    });
  });

  group('AuthController · limpiar la sesión activa (MAL-04)', () {
    test('clearActiveSession borra el id que coincide', () async {
      final store = InMemoryTokenStore()..write(_tokens);
      final controller = _controller(tokenStore: store);
      addTearDown(controller.dispose);

      await controller.bootstrap();
      controller.state = controller.state.copyWith(activeSessionId: 's-1');

      controller.clearActiveSession('s-1');

      expect(controller.state.activeSessionId, isNull);
    });

    test('no borra una sesión activa distinta', () async {
      final store = InMemoryTokenStore()..write(_tokens);
      final controller = _controller(tokenStore: store);
      addTearDown(controller.dispose);

      await controller.bootstrap();
      controller.state = controller.state.copyWith(activeSessionId: 's-2');

      controller.clearActiveSession('s-1');

      expect(controller.state.activeSessionId, 's-2');
    });
  });
}

/// `getMe()` falla o no según el interruptor que se le pase.
class _ToggleMeApi extends FakeApi {
  _ToggleMeApi(this.shouldFail) : super(artificialDelay: Duration.zero);

  final bool Function() shouldFail;

  @override
  Future<MeResponse> getMe() {
    if (shouldFail()) {
      return Future.error(
        const ApiException(
          code: ApiErrorCode.unknown,
          message: 'network error',
          statusCode: null,
        ),
      );
    }
    return super.getMe();
  }
}

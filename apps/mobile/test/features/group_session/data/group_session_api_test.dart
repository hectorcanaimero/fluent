import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/http/api_client.dart';
import 'package:fluent_mobile/core/http/token_refresher.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/group_session/data/group_session_api.dart';
import 'package:fluent_mobile/features/group_session/domain/group_session_exception.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

class _NullTokenRefresher implements TokenRefresher {
  @override
  Future<AuthTokens?> refresh(String refreshToken) async => null;
}

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late GroupSessionApi api;

  setUp(() async {
    dio = Dio(BaseOptions(baseUrl: 'https://fluent-api.local/v1'));
    adapter = DioAdapter(dio: dio);
    dio.httpClientAdapter = adapter;
    final tokenStore = InMemoryTokenStore();
    await tokenStore.write(const AuthTokens(accessToken: 'access-1', refreshToken: 'refresh-1'));
    final client = ApiClient(tokenStore: tokenStore, tokenRefresher: _NullTokenRefresher(), dio: dio);
    api = GroupSessionApi(client);
  });

  test('GET group-sessions/active con 204 devuelve null', () async {
    adapter.onGet('/group-sessions/active', (server) => server.reply(204, null));

    expect(await api.active(), isNull);
  });

  test('GET group-sessions/:id arma GroupSessionDetailDto', () async {
    adapter.onGet(
      '/group-sessions/gs-1',
      (server) => server.reply(200, {
        'id': 'gs-1',
        'kind': 'free_topic',
        'topic': 'Travel',
        'initiator': {'id': 'u-1', 'name': 'Ana'},
        'status': 'active',
        'startedAt': '2026-01-01T10:00:00.000Z',
        'endsAt': '2026-01-01T10:30:00.000Z',
        'participants': <Map<String, dynamic>>[],
        'messages': <Map<String, dynamic>>[],
        'corrections': <Map<String, dynamic>>[],
      }),
    );

    final detail = await api.detail('gs-1');

    expect(detail.id, 'gs-1');
    expect(detail.status, 'active');
  });

  test('POST group-sessions/:id/messages manda text y clientId', () async {
    adapter.onPost(
      '/group-sessions/gs-1/messages',
      (server) => server.reply(201, {
        'id': 7,
        'role': 'user',
        'authorId': 'u-1',
        'text': 'hi',
        'hasAudio': false,
        'createdAt': '2026-01-01T10:01:00.000Z',
        'clientId': 'client-1',
      }),
      data: {'text': 'hi', 'clientId': 'client-1'},
    );

    final message = await api.sendMessage(sessionId: 'gs-1', text: 'hi', clientId: 'client-1');

    expect(message.id, 7);
    expect(message.clientId, 'client-1');
  });

  // docs/arch/002-sesion-grupal.md §Interfaces: los 4 códigos propios de la
  // sala. `GROUP_SESSION_ACTIVE` además trae el id de la sala ya activa.
  test('POST group-sessions con 409 GROUP_SESSION_ACTIVE devuelve el id existente', () async {
    adapter.onPost(
      '/group-sessions',
      (server) => server.reply(409, {
        'error': 'GROUP_SESSION_ACTIVE',
        'message': 'already active',
        'statusCode': 409,
        'sessionId': 'gs-existing',
      }),
      data: Matchers.any,
    );

    await expectLater(
      () => api.start(kind: 'free_topic'),
      throwsA(
        isA<GroupSessionException>()
            .having((e) => e.code, 'code', GroupSessionErrorCode.active)
            .having((e) => e.sessionId, 'sessionId', 'gs-existing'),
      ),
    );
  });

  test('POST group-sessions/:id/messages con 409 GROUP_SESSION_ENDED', () async {
    adapter.onPost(
      '/group-sessions/gs-1/messages',
      (server) => server.reply(409, {'error': 'GROUP_SESSION_ENDED', 'message': 'ended', 'statusCode': 409}),
      data: Matchers.any,
    );

    await expectLater(
      () => api.sendMessage(sessionId: 'gs-1', text: 'hi', clientId: 'client-1'),
      throwsA(isA<GroupSessionException>().having((e) => e.code, 'code', GroupSessionErrorCode.ended)),
    );
  });

  test('POST group-sessions/:id/join con 403 NOT_PARTICIPANT', () async {
    adapter.onPost(
      '/group-sessions/gs-1/join',
      (server) => server.reply(403, {'error': 'NOT_PARTICIPANT', 'message': 'not a participant', 'statusCode': 403}),
    );

    await expectLater(
      () => api.join('gs-1'),
      throwsA(isA<GroupSessionException>().having((e) => e.code, 'code', GroupSessionErrorCode.notParticipant)),
    );
  });

  test('POST group-sessions/:id/end con 403 GROUP_SESSION_FORBIDDEN', () async {
    adapter.onPost(
      '/group-sessions/gs-1/end',
      (server) => server.reply(403, {'error': 'GROUP_SESSION_FORBIDDEN', 'message': 'forbidden', 'statusCode': 403}),
    );

    await expectLater(
      () => api.end('gs-1'),
      throwsA(isA<GroupSessionException>().having((e) => e.code, 'code', GroupSessionErrorCode.forbidden)),
    );
  });
}

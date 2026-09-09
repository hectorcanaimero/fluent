import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/api/http_fluent_api.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/http/api_client.dart';
import 'package:fluent_mobile/core/http/token_refresher.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

/// Nunca refresca de verdad: ningún test de este archivo provoca un `401`.
class _NullTokenRefresher implements TokenRefresher {
  @override
  Future<AuthTokens?> refresh(String refreshToken) async => null;
}

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late HttpFluentApi api;

  setUp(() async {
    dio = Dio(BaseOptions(baseUrl: 'https://fluent-api.local/v1'));
    adapter = DioAdapter(dio: dio);
    dio.httpClientAdapter = adapter;
    final tokenStore = InMemoryTokenStore();
    await tokenStore.write(const AuthTokens(accessToken: 'access-1', refreshToken: 'refresh-1'));
    final client = ApiClient(
      tokenStore: tokenStore,
      tokenRefresher: _NullTokenRefresher(),
      dio: dio,
    );
    api = HttpFluentApi(client);
  });

  // SPEC-02 §4.3 / SPEC-04 §7.
  test('GET /sessions/suggestions parsea topics, roleplays, news y bossPending', () async {
    adapter.onGet(
      '/sessions/suggestions',
      (server) => server.reply(200, {
        'topics': ['Your last trip', 'A movie you loved'],
        'roleplays': [
          {'id': 'roleplay-airport', 'title': 'Checking in at the airport'},
        ],
        'news': [
          {
            'id': 'news-1',
            'title': 'Cities expand bike lanes',
            'source': 'The Guardian',
            'summary': 'More cities...',
            'time': '20 min ago',
          },
        ],
        'bossPending': true,
      }),
    );

    final result = await api.getSessionSuggestions();

    expect(result.topics, ['Your last trip', 'A movie you loved']);
    expect(result.roleplays.single.id, 'roleplay-airport');
    expect(result.news.single.source, 'The Guardian');
    expect(result.bossPending, isTrue);
  });

  // SPEC-02 §4.3, SPEC-04 §3: POST /sessions con los DTOs reales.
  test('POST /sessions manda kind/topic y parsea session+opening', () async {
    Map<String, dynamic>? sentBody;
    adapter.onPost(
      '/sessions',
      (server) => server.replyCallback(201, (options) {
        sentBody = options.data as Map<String, dynamic>;
        return {
          'session': {
            'id': 'session-1',
            'kind': 'free_topic',
            'topic': 'Travel',
            'startedAt': '2026-09-08T10:00:00.000Z',
            'endedAt': null,
            'xpEarned': 0,
            'modelUsed': null,
          },
          'opening': {'text': 'Hi! Ready to talk about travel?', 'callbackUsed': false},
        };
      }),
      data: Matchers.any,
    );

    final result = await api.createSession(kind: 'free_topic', topic: 'Travel');

    expect(sentBody, {'kind': 'free_topic', 'topic': 'Travel'});
    expect(result.session.id, 'session-1');
    expect(result.session.topic, 'Travel');
    expect(result.opening.text, 'Hi! Ready to talk about travel?');
    expect(result.opening.callbackUsed, isFalse);
  });

  // SPEC-02 §6: `activeSessionId` va en el cuerpo top-level, no en `details`.
  test('POST /sessions con una sesión activa: 409 SESSION_ALREADY_ACTIVE con activeSessionId', () async {
    adapter.onPost(
      '/sessions',
      (server) => server.reply(409, {
        'error': 'SESSION_ALREADY_ACTIVE',
        'message': 'Ya tienes una sesión abierta.',
        'statusCode': 409,
        'activeSessionId': 'session-active-1',
      }),
      data: Matchers.any,
    );

    await expectLater(
      () => api.createSession(kind: 'free_topic', topic: 'Travel'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.code, 'code', ApiErrorCode.sessionAlreadyActive)
            .having((e) => e.activeSessionId, 'activeSessionId', 'session-active-1'),
      ),
    );
  });

  // SPEC-02 §4.3 y §7, SPEC-04 §4: POST /sessions/:id/turns.
  test('POST /sessions/:id/turns manda text y parsea turnIdx/reply/corrections/degraded', () async {
    Map<String, dynamic>? sentBody;
    adapter.onPost(
      '/sessions/session-1/turns',
      (server) => server.replyCallback(200, (options) {
        sentBody = options.data as Map<String, dynamic>;
        return {
          'turnIdx': 1,
          'reply': "That's interesting!",
          'corrections': [
            {
              'original': 'I go there yesterday',
              'corrected': 'I went there yesterday',
              'category': 'past_simple',
              'note': 'Usá el pasado simple.',
            },
          ],
          'modelUsed': 'openrouter/gpt-4o-mini',
          'degraded': false,
        };
      }),
      data: Matchers.any,
    );

    final result = await api.sendTurn(sessionId: 'session-1', text: 'I go there yesterday');

    expect(sentBody, {'text': 'I go there yesterday'});
    expect(result.turnIdx, 1);
    expect(result.corrections.single.category, 'past_simple');
    expect(result.degraded, isFalse);
    expect(result.unavailable, isFalse);
  });

  // SPEC-03 §6: la cadena de modelos agotada responde `200` con
  // `degraded`/`unavailable`, nunca `503 LLM_UNAVAILABLE` (ver
  // `turns.service.ts` y PEND de `docs/specs/pendientes/PR-06.md`).
  test('POST /sessions/:id/turns degradado: 200 con degraded y unavailable en true', () async {
    adapter.onPost(
      '/sessions/session-1/turns',
      (server) => server.reply(200, {
        'turnIdx': 1,
        'reply': 'Sorry, I lost my train of thought. Could you say that again?',
        'corrections': <Map<String, dynamic>>[],
        'modelUsed': null,
        'degraded': true,
        'unavailable': true,
      }),
      data: Matchers.any,
    );

    final result = await api.sendTurn(sessionId: 'session-1', text: 'hello');

    expect(result.degraded, isTrue);
    expect(result.unavailable, isTrue);
    expect(result.modelUsed, isNull);
    expect(result.corrections, isEmpty);
  });

  // SPEC-04 §5.
  test('POST /sessions/:id/end manda reason y parsea el resumen completo', () async {
    Map<String, dynamic>? sentBody;
    adapter.onPost(
      '/sessions/session-1/end',
      (server) => server.replyCallback(200, (options) {
        sentBody = options.data as Map<String, dynamic>;
        return {
          'summary': {
            'xpEarned': 85,
            'streak': 13,
            'isDoubleDay': true,
            'correctionsCount': 2,
            'durationSec': 580,
            'nextIsBoss': true,
          },
        };
      }),
      data: Matchers.any,
    );

    final result = await api.endSession(sessionId: 'session-1', reason: 'timer');

    expect(sentBody, {'reason': 'timer'});
    expect(result.summary.xpEarned, 85);
    expect(result.summary.isDoubleDay, isTrue);
    expect(result.summary.nextIsBoss, isTrue);
  });

  // SPEC-02 §4.3: GET /sessions con limit/cursor y nextCursor en la
  // respuesta.
  test('GET /sessions manda limit/cursor y parsea items + nextCursor', () async {
    adapter.onGet(
      '/sessions',
      (server) => server.reply(200, {
        'items': [
          {
            'id': 'session-1',
            'kind': 'free_topic',
            'topic': 'Travel',
            'startedAt': '2026-09-08T10:00:00.000Z',
            'endedAt': '2026-09-08T10:10:00.000Z',
            'xpEarned': 85,
            'modelUsed': 'openrouter/gpt-4o-mini',
          },
        ],
        'nextCursor': 'cursor-2',
      }),
      queryParameters: {'limit': 10, 'cursor': 'cursor-1'},
    );

    final result = await api.getSessions(limit: 10, cursor: 'cursor-1');

    expect(result.items.single.id, 'session-1');
    expect(result.nextCursor, 'cursor-2');
  });

  // SPEC-02 §4.3: GET /sessions/:id con turnos y correcciones.
  test('GET /sessions/:id parsea session, turns y corrections', () async {
    adapter.onGet(
      '/sessions/session-1',
      (server) => server.reply(200, {
        'session': {
          'id': 'session-1',
          'kind': 'free_topic',
          'topic': 'Travel',
          'startedAt': '2026-09-08T10:00:00.000Z',
          'endedAt': null,
          'xpEarned': 0,
          'modelUsed': null,
        },
        'turns': [
          {'idx': 0, 'role': 'tutor', 'text': 'Hi! Ready to talk about travel?'},
          {'idx': 1, 'role': 'user', 'text': 'I go there yesterday'},
        ],
        'corrections': [
          {
            'original': 'I go there yesterday',
            'corrected': 'I went there yesterday',
            'category': 'past_simple',
            'note': 'Usá el pasado simple.',
          },
        ],
      }),
    );

    final result = await api.getSession('session-1');

    expect(result.session.id, 'session-1');
    expect(result.turns, hasLength(2));
    expect(result.turns.first.role, 'tutor');
    expect(result.corrections.single.corrected, 'I went there yesterday');
  });
}

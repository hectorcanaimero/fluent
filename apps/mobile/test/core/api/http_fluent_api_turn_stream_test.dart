import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:fluent_mobile/core/api/http_fluent_api.dart';
import 'package:fluent_mobile/core/api/turn_stream_event.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/http/api_client.dart';
import 'package:fluent_mobile/core/http/token_refresher.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

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

  // SPEC-04 §4 y apps/api/src/sessions/turn-stream.ts: formato exacto de
  // los eventos SSE (`event: <nombre>\ndata: <json>\n\n`).
  test(
    'POST /sessions/:id/turns/stream parsea token, corrections y done en orden',
    () async {
      const sse =
          'event: token\n'
          'data: {"text":"Nice"}\n\n'
          'event: token\n'
          'data: {"text":" one"}\n\n'
          'event: corrections\n'
          'data: {"corrections":[]}\n\n'
          'event: done\n'
          'data: {"turnIdx":1,"reply":"Nice one","corrections":[],'
          '"modelUsed":"openrouter/gpt-4o-mini","degraded":false}\n\n';

      adapter.onPost(
        '/sessions/session-1/turns/stream',
        (server) => server.reply(
          200,
          sse,
          headers: {
            Headers.contentTypeHeader: ['text/event-stream'],
          },
        ),
        data: Matchers.any,
      );

      final events = await api
          .sendTurnStream(sessionId: 'session-1', text: 'hi')
          .toList();

      expect(events, hasLength(4));
      expect(events[0], isA<TurnStreamToken>().having((e) => e.text, 'text', 'Nice'));
      expect(events[1], isA<TurnStreamToken>().having((e) => e.text, 'text', ' one'));
      expect(events[2], isA<TurnStreamCorrections>().having((e) => e.corrections, 'corrections', isEmpty));
      final done = events[3] as TurnStreamDone;
      expect(done.result.turnIdx, 1);
      expect(done.result.reply, 'Nice one');
      expect(done.result.degraded, isFalse);
    },
  );

  // MEJ-18: el estándar SSE permite varias líneas `data:` seguidas para un
  // mismo evento, unidas con `\n` — un proxy o el propio Node puede partir
  // un JSON largo así. Concatenarlas sin separador corrompe el JSON.
  test('POST /sessions/:id/turns/stream une líneas `data:` multilínea con \\n', () async {
    const sse =
        'event: done\n'
        'data: {"turnIdx":1,"reply":"Nice one",\n'
        'data: "corrections":[],"modelUsed":"openrouter/gpt-4o-mini",\n'
        'data: "degraded":false}\n\n';

    adapter.onPost(
      '/sessions/session-1/turns/stream',
      (server) => server.reply(
        200,
        sse,
        headers: {
          Headers.contentTypeHeader: ['text/event-stream'],
        },
      ),
      data: Matchers.any,
    );

    final events = await api.sendTurnStream(sessionId: 'session-1', text: 'hi').toList();

    expect(events, hasLength(1));
    final done = events[0] as TurnStreamDone;
    expect(done.result.reply, 'Nice one');
  });

  // SPEC-03 §6 / PEND-57 de PR-04.md: si no se emitió ningún token, el
  // `reply` degradado llega igual como un único `token` antes de `done`.
  test('POST /sessions/:id/turns/stream degradado: un solo token con el reply completo', () async {
    const sse =
        'event: token\n'
        'data: {"text":"Sorry, I lost my train of thought. Could you say that again?"}\n\n'
        'event: corrections\n'
        'data: {"corrections":[]}\n\n'
        'event: done\n'
        'data: {"turnIdx":2,"reply":"Sorry, I lost my train of thought. Could you say that again?",'
        '"corrections":[],"modelUsed":null,"degraded":true,"unavailable":true}\n\n';

    adapter.onPost(
      '/sessions/session-1/turns/stream',
      (server) => server.reply(
        200,
        sse,
        headers: {
          Headers.contentTypeHeader: ['text/event-stream'],
        },
      ),
      data: Matchers.any,
    );

    final events = await api.sendTurnStream(sessionId: 'session-1', text: 'hi').toList();

    expect(events, hasLength(3));
    final done = events.last as TurnStreamDone;
    expect(done.result.degraded, isTrue);
    expect(done.result.unavailable, isTrue);
  });

  // MAL-22: la API manda `event: reset` (`llm.service.ts`, fallback en
  // streaming) antes de reintentar el turno con otro modelo. El payload
  // (`{}`) no lleva datos — es solo la señal de "descartá lo acumulado".
  test('POST /sessions/:id/turns/stream parsea el evento reset', () async {
    const sse =
        'event: token\n'
        'data: {"text":"Partial"}\n\n'
        'event: reset\n'
        'data: {}\n\n'
        'event: token\n'
        'data: {"text":"Final"}\n\n'
        'event: done\n'
        'data: {"turnIdx":1,"reply":"Final","corrections":[],'
        '"modelUsed":"openrouter/gpt-4o-mini","degraded":false}\n\n';

    adapter.onPost(
      '/sessions/session-1/turns/stream',
      (server) => server.reply(
        200,
        sse,
        headers: {
          Headers.contentTypeHeader: ['text/event-stream'],
        },
      ),
      data: Matchers.any,
    );

    final events = await api.sendTurnStream(sessionId: 'session-1', text: 'hi').toList();

    expect(events, hasLength(4));
    expect(events[0], isA<TurnStreamToken>());
    expect(events[1], isA<TurnStreamReset>());
    expect(events[2], isA<TurnStreamToken>());
    expect(events[3], isA<TurnStreamDone>());
  });

  // PEND-55 de PR-04.md: un error antes del primer evento sale como
  // respuesta JSON normal (SPEC-02 §6), no como evento SSE.
  test(
    'POST /sessions/:id/turns/stream con sesión no activa: 409 SESSION_NOT_ACTIVE antes de streamear',
    () async {
      adapter.onPost(
        '/sessions/session-1/turns/stream',
        (server) => server.reply(409, {
          'error': 'SESSION_NOT_ACTIVE',
          'message': 'La sesión no está activa.',
          'statusCode': 409,
        }),
        data: Matchers.any,
      );

      await expectLater(
        () => api.sendTurnStream(sessionId: 'session-1', text: 'hi').toList(),
        throwsA(isA<ApiException>().having((e) => e.code, 'code', ApiErrorCode.sessionNotActive)),
      );
    },
  );

  // MAL-08: un proxy/conexión colgada nunca corta el socket ni manda un
  // evento — sin un timeout, `await for` de quien consuma el stream se
  // queda esperando para siempre. `fakeAsync` avanza el reloj virtual sin
  // esperar los 30 s reales.
  test(
    'POST /sessions/:id/turns/stream: sin eventos por 30s emite streamTimeout',
    () {
      fakeAsync((async) {
        adapter.onPost(
          '/sessions/session-1/turns/stream',
          (server) => server.reply(
            200,
            'event: token\ndata: {"text":"too late"}\n\n',
            delay: const Duration(seconds: 45),
            headers: {
              Headers.contentTypeHeader: ['text/event-stream'],
            },
          ),
          data: Matchers.any,
        );

        final events = <TurnStreamEvent>[];
        api
            .sendTurnStream(sessionId: 'session-1', text: 'hi')
            .listen(events.add);

        async.elapse(const Duration(seconds: 30));

        expect(events, hasLength(1));
        final error = events.single as TurnStreamError;
        expect(error.exception.code, ApiErrorCode.streamTimeout);
      });
    },
  );
}

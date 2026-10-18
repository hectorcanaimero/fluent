import 'package:dio/dio.dart';
import 'package:fake_async/fake_async.dart';
import 'package:fluent_mobile/core/http/api_client.dart';
import 'package:fluent_mobile/core/http/token_refresher.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/group_session/data/group_room_stream.dart';
import 'package:fluent_mobile/features/group_session/data/group_session_api.dart';
import 'package:fluent_mobile/features/group_session/domain/room_event.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

class _NullTokenRefresher implements TokenRefresher {
  @override
  Future<AuthTokens?> refresh(String refreshToken) async => null;
}

const _streamHeaders = {
  Headers.contentTypeHeader: ['text/event-stream'],
};

Map<String, dynamic> _detailJson() => {
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
};

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late ApiClient client;
  late GroupSessionApi api;
  late GroupRoomStream roomStream;

  setUp(() async {
    dio = Dio(BaseOptions(baseUrl: 'https://fluent-api.local/v1'));
    adapter = DioAdapter(dio: dio);
    dio.httpClientAdapter = adapter;
    final tokenStore = InMemoryTokenStore();
    await tokenStore.write(const AuthTokens(accessToken: 'access-1', refreshToken: 'refresh-1'));
    client = ApiClient(tokenStore: tokenStore, tokenRefresher: _NullTokenRefresher(), dio: dio);
    api = GroupSessionApi(client);
    roomStream = GroupRoomStream(client, api);
  });

  test('GET group-sessions/:id/events parsea message, tutor_token, corrections, participants, ended y recap', () async {
    const sse =
        'event: message\n'
        'data: {"id":1,"role":"user","authorId":"u-1","text":"hi","hasAudio":false,"createdAt":"2026-01-01T10:00:00.000Z","clientId":"c-1"}\n\n'
        'event: tutor_token\n'
        'data: {"text":"Nice"}\n\n'
        'event: corrections\n'
        'data: {"messageId":1,"authorId":"u-1","items":[{"messageId":1,"authorId":"u-1","original":"hi","corrected":"Hi","category":"capitalization","note":"Capitalize."}]}\n\n'
        'event: participants\n'
        'data: [{"userId":"u-1","name":"Ana","active":true,"shareCorrections":false}]\n\n'
        'event: ended\n'
        'data: {"reason":"initiator","xp":[{"userId":"u-1","xp":15}]}\n\n'
        'event: recap\n'
        'data: {"topics":["travel"],"highlights":[{"userId":"u-1","quote":"Great chat."}]}\n\n';

    adapter.onGet(
      '/group-sessions/gs-1/events',
      (server) => server.reply(200, sse, headers: _streamHeaders),
    );

    final events = await roomStream.watch('gs-1').take(6).toList();

    expect(events, hasLength(6));
    expect(events[0], isA<RoomMessageEvent>().having((e) => e.message.text, 'text', 'hi'));
    expect(events[1], isA<RoomTutorTokenEvent>().having((e) => e.text, 'text', 'Nice'));
    expect(
      events[2],
      isA<RoomCorrectionsEvent>()
          .having((e) => e.messageId, 'messageId', 1)
          .having((e) => e.items, 'items', hasLength(1)),
    );
    expect(events[3], isA<RoomParticipantsEvent>().having((e) => e.participants, 'participants', hasLength(1)));
    expect(events[4], isA<RoomEndedEvent>().having((e) => e.reason, 'reason', 'initiator'));
    expect(events[5], isA<RoomRecapEvent>().having((e) => e.recap.topics, 'topics', ['travel']));
  });

  test('GET group-sessions/:id/events ignora las líneas `: ping`', () async {
    const sse =
        ': ping\n\n'
        'event: message\n'
        'data: {"id":1,"role":"system","text":"hola","hasAudio":false,"createdAt":"2026-01-01T10:00:00.000Z"}\n\n'
        ': ping\n\n';

    adapter.onGet(
      '/group-sessions/gs-1/events',
      (server) => server.reply(200, sse, headers: _streamHeaders),
    );

    final events = await roomStream.watch('gs-1').take(1).toList();

    expect(events, hasLength(1));
    expect(events.single, isA<RoomMessageEvent>());
  });

  // Si la conexión cae, `GroupRoomStream` espera el backoff (1s, 2s, 5s),
  // pide `detail()` de nuevo y reabre el stream (docs/arch/002-sesion-grupal.md).
  test('reconexión tras una caída: backoff, detail() y reapertura del stream', () {
    fakeAsync((async) {
      var eventsCalls = 0;
      var detailCalls = 0;

      adapter.onGet(
        '/group-sessions/gs-1/events',
        (server) => server.replyCallback(
          200,
          (options) {
            eventsCalls++;
            if (eventsCalls == 1) {
              // Un solo evento y la conexión se corta ahí (el servidor
              // cierra el cuerpo sin avisar: no es un error HTTP).
              return 'event: message\n'
                  'data: {"id":1,"role":"system","text":"primero","hasAudio":false,"createdAt":"2026-01-01T10:00:00.000Z"}\n\n';
            }
            return 'event: message\n'
                'data: {"id":2,"role":"system","text":"segundo","hasAudio":false,"createdAt":"2026-01-01T10:01:00.000Z"}\n\n';
          },
          headers: _streamHeaders,
        ),
      );

      adapter.onGet(
        '/group-sessions/gs-1',
        (server) => server.replyCallback(200, (options) {
          detailCalls++;
          return _detailJson();
        }),
      );

      final events = <RoomEvent>[];
      roomStream.watch('gs-1').listen(events.add);

      async.elapse(const Duration(milliseconds: 10));
      expect(events, hasLength(1), reason: 'primer evento antes de la caída');
      expect(detailCalls, 0, reason: 'todavía no pasó el backoff');

      async.elapse(const Duration(seconds: 1));
      expect(detailCalls, 1, reason: 'backoff de 1s agotado: se resincroniza con detail()');

      async.elapse(const Duration(milliseconds: 10));
      expect(events, hasLength(2), reason: 'el stream se reabrió y entregó el segundo evento');
      expect(eventsCalls, 2);
    });
  });
}

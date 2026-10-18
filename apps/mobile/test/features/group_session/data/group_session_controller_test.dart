import 'dart:async';

import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/http/api_client.dart';
import 'package:fluent_mobile/core/http/token_refresher.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/group_session/data/group_room_stream.dart';
import 'package:fluent_mobile/features/group_session/data/group_session_api.dart';
import 'package:fluent_mobile/features/group_session/data/group_session_controller.dart';
import 'package:fluent_mobile/features/group_session/domain/group_session_dto.dart';
import 'package:fluent_mobile/features/group_session/domain/room_event.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _NullTokenRefresher implements TokenRefresher {
  @override
  Future<AuthTokens?> refresh(String refreshToken) async => null;
}

ApiClient _dummyClient() =>
    ApiClient(tokenStore: InMemoryTokenStore(), tokenRefresher: _NullTokenRefresher(), dio: Dio());

GroupSessionDetailDto _detail({List<GroupMessageDto> messages = const []}) => GroupSessionDetailDto(
  id: 'gs-1',
  kind: 'free_topic',
  initiator: const GroupInitiatorDto(id: 'u-1', name: 'Ana'),
  status: 'active',
  startedAt: '2026-01-01T10:00:00.000Z',
  endsAt: '2026-01-01T10:30:00.000Z',
  participants: const [],
  messages: messages,
  corrections: const [],
);

/// Solo sobreescribe lo que usa `GroupSessionController`: `detail()` y
/// `sendMessage()`. El resto hereda del `GroupSessionApi` real, que no se
/// llega a ejecutar en estos tests.
class _FakeGroupSessionApi extends GroupSessionApi {
  _FakeGroupSessionApi() : super(_dummyClient());

  GroupSessionDetailDto? detailResult;
  var nextMessageId = 100;

  @override
  Future<GroupSessionDetailDto> detail(String sessionId) async => detailResult ?? _detail();

  @override
  Future<GroupMessageDto> sendMessage({
    required String sessionId,
    required String text,
    required String clientId,
  }) async {
    return GroupMessageDto(
      id: nextMessageId++,
      role: 'user',
      authorId: 'u-1',
      text: text,
      hasAudio: false,
      createdAt: '2026-01-01T10:02:00.000Z',
      clientId: clientId,
    );
  }
}

/// Deja inyectar eventos a mano en vez de abrir un stream SSE de verdad.
class _FakeGroupRoomStream extends GroupRoomStream {
  _FakeGroupRoomStream() : super(_dummyClient(), _FakeGroupSessionApi());

  final _controller = StreamController<RoomEvent>.broadcast();

  void emit(RoomEvent event) => _controller.add(event);

  @override
  Stream<RoomEvent> watch(String sessionId) => _controller.stream;
}

/// Deja que las continuaciones `async` ya encoladas (la de `_loadInitial`,
/// la del `listen` del stream) corran antes de leer el estado.
Future<void> _settle() => Future<void>.delayed(Duration.zero);

void main() {
  late _FakeGroupSessionApi api;
  late _FakeGroupRoomStream roomStream;
  late ProviderContainer container;

  setUp(() {
    api = _FakeGroupSessionApi();
    roomStream = _FakeGroupRoomStream();
    container = ProviderContainer(
      overrides: [
        groupSessionApiProvider.overrideWithValue(api),
        groupRoomStreamProvider.overrideWithValue(roomStream),
      ],
    );
    addTearDown(container.dispose);
  });

  test('funde el snapshot inicial con los `message` del stream, deduplicando por id', () async {
    api.detailResult = _detail(
      messages: [
        const GroupMessageDto(
          id: 1,
          role: 'system',
          text: 'Ana joined the room',
          systemEvent: 'joined',
          hasAudio: false,
          createdAt: '2026-01-01T10:00:00.000Z',
        ),
      ],
    );

    container.read(groupSessionControllerProvider('gs-1'));
    await _settle();

    roomStream.emit(
      const RoomMessageEvent(
        GroupMessageDto(
          id: 2,
          role: 'user',
          authorId: 'u-2',
          text: 'hey everyone',
          hasAudio: false,
          createdAt: '2026-01-01T10:01:00.000Z',
        ),
      ),
    );
    await _settle();

    var state = container.read(groupSessionControllerProvider('gs-1'));
    expect(state.detail!.messages.map((m) => m.id), [1, 2]);

    // El mismo mensaje (mismo `id`) llega de nuevo (p. ej. visto en
    // `detail()` y otra vez en el stream durante una reconexión): no se
    // duplica, se reemplaza en el mismo lugar.
    roomStream.emit(
      const RoomMessageEvent(
        GroupMessageDto(
          id: 2,
          role: 'user',
          authorId: 'u-2',
          text: 'hey everyone (corrected)',
          hasAudio: false,
          createdAt: '2026-01-01T10:01:00.000Z',
        ),
      ),
    );
    await _settle();

    state = container.read(groupSessionControllerProvider('gs-1'));
    expect(state.detail!.messages, hasLength(2));
    expect(state.detail!.messages[1].text, 'hey everyone (corrected)');
  });

  test('dedup por clientId: el mensaje optimista se sustituye por el confirmado', () async {
    api.detailResult = _detail();
    container.read(groupSessionControllerProvider('gs-1'));
    await _settle();

    final notifier = container.read(groupSessionControllerProvider('gs-1').notifier);
    final confirmed = await notifier.sendMessage(
      sessionId: 'gs-1',
      text: 'hi',
      authorId: 'u-1',
      clientId: 'client-1',
    );

    final state = container.read(groupSessionControllerProvider('gs-1'));
    expect(state.detail!.messages, hasLength(1));
    expect(state.detail!.messages.single.id, confirmed.id);
    expect(state.detail!.messages.single.clientId, 'client-1');
    expect(state.detail!.messages.single.text, 'hi');
  });

  test('dedup por clientId: si el `message` del stream llega primero, sustituye al optimista igual', () async {
    api.detailResult = _detail();
    container.read(groupSessionControllerProvider('gs-1'));
    await _settle();

    final notifier = container.read(groupSessionControllerProvider('gs-1').notifier);
    final sendFuture = notifier.sendMessage(
      sessionId: 'gs-1',
      text: 'hi',
      authorId: 'u-1',
      clientId: 'client-1',
    );

    // El evento del stream llega antes que la respuesta HTTP del propio
    // `sendMessage` (ambos dedupean por `clientId`, no importa quién llegue
    // primero).
    roomStream.emit(
      const RoomMessageEvent(
        GroupMessageDto(
          id: 55,
          role: 'user',
          authorId: 'u-1',
          text: 'hi',
          hasAudio: false,
          createdAt: '2026-01-01T10:02:00.000Z',
          clientId: 'client-1',
        ),
      ),
    );
    await _settle();
    await sendFuture;

    final state = container.read(groupSessionControllerProvider('gs-1'));
    expect(state.detail!.messages, hasLength(1));
    expect(state.detail!.messages.single.clientId, 'client-1');
  });

  test('acumula `tutor_token` como mensaje "en curso" y lo limpia al llegar el `message` final del tutor', () async {
    api.detailResult = _detail();
    container.read(groupSessionControllerProvider('gs-1'));
    await _settle();

    roomStream.emit(const RoomTutorTokenEvent('Nice'));
    roomStream.emit(const RoomTutorTokenEvent(' work'));
    await _settle();

    var state = container.read(groupSessionControllerProvider('gs-1'));
    expect(state.tutorDraft, 'Nice work');

    roomStream.emit(
      const RoomMessageEvent(
        GroupMessageDto(
          id: 9,
          role: 'tutor',
          text: 'Nice work',
          hasAudio: false,
          createdAt: '2026-01-01T10:03:00.000Z',
        ),
      ),
    );
    await _settle();

    state = container.read(groupSessionControllerProvider('gs-1'));
    expect(state.tutorDraft, isNull);
    expect(state.detail!.messages.single.id, 9);
  });
}

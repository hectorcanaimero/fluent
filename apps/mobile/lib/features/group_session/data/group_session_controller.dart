import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../domain/group_session_dto.dart';
import '../domain/group_session_state.dart';
import '../domain/room_event.dart';
import 'group_room_stream.dart';
import 'group_session_api.dart';

/// Guarda el estado de la sala (F6.5.T1): funde el snapshot de `detail()`
/// con los eventos del stream, deduplicando por `id` y por `clientId`, y
/// acumula el mensaje del tutor "en curso" a partir de `tutor_token`.
class GroupSessionController extends FamilyNotifier<GroupSessionState, String> {
  StreamSubscription<RoomEvent>? _eventsSub;

  @override
  GroupSessionState build(String sessionId) {
    final api = ref.watch(groupSessionApiProvider);
    final roomStream = ref.watch(groupRoomStreamProvider);

    unawaited(_loadInitial(api, sessionId));
    _eventsSub = roomStream.watch(sessionId).listen(
      _onEvent,
      onError: (Object error, StackTrace _) {
        state = state.copyWith(error: error);
      },
    );
    ref.onDispose(() => unawaited(_eventsSub?.cancel()));

    return const GroupSessionState();
  }

  Future<void> _loadInitial(GroupSessionApi api, String sessionId) async {
    try {
      final detail = await api.detail(sessionId);
      state = state.copyWith(detail: detail, loading: false);
    } catch (error) {
      state = state.copyWith(loading: false, error: error);
    }
  }

  /// Manda un mensaje propio: lo pinta optimista con [clientId] (todavía sin
  /// `id` real) y lo sustituye con la respuesta confirmada. Si el `message`
  /// del stream llega primero, el dedup de [_mergeMessage] ya lo reemplaza
  /// igual por `clientId`, así que esta sustitución es una segunda escritura
  /// idempotente, no una duplicada.
  Future<GroupMessageDto> sendMessage({
    required String sessionId,
    required String text,
    required String authorId,
    required String clientId,
  }) async {
    _mergeMessage(
      GroupMessageDto(
        id: -DateTime.now().microsecondsSinceEpoch,
        role: 'user',
        authorId: authorId,
        text: text,
        hasAudio: false,
        createdAt: DateTime.now().toUtc().toIso8601String(),
        clientId: clientId,
      ),
    );

    final confirmed = await ref
        .read(groupSessionApiProvider)
        .sendMessage(sessionId: sessionId, text: text, clientId: clientId);
    _mergeMessage(confirmed);
    return confirmed;
  }

  void _onEvent(RoomEvent event) {
    switch (event) {
      case RoomMessageEvent(message: final message):
        _mergeMessage(message);
        if (message.role == 'tutor') {
          state = state.copyWith(clearTutorDraft: true);
        }
      case RoomTutorTokenEvent(text: final text):
        state = state.copyWith(tutorDraft: (state.tutorDraft ?? '') + text);
      case RoomCorrectionsEvent(messageId: final messageId, items: final items):
        _mergeCorrections(messageId, items);
      case RoomParticipantsEvent(participants: final participants):
        _updateDetail((d) => d.copyWith(participants: participants));
      case RoomEndedEvent(xp: final xp):
        _updateDetail((d) => d.copyWith(status: 'ended', xp: xp));
      case RoomRecapEvent(recap: final recap):
        _updateDetail((d) => d.copyWith(recap: recap));
    }
  }

  void _updateDetail(
    GroupSessionDetailDto Function(GroupSessionDetailDto detail) update,
  ) {
    final detail = state.detail;
    if (detail == null) return;
    state = state.copyWith(detail: update(detail));
  }

  /// Dedup por `id` y por `clientId`: un mensaje propio optimista se
  /// sustituye al llegar el `message` con el mismo `clientId`; cualquier
  /// otro duplicado (por ejemplo, el mismo mensaje visto en `detail()` y de
  /// nuevo en el stream) se dedupea por `id`.
  void _mergeMessage(GroupMessageDto incoming) {
    final detail = state.detail;
    if (detail == null) return;

    final messages = detail.messages;
    final byClientId = incoming.clientId == null
        ? -1
        : messages.indexWhere((m) => m.clientId == incoming.clientId);
    final matchIndex = byClientId != -1
        ? byClientId
        : messages.indexWhere((m) => m.id == incoming.id);

    final updated = [...messages];
    if (matchIndex == -1) {
      updated.add(incoming);
    } else {
      updated[matchIndex] = incoming;
    }

    state = state.copyWith(detail: detail.copyWith(messages: updated));
  }

  void _mergeCorrections(int messageId, List<GroupCorrectionDto> items) {
    final detail = state.detail;
    if (detail == null) return;
    final kept = detail.corrections.where((c) => c.messageId != messageId);
    state = state.copyWith(detail: detail.copyWith(corrections: [...kept, ...items]));
  }
}

final groupSessionControllerProvider =
    NotifierProvider.family<GroupSessionController, GroupSessionState, String>(
      GroupSessionController.new,
    );

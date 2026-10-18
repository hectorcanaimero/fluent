import 'group_session_dto.dart';

/// Eventos de `GET group-sessions/:id/events` (docs/arch/002-sesion-grupal.md
/// §«Stream SSE»). Mismo formato `event:`/`data:` que
/// `apps/api/src/sessions/turn-stream.ts`; `: ping` no tiene representación
/// acá porque `GroupRoomStream` lo descarta antes de parsear.
sealed class RoomEvent {
  const RoomEvent();
}

/// Un mensaje de participante, del tutor (ya terminado) o de sistema. El
/// `message` final de un turno del tutor reemplaza el acumulado por
/// [RoomTutorTokenEvent].
final class RoomMessageEvent extends RoomEvent {
  const RoomMessageEvent(this.message);

  final GroupMessageDto message;
}

/// Delta de `reply` del tutor en curso (`{ text }`).
final class RoomTutorTokenEvent extends RoomEvent {
  const RoomTutorTokenEvent(this.text);

  final String text;
}

/// `{ messageId, authorId, items }`, filtrado por conexión en el servidor
/// según `share_corrections` del autor (FR-11/FR-12).
final class RoomCorrectionsEvent extends RoomEvent {
  const RoomCorrectionsEvent({
    required this.messageId,
    required this.authorId,
    required this.items,
  });

  final int messageId;
  final String authorId;
  final List<GroupCorrectionDto> items;
}

/// Lista completa de participantes, mandada de nuevo con cada cambio.
final class RoomParticipantsEvent extends RoomEvent {
  const RoomParticipantsEvent(this.participants);

  final List<ParticipantDto> participants;
}

/// `{ reason, xp }`: la sala terminó.
final class RoomEndedEvent extends RoomEvent {
  const RoomEndedEvent({required this.reason, required this.xp});

  final String reason;
  final List<GroupXpEntryDto> xp;
}

final class RoomRecapEvent extends RoomEvent {
  const RoomRecapEvent(this.recap);

  final GroupRecapDto recap;
}

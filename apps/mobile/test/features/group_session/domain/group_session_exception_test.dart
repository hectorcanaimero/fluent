import 'package:fluent_mobile/features/group_session/domain/group_session_exception.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // Los 4 códigos propios de `group-sessions`
  // (docs/arch/002-sesion-grupal.md §Interfaces): `GroupSessionApi` y
  // `GroupRoomStream` comparten este mapeo.

  test('GROUP_SESSION_ACTIVE: lleva el `sessionId` de la sala ya activa', () {
    final error = groupSessionErrorFromBody({
      'error': 'GROUP_SESSION_ACTIVE',
      'message': 'already active',
      'sessionId': 'gs-existing',
    });

    expect(error, isNotNull);
    expect(error!.code, GroupSessionErrorCode.active);
    expect(error.sessionId, 'gs-existing');
  });

  test('GROUP_SESSION_ENDED', () {
    final error = groupSessionErrorFromBody({'error': 'GROUP_SESSION_ENDED', 'message': 'ended'});
    expect(error?.code, GroupSessionErrorCode.ended);
    expect(error?.sessionId, isNull);
  });

  test('GROUP_SESSION_FORBIDDEN', () {
    final error = groupSessionErrorFromBody({'error': 'GROUP_SESSION_FORBIDDEN', 'message': 'forbidden'});
    expect(error?.code, GroupSessionErrorCode.forbidden);
  });

  test('NOT_PARTICIPANT', () {
    final error = groupSessionErrorFromBody({'error': 'NOT_PARTICIPANT', 'message': 'not a participant'});
    expect(error?.code, GroupSessionErrorCode.notParticipant);
  });

  test('un código ajeno a la sala grupal no se mapea (cae al genérico)', () {
    expect(groupSessionErrorFromBody({'error': 'VALIDATION', 'message': 'bad input'}), isNull);
  });

  test('sin cuerpo no se mapea', () {
    expect(groupSessionErrorFromBody(null), isNull);
  });
}

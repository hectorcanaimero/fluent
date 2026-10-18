/// Si [data] (el cuerpo `{error,message,...}` ya decodificado) trae uno de
/// los 4 códigos propios de `group-sessions`, construye la excepción
/// específica; si no, devuelve `null` y el llamador cae al mapeo genérico
/// (`ApiClient.mapDioException`). Lo usan tanto [GroupSessionApi] (donde Dio
/// ya decodificó el cuerpo) como [GroupRoomStream] (donde hay que decodificar
/// el `ResponseBody` a mano, igual que `_mapStreamDioException` en
/// `http_fluent_api.dart`).
GroupSessionException? groupSessionErrorFromBody(Map<String, dynamic>? data) {
  if (data == null) return null;
  switch (data['error'] as String?) {
    case 'GROUP_SESSION_ACTIVE':
      return GroupSessionException(
        GroupSessionErrorCode.active,
        sessionId: data['sessionId'] as String?,
      );
    case 'GROUP_SESSION_ENDED':
      return const GroupSessionException(GroupSessionErrorCode.ended);
    case 'GROUP_SESSION_FORBIDDEN':
      return const GroupSessionException(GroupSessionErrorCode.forbidden);
    case 'NOT_PARTICIPANT':
      return const GroupSessionException(GroupSessionErrorCode.notParticipant);
    default:
      return null;
  }
}

/// Códigos de error propios de `group-sessions` (docs/arch/002-sesion-grupal.md
/// §Interfaces). Son distintos de los de `ApiErrorCode` (1:1): la app no los
/// mezcla porque el texto del wire (`GROUP_SESSION_ACTIVE`, etc.) no tiene
/// equivalente ahí.
enum GroupSessionErrorCode {
  /// 409: ya hay una sala activa en el grupo; el cuerpo trae `sessionId`.
  active,

  /// 409: la sala a la que se intenta escribir/unir ya terminó.
  ended,

  /// 403: el usuario no es participante de la sala.
  notParticipant,

  /// 403: la sala no es del grupo del usuario.
  forbidden,
}

/// Lanzada por [GroupSessionApi] y [GroupRoomStream] para los cuatro códigos
/// de error específicos de la sala grupal. Cualquier otro código de la API
/// sigue llegando como `ApiException` (reutiliza `ApiClient.mapDioException`).
class GroupSessionException implements Exception {
  const GroupSessionException(this.code, {this.sessionId});

  final GroupSessionErrorCode code;

  /// Solo presente en [GroupSessionErrorCode.active]: el id de la sala que ya
  /// está activa, para que el llamador navegue directo a ella.
  final String? sessionId;

  @override
  String toString() => 'GroupSessionException($code, sessionId: $sessionId)';
}

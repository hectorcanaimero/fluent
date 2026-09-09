import '../errors/api_exception.dart';
import 'models.dart';

/// Eventos de `POST /sessions/:id/turns/stream` (SPEC-04 §4, «Streaming»).
///
/// Nombres y formas calcados de `apps/api/src/sessions/turn-stream.ts`
/// (documentado ahí como PEND-54/PEND-55/PEND-56 de
/// `docs/specs/pendientes/PR-04.md`, ver también PR-06):
/// - [TurnStreamToken]: un delta de `reply` (nunca vacío).
/// - [TurnStreamCorrections]: la lista de `TurnResult.corrections`, enviada
///   antes de `done`; la app la recibe pero no la usa para pintar nada — ver
///   PEND de `docs/specs/pendientes/PR-06.md` sobre por qué `done` basta.
/// - [TurnStreamDone]: el `TurnResult` completo. **Es la fuente de verdad**:
///   quien consuma el stream debe reemplazar cualquier texto pintado por los
///   `token` con `result.reply` al recibir este evento.
/// - [TurnStreamError]: solo puede llegar después de al menos un `token`
///   (un error anterior sale como excepción HTTP normal, nunca como evento
///   SSE); quien lo reciba debe tratar el turno como fallido.
sealed class TurnStreamEvent {
  const TurnStreamEvent();
}

final class TurnStreamToken extends TurnStreamEvent {
  const TurnStreamToken(this.text);

  final String text;
}

final class TurnStreamCorrections extends TurnStreamEvent {
  const TurnStreamCorrections(this.corrections);

  final List<Correction> corrections;
}

final class TurnStreamDone extends TurnStreamEvent {
  const TurnStreamDone(this.result);

  final TurnResult result;
}

final class TurnStreamError extends TurnStreamEvent {
  const TurnStreamError(this.exception);

  final ApiException exception;
}

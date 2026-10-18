import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/fluent_api.dart';
import '../../../core/api/models.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/providers.dart';

/// Repositorio delgado sobre [FluentApi] para el simulador de entrevistas
/// (I2, `docs/arch/003-simulador-entrevistas.md`). Sin estado propio: cada
/// método delega directo a la API; el estado vive en los providers de abajo.
class InterviewsRepository {
  InterviewsRepository(this._api);

  final FluentApi _api;

  Future<InterviewQuota> getQuota() => _api.getInterviewQuota();

  Future<InterviewDetail> create({
    required String type,
    String? offerText,
    String? offerUrl,
  }) => _api.createInterview(
    type: type,
    offerText: offerText,
    offerUrl: offerUrl,
  );

  Future<List<InterviewSummary>> list() => _api.getInterviews();

  Future<InterviewDetail> detail(String id) => _api.getInterview(id);

  Future<InterviewDetail> retry(String id) => _api.retryInterview(id);

  Future<InterviewSessionStart> startSession(String id) =>
      _api.startInterviewSession(id);

  Future<InterviewFeedback> feedback(String id) =>
      _api.getInterviewFeedback(id);

  Future<StudyCycle> createCycle(String id) => _api.createStudyCycle(id);

  Future<StudyCycle> cycle(String id) => _api.getStudyCycle(id);

  Future<InterviewSessionStart> startCycleSession({
    required String interviewId,
    required int idx,
  }) => _api.startStudyCycleSession(interviewId: interviewId, idx: idx);

  Future<InterviewDetail> reinterview(String id) => _api.reinterview(id);
}

final interviewsRepositoryProvider = Provider<InterviewsRepository>((ref) {
  return InterviewsRepository(ref.watch(fluentApiProvider));
});

/// `GET /interviews/quota` (FR-21, FR-33, IE-01).
final interviewQuotaProvider = FutureProvider.autoDispose<InterviewQuota>((
  ref,
) {
  return ref.watch(interviewsRepositoryProvider).getQuota();
});

/// Historial de entrevistas (FR-31, IE-09).
final interviewsProvider = FutureProvider.autoDispose<List<InterviewSummary>>((
  ref,
) {
  return ref.watch(interviewsRepositoryProvider).list();
});

/// `GET /interviews/:id` (IE-03, IE-04). Se repite cada 3 s mientras
/// `status` es `preparing` o `feedback_pending`: un
/// `StreamProvider.autoDispose` en vez de un `Timer` aparte en la pantalla,
/// que así no tiene que cancelarlo a mano al salir — `autoDispose` lo corta
/// solo.
///
/// Un GET fallido no corta el repolleo: se reintenta con espera creciente
/// (6 s, 12 s, 24 s, 30 s) manteniendo el último valor bueno, y el error solo
/// se muestra tras [interviewPollMaxFailures] fallos seguidos. Si falla la
/// primera carga no hay valor que mantener y el error sale enseguida.
final interviewProvider = StreamProvider.autoDispose
    .family<InterviewDetail, String>((ref, id) async* {
      final repo = ref.watch(interviewsRepositoryProvider);
      // Un `async*` cancelado sigue hasta el próximo `yield`: sin esto, al
      // salir de la pantalla se hacía un GET más tras la espera.
      var disposed = false;
      ref.onDispose(() => disposed = true);
      var hasValue = false;
      var failures = 0;
      while (true) {
        try {
          final detail = await repo.detail(id);
          hasValue = true;
          failures = 0;
          yield detail;
          if (!_pollingStatuses.contains(detail.status)) break;
        } catch (_) {
          failures++;
          if (!hasValue || failures >= interviewPollMaxFailures) rethrow;
        }
        await Future.delayed(_pollDelay(failures));
        if (disposed) return;
      }
    });

const interviewPollMaxFailures = 5;
const _pollingStatuses = {'preparing', 'feedback_pending'};

Duration _pollDelay(int failures) {
  final seconds = 3 * (1 << failures);
  return Duration(seconds: seconds > 30 ? 30 : seconds);
}

/// `GET /interviews/:id/feedback` una sola vez, cuando [interviewProvider]
/// (que ya repolla `feedback_pending` con espera creciente y se corta solo
/// con `autoDispose`) muestra que el parecer dejó de estar pendiente. Mientras
/// sigue en `feedback_pending` no se pide nada y devuelve `null` (cargando);
/// un `202` suelto también es `null`. Los errores se propagan tal cual:
/// [InterviewTooShort] (IE-06d), `404 NOT_READY` (todavía no terminó),
/// `LLM_UNAVAILABLE` (`feedback_failed`, IE-06e) o de red.
final interviewFeedbackProvider = FutureProvider.autoDispose
    .family<InterviewFeedback?, String>((ref, id) async {
      final detail = await ref.watch(interviewProvider(id).future);
      if (detail.status == 'feedback_pending') return null;
      try {
        return await ref.watch(interviewsRepositoryProvider).feedback(id);
      } on ApiException catch (e) {
        // ponytail: un 202 con la ficha ya fuera de `feedback_pending` es una
        // carrera; se queda cargando sin repollar (atrás + volver lo pide de
        // nuevo). Invalidar `interviewProvider` acá si llega a pasar en serio.
        if (e.statusCode == 202) return null;
        rethrow;
      }
    });

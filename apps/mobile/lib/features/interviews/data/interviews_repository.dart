import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/fluent_api.dart';
import '../../../core/api/models.dart';
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
  }) => _api.createInterview(type: type, offerText: offerText, offerUrl: offerUrl);

  Future<List<InterviewSummary>> list() => _api.getInterviews();

  Future<InterviewDetail> detail(String id) => _api.getInterview(id);

  Future<InterviewDetail> retry(String id) => _api.retryInterview(id);

  Future<InterviewSessionStart> startSession(String id) =>
      _api.startInterviewSession(id);

  Future<InterviewFeedback> feedback(String id) => _api.getInterviewFeedback(id);

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
/// `status == 'preparing'`: un `StreamProvider.autoDispose` en vez de un
/// `Timer` aparte en la pantalla, que así no tiene que cancelarlo a mano al
/// salir — `autoDispose` lo corta solo.
final interviewProvider = StreamProvider.autoDispose
    .family<InterviewDetail, String>((ref, id) async* {
      final repo = ref.watch(interviewsRepositoryProvider);
      while (true) {
        final detail = await repo.detail(id);
        yield detail;
        if (detail.status != 'preparing') break;
        await Future.delayed(const Duration(seconds: 3));
      }
    });

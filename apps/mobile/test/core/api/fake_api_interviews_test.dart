import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late FakeApi api;

  setUp(() {
    api = FakeApi(artificialDelay: Duration.zero);
  });

  // I2 (FR-6, IE-03): la preparación avanza paso a paso en cada GET y
  // termina en `ready` con la ficha del plan completa.
  test('la preparación avanza de reading a ready, paso por paso', () async {
    final created = await api.createInterview(type: 'technical', offerText: 'oferta');
    expect(created.status, 'preparing');
    expect(created.prepStep, 'reading');

    final researching = await api.getInterview(created.id);
    expect(researching.status, 'preparing');
    expect(researching.prepStep, 'researching');

    final designing = await api.getInterview(created.id);
    expect(designing.status, 'preparing');
    expect(designing.prepStep, 'designing');

    final ready = await api.getInterview(created.id);
    expect(ready.status, 'ready');
    expect(ready.prepStep, 'done');
    expect(ready.company?.name, isNotNull);
    expect(ready.questionCount, 8);
    expect(ready.estimatedMin, 10);
    expect(ready.competencies, isNotEmpty);

    // Una vez `ready`, pedirla de nuevo no la hace retroceder ni avanzar.
    final again = await api.getInterview(created.id);
    expect(again.status, 'ready');
    expect(again.prepStep, 'done');
  });

  test('forceInterviewPrepFailed simula IE-03b y retryInterview la reinicia', () async {
    final created = await api.createInterview(type: 'technical', offerText: 'oferta');
    api.forceInterviewPrepFailed(created.id);

    final failed = await api.getInterview(created.id);
    expect(failed.status, 'prep_failed');
    expect(failed.errorCode, isNotNull);

    final retried = await api.retryInterview(created.id);
    expect(retried.status, 'preparing');
    expect(retried.prepStep, 'reading');
    expect(retried.errorCode, isNull);
  });

  test('offerUrl de LinkedIn lanza OFFER_UNREADABLE', () async {
    await expectLater(
      () => api.createInterview(type: 'technical', offerUrl: 'https://www.linkedin.com/jobs/1'),
      throwsA(isA<ApiException>().having((e) => e.code, 'code', ApiErrorCode.offerUnreadable)),
    );
  });

  test('el tope diario lanza INTERVIEWS_DAILY_CAP', () async {
    api.interviewsDailyLimit = 1;
    await api.createInterview(type: 'technical', offerText: 'oferta 1');

    await expectLater(
      () => api.createInterview(type: 'technical', offerText: 'oferta 2'),
      throwsA(isA<ApiException>().having((e) => e.code, 'code', ApiErrorCode.interviewsDailyCap)),
    );
  });

  test('menos de 4 respuestas lanza TOO_SHORT en el parecer', () async {
    final created = await api.createInterview(type: 'technical', offerText: 'oferta');
    await _readyInterview(api, created.id);
    await api.startInterviewSession(created.id);
    api.setInterviewAnsweredCount(created.id, 2);
    api.finishInterview(created.id);

    await expectLater(
      () => api.getInterviewFeedback(created.id),
      throwsA(isA<ApiException>().having((e) => e.code, 'code', ApiErrorCode.interviewTooShort)),
    );
  });

  test('el ciclo de estudio desbloquea la siguiente sesión al terminar la anterior', () async {
    final created = await api.createInterview(type: 'technical', offerText: 'oferta');
    final cycle = await api.createStudyCycle(created.id);
    expect(cycle.sessions.first.status, 'available');
    expect(cycle.sessions[1].status, 'locked');

    await expectLater(
      () => api.startStudyCycleSession(interviewId: created.id, idx: 2),
      throwsA(isA<ApiException>().having((e) => e.code, 'code', ApiErrorCode.validation)),
    );

    // Abrir la sesión no la marca hecha; terminarla sí.
    await api.startStudyCycleSession(interviewId: created.id, idx: 1);
    expect((await api.getStudyCycle(created.id)).sessions[0].status, 'available');

    api.completeStudySession(created.id, 1);
    final updated = await api.getStudyCycle(created.id);
    expect(updated.sessions[0].status, 'done');
    expect(updated.sessions[1].status, 'available');
    expect(updated.status, 'active');
  });

  test('createInterview exige offerText u offerUrl sin consumir el tope', () async {
    api.interviewsDailyLimit = 1;
    await expectLater(
      () => api.createInterview(type: 'technical'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.code, 'code', ApiErrorCode.validation)
            .having((e) => e.statusCode, 'statusCode', 422),
      ),
    );
    expect((await api.getInterviewQuota()).remaining, 1);
  });

  test('la cuota no rompe con un tope <= 0 (desactivado)', () async {
    api.interviewsDailyLimit = -1;
    final quota = await api.getInterviewQuota();
    expect(quota.limit, -1);
    await api.createInterview(type: 'technical', offerText: 'oferta');
  });

  test('retryInterview: prep_failed y feedback_failed se reintentan; otros dan 409', () async {
    final created = await api.createInterview(type: 'technical', offerText: 'oferta');
    await expectLater(
      () => api.retryInterview(created.id),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409)),
    );

    api.forceInterviewFeedbackFailed(created.id);
    final retried = await api.retryInterview(created.id);
    expect(retried.status, 'feedback_pending');
    expect(retried.errorCode, isNull);
  });

  test('startInterviewSession solo desde ready/in_progress/too_short y retoma el progreso', () async {
    final created = await api.createInterview(type: 'technical', offerText: 'oferta');
    await expectLater(
      () => api.startInterviewSession(created.id),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409)),
    );

    await _readyInterview(api, created.id);
    final first = await api.startInterviewSession(created.id);
    expect(first.answeredCount, 0);
    expect((await api.getInterview(created.id)).status, 'in_progress');

    api.setInterviewAnsweredCount(created.id, 3);
    final resumed = await api.startInterviewSession(created.id);
    expect(resumed.answeredCount, 3);
  });

  test('getInterviewFeedback respeta el estado de la entrevista', () async {
    final created = await api.createInterview(type: 'technical', offerText: 'oferta');
    Matcher code(ApiErrorCode c) =>
        throwsA(isA<ApiException>().having((e) => e.code, 'code', c));

    // Antes de terminar la entrevista: 404 notReady.
    await expectLater(
      () => api.getInterviewFeedback(created.id),
      throwsA(isA<ApiException>()
          .having((e) => e.code, 'code', ApiErrorCode.notReady)
          .having((e) => e.statusCode, 'statusCode', 404)),
    );

    await _readyInterview(api, created.id);
    await api.startInterviewSession(created.id);
    api.setInterviewAnsweredCount(created.id, 6);
    api.finishInterview(created.id);

    // feedback_pending: 202 una vez y luego el parecer.
    await expectLater(() => api.getInterviewFeedback(created.id), code(ApiErrorCode.notReady));
    final feedback = await api.getInterviewFeedback(created.id);
    expect(feedback.studyPlan, hasLength(5));
    expect(feedback.comparison, isNull);

    api.forceInterviewFeedbackFailed(created.id);
    await expectLater(() => api.getInterviewFeedback(created.id), code(ApiErrorCode.llmUnavailable));
  });

  test('reinterview exige ciclo completo y la hija es re-entrevista con comparación', () async {
    final parent = await api.createInterview(type: 'technical', offerText: 'oferta');
    await api.createStudyCycle(parent.id);
    await expectLater(
      () => api.reinterview(parent.id),
      throwsA(isA<ApiException>().having((e) => e.statusCode, 'statusCode', 409)),
    );

    for (var i = 1; i <= 5; i++) {
      api.completeStudySession(parent.id, i);
    }
    expect((await api.getStudyCycle(parent.id)).status, 'completed');

    final child = await api.reinterview(parent.id);
    expect(child.isReinterview, isTrue);
    final list = await api.getInterviews();
    expect(list.firstWhere((i) => i.id == child.id).isReinterview, isTrue);
    expect(list.firstWhere((i) => i.id == parent.id).isReinterview, isFalse);

    final ready = await _readyInterview(api, child.id);
    expect(ready.isReinterview, isTrue);
    await api.startInterviewSession(child.id);
    api.setInterviewAnsweredCount(child.id, 8);
    api.finishInterview(child.id);
    await api.getInterview(child.id); // feedback_pending → feedback_ready
    final feedback = await api.getInterviewFeedback(child.id);
    expect(feedback.comparison, isNotNull);
  });
}

/// Repolla hasta que la preparación termina (el fake avanza un paso por GET).
Future<InterviewDetail> _readyInterview(FakeApi api, String id) async {
  var detail = await api.getInterview(id);
  while (detail.status == 'preparing') {
    detail = await api.getInterview(id);
  }
  return detail;
}

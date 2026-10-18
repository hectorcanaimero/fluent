import 'package:fluent_mobile/core/api/fake_api.dart';
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
    api.setInterviewAnsweredCount(created.id, 2);

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

    await api.startStudyCycleSession(interviewId: created.id, idx: 1);
    final updated = await api.getStudyCycle(created.id);
    expect(updated.sessions[0].status, 'done');
    expect(updated.sessions[1].status, 'available');
  });
}

import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/api/http_fluent_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/http/api_client.dart';
import 'package:fluent_mobile/core/http/token_refresher.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

/// Nunca refresca de verdad: ningún test de este archivo provoca un `401`.
class _NullTokenRefresher implements TokenRefresher {
  @override
  Future<AuthTokens?> refresh(String refreshToken) async => null;
}

void main() {
  late Dio dio;
  late DioAdapter adapter;
  late HttpFluentApi api;

  setUp(() async {
    dio = Dio(BaseOptions(baseUrl: 'https://fluent-api.local/v1'));
    adapter = DioAdapter(dio: dio);
    dio.httpClientAdapter = adapter;
    final tokenStore = InMemoryTokenStore();
    await tokenStore.write(
      const AuthTokens(accessToken: 'access-1', refreshToken: 'refresh-1'),
    );
    final client = ApiClient(
      tokenStore: tokenStore,
      tokenRefresher: _NullTokenRefresher(),
      dio: dio,
    );
    api = HttpFluentApi(client);
  });

  // I2: GET /interviews/quota (FR-21, FR-33).
  test('GET /interviews/quota parsea remaining/limit/requiresPro/freeNotice', () async {
    adapter.onGet(
      '/interviews/quota',
      (server) => server.reply(200, {
        'remaining': 2,
        'limit': 3,
        'requiresPro': false,
        'freeNotice': true,
      }),
    );

    final quota = await api.getInterviewQuota();

    expect(quota.remaining, 2);
    expect(quota.limit, 3);
    expect(quota.requiresPro, isFalse);
    expect(quota.freeNotice, isTrue);
  });

  // I2: POST /interviews manda type/offerText/offerUrl y parsea InterviewDetail en preparing.
  test('POST /interviews manda el body y parsea InterviewDetail en preparing', () async {
    Map<String, dynamic>? sentBody;
    adapter.onPost(
      '/interviews',
      (server) => server.replyCallback(201, (options) {
        sentBody = options.data as Map<String, dynamic>;
        return {
          'id': 'interview-1',
          'type': 'technical',
          'status': 'preparing',
          'createdAt': '2026-10-18T10:00:00.000Z',
          'prepStep': 'reading',
        };
      }),
      data: Matchers.any,
    );

    final result = await api.createInterview(
      type: 'technical',
      offerText: 'Buscamos un backend engineer...',
    );

    expect(sentBody, {
      'type': 'technical',
      'offerText': 'Buscamos un backend engineer...',
    });
    expect(result.id, 'interview-1');
    expect(result.status, 'preparing');
    expect(result.prepStep, 'reading');
  });

  // I2: 422 OFFER_UNREADABLE (oferta de LinkedIn o ilegible).
  test('POST /interviews con oferta ilegible: 422 OFFER_UNREADABLE', () async {
    adapter.onPost(
      '/interviews',
      (server) => server.reply(422, {
        'error': 'OFFER_UNREADABLE',
        'message': 'No se pudo leer la oferta.',
        'statusCode': 422,
      }),
      data: Matchers.any,
    );

    await expectLater(
      () => api.createInterview(type: 'technical', offerUrl: 'https://linkedin.com/jobs/1'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.code, 'code', ApiErrorCode.offerUnreadable)
            .having((e) => e.statusCode, 'statusCode', 422),
      ),
    );
  });

  // I2: 429 INTERVIEWS_DAILY_CAP (FR-21).
  test('POST /interviews con tope diario agotado: 429 INTERVIEWS_DAILY_CAP', () async {
    adapter.onPost(
      '/interviews',
      (server) => server.reply(429, {
        'error': 'INTERVIEWS_DAILY_CAP',
        'message': 'Alcanzaste el tope diario de entrevistas.',
        'statusCode': 429,
      }),
      data: Matchers.any,
    );

    await expectLater(
      () => api.createInterview(type: 'technical', offerText: 'oferta'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.code, 'code', ApiErrorCode.interviewsDailyCap)
            .having((e) => e.statusCode, 'statusCode', 429),
      ),
    );
  });

  // I2: GET /interviews (historial, FR-31).
  test('GET /interviews parsea la lista de InterviewSummary', () async {
    adapter.onGet(
      '/interviews',
      (server) => server.reply(200, {
        'items': [
          {
            'id': 'interview-1',
            'type': 'technical',
            'status': 'feedback_ready',
            'createdAt': '2026-10-01T10:00:00.000Z',
            'role': 'Backend Engineer',
            'area': 'Engineering',
            'company': {'name': 'Acme Corp'},
            'cycleCompletedSessions': 2,
          },
        ],
      }),
    );

    final items = await api.getInterviews();

    expect(items, hasLength(1));
    expect(items.single.id, 'interview-1');
    expect(items.single.status, 'feedback_ready');
    expect(items.single.company?.name, 'Acme Corp');
    expect(items.single.cycleCompletedSessions, 2);
  });

  test('GET /interviews acepta también una lista plana', () async {
    adapter.onGet(
      '/interviews',
      (server) => server.reply(200, [
        {
          'id': 'interview-1',
          'type': 'technical',
          'status': 'ready',
          'createdAt': '2026-10-18T10:00:00.000Z',
        },
      ]),
    );

    final items = await api.getInterviews();

    expect(items.single.id, 'interview-1');
  });

  // I2: GET /interviews/:id una vez `ready` (IE-04): ficha completa, sin preguntas.
  test('GET /interviews/:id parsea la ficha completa en ready', () async {
    adapter.onGet(
      '/interviews/interview-1',
      (server) => server.reply(200, {
        'id': 'interview-1',
        'type': 'mixed',
        'status': 'ready',
        'createdAt': '2026-10-18T10:00:00.000Z',
        'prepStep': 'done',
        'company': {
          'name': 'Acme Corp',
          'industry': 'Software',
          'city': 'Remoto',
          'workMode': 'remote',
        },
        'role': 'Backend Engineer',
        'area': 'Engineering',
        'seniority': 'semi_senior',
        'questionCount': 8,
        'estimatedMin': 10,
        'competencies': [
          {'id': 'c1', 'name': 'APIs REST'},
          {'id': 'c2', 'name': 'Bases de datos'},
        ],
        'errorCode': null,
        'resumable': false,
      }),
    );

    final detail = await api.getInterview('interview-1');

    expect(detail.status, 'ready');
    expect(detail.company?.name, 'Acme Corp');
    expect(detail.questionCount, 8);
    expect(detail.estimatedMin, 10);
    expect(detail.competencies.map((c) => c.name), [
      'APIs REST',
      'Bases de datos',
    ]);
  });

  // Contrato: payload con la forma exacta de `InterviewDetailDto` (API,
  // `toDetailDto`), incluidos los campos opcionales ausentes y `null`.
  test('InterviewDetail.fromJson acepta el DTO real de la API', () {
    final json = <String, dynamic>{
      'id': 'interview-2',
      'type': 'technical',
      'status': 'too_short',
      'prepStep': null,
      'createdAt': '2026-10-18T10:00:00.000Z',
      'company': {'name': 'Globex', 'workMode': 'hybrid'},
      'role': 'Staff Platform Engineer',
      'area': null,
      'seniority': 'staff_lead',
      'questionCount': 6,
      'estimatedMin': 15,
      'competencies': [
        {'id': 'k8s', 'name': 'Kubernetes'},
      ],
      'errorCode': null,
      'resumable': true,
    };

    final detail = InterviewDetail.fromJson(json);

    expect(detail.status, 'too_short');
    expect(detail.prepStep, isNull);
    expect(detail.company?.name, 'Globex');
    expect(detail.company?.industry, isNull);
    expect(detail.company?.city, isNull);
    expect(detail.company?.workMode, 'hybrid');
    expect(detail.area, isNull);
    expect(detail.seniority, 'staff_lead');
    expect(detail.questionCount, 6);
    expect(detail.estimatedMin, 15);
    expect(
      detail.competencies.single,
      const InterviewCompetency(id: 'k8s', name: 'Kubernetes'),
    );
    expect(detail.resumable, isTrue);
  });

  // I2: POST /interviews/:id/retry.
  test('POST /interviews/:id/retry vuelve a preparing', () async {
    adapter.onPost(
      '/interviews/interview-1/retry',
      (server) => server.reply(200, {
        'id': 'interview-1',
        'type': 'technical',
        'status': 'preparing',
        'createdAt': '2026-10-18T10:00:00.000Z',
        'prepStep': 'reading',
      }),
    );

    final result = await api.retryInterview('interview-1');

    expect(result.status, 'preparing');
    expect(result.prepStep, 'reading');
  });

  // I2: POST /interviews/:id/session.
  test('POST /interviews/:id/session parsea sessionId y progreso', () async {
    adapter.onPost(
      '/interviews/interview-1/session',
      (server) => server.reply(200, {
        'sessionId': 'session-1',
        'answeredCount': 2,
        'totalQuestions': 8,
      }),
    );

    final result = await api.startInterviewSession('interview-1');

    expect(result.sessionId, 'session-1');
    expect(result.answeredCount, 2);
    expect(result.totalQuestions, 8);
  });

  // I2: GET /interviews/:id/feedback (FR-12, FR-26, FR-27).
  test('GET /interviews/:id/feedback parsea el parecer completo', () async {
    adapter.onGet(
      '/interviews/interview-1/feedback',
      (server) => server.reply(200, {
        'summary': 'Buen desempeño general.',
        'competencies': [
          {
            'competencyId': 'c1',
            'observedLevel': 'semi_senior',
            'expectedLevel': 'senior',
            'evidence': 'I used an index.',
            'missing': 'Profundidad en transacciones.',
            'study': 'Repasar transacciones.',
            'verified': true,
          },
        ],
        'english': {
          'clarity': {'rating': 'good', 'note': 'Se entiende bien.'},
          'vocabulary': {'rating': 'fair', 'note': 'Vocabulario básico.'},
          'errors': [
            {
              'original': 'I have went',
              'corrected': 'I have gone',
              'explanation': 'Participio irregular.',
            },
          ],
        },
        'comparison': null,
        'studyPlan': [
          {
            'idx': 1,
            'focus': 'c1',
            'title': 'Transacciones',
            'format': 'guided',
            'estMin': 12,
            'brief': 'Practicar transacciones ACID.',
          },
        ],
      }),
    );

    final feedback = await api.getInterviewFeedback('interview-1');

    expect(feedback.summary, 'Buen desempeño general.');
    expect(feedback.competencies.single.competencyId, 'c1');
    expect(feedback.english.clarity.rating, 'good');
    expect(feedback.english.errors.single.corrected, 'I have gone');
    expect(feedback.comparison, isNull);
    expect(feedback.studyPlan.single.title, 'Transacciones');
  });

  // I2: 409 TOO_SHORT (menos de 4 respuestas, FR-11).
  test('GET /interviews/:id/feedback con pocas respuestas: 409 TOO_SHORT', () async {
    adapter.onGet(
      '/interviews/interview-1/feedback',
      (server) => server.reply(409, {
        'error': 'TOO_SHORT',
        'message': 'No hay suficientes respuestas para el parecer.',
        'statusCode': 409,
        'answeredCount': 2,
        'resumable': true,
      }),
    );

    // `resumable`/`answeredCount` salen del extra del 409, sin otra llamada.
    await expectLater(
      () => api.getInterviewFeedback('interview-1'),
      throwsA(
        isA<InterviewTooShort>()
            .having((e) => e.code, 'code', ApiErrorCode.interviewTooShort)
            .having((e) => e.statusCode, 'statusCode', 409)
            .having((e) => e.resumable, 'resumable', isTrue)
            .having((e) => e.answeredCount, 'answeredCount', 2),
      ),
    );
  });

  // `TOO_SHORT` solo se traduce en la ruta del parecer, no en toda la app.
  test('TOO_SHORT fuera del parecer no se mapea a interviewTooShort', () async {
    expect(ApiErrorCode.fromWire('TOO_SHORT'), ApiErrorCode.unknown);
    adapter.onPost(
      '/interviews/interview-1/session',
      (server) => server.reply(409, {
        'error': 'TOO_SHORT',
        'message': 'otro uso del código',
        'statusCode': 409,
      }),
    );

    await expectLater(
      () => api.startInterviewSession('interview-1'),
      throwsA(isA<ApiException>().having((e) => e.code, 'code', ApiErrorCode.unknown)),
    );
  });

  // F12: `202` mientras el parecer está en `feedback_pending`.
  test('GET /interviews/:id/feedback con 202 lanza notReady', () async {
    adapter.onGet(
      '/interviews/interview-1/feedback',
      (server) => server.reply(202, {'status': 'feedback_pending'}),
    );

    await expectLater(
      () => api.getInterviewFeedback('interview-1'),
      throwsA(
        isA<ApiException>()
            .having((e) => e.code, 'code', ApiErrorCode.notReady)
            .having((e) => e.statusCode, 'statusCode', 202),
      ),
    );
  });

  // I2: POST/GET /interviews/:id/cycle (FR-17).
  test('POST /interviews/:id/cycle parsea el ciclo con sus 5 sesiones', () async {
    adapter.onPost(
      '/interviews/interview-1/cycle',
      (server) => server.reply(201, {
        'id': 'cycle-1',
        'status': 'active',
        'sessions': [
          for (var i = 1; i <= 5; i++)
            {
              'idx': i,
              'focus': i == 5 ? 'english' : 'c$i',
              'title': 'Sesión $i',
              'format': i.isOdd ? 'guided' : 'roleplay',
              'estMin': 12,
              'status': i == 1 ? 'available' : 'locked',
            },
        ],
      }),
    );

    final cycle = await api.createStudyCycle('interview-1');

    expect(cycle.id, 'cycle-1');
    expect(cycle.sessions, hasLength(5));
    expect(cycle.sessions.first.status, 'available');
    expect(cycle.sessions.last.status, 'locked');
  });

  // I2: POST /interviews/:id/cycle/sessions/:idx/start.
  test('POST /interviews/:id/cycle/sessions/:idx/start parsea el sessionId', () async {
    adapter.onPost(
      '/interviews/interview-1/cycle/sessions/1/start',
      (server) => server.reply(200, {'sessionId': 'study-session-1'}),
    );

    final result = await api.startStudyCycleSession(
      interviewId: 'interview-1',
      idx: 1,
    );

    expect(result.sessionId, 'study-session-1');
  });

  // I2: POST /interviews/:id/reinterview (FR-19).
  test('POST /interviews/:id/reinterview parsea la entrevista hija en preparing', () async {
    adapter.onPost(
      '/interviews/interview-1/reinterview',
      (server) => server.reply(201, {
        'id': 'interview-2',
        'type': 'technical',
        'status': 'preparing',
        'createdAt': '2026-10-18T10:00:00.000Z',
        'prepStep': 'reading',
      }),
    );

    final result = await api.reinterview('interview-1');

    expect(result.id, 'interview-2');
    expect(result.status, 'preparing');
  });
}

import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/fluent_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/data/auth_controller.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/interviews/presentation/feedback/interview_feedback_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// [me] va al estado de auth: la pantalla saca el nombre de ahí, sin
/// `getMe`.
Widget _wrap(FluentApi api, String id, {MeResponse? me}) {
  final router = GoRouter(
    initialLocation: '/interviews/$id/feedback',
    routes: [
      GoRoute(
        path: '/interviews',
        // Con `Scaffold` para que se vea el snackbar tras volver.
        builder: (context, state) =>
            const Scaffold(body: Text('INTERVIEWS_HOME')),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const Text('NEW_INTERVIEW'),
          ),
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                Text('DETAIL_${state.pathParameters['id']}'),
          ),
          GoRoute(
            path: ':id/feedback',
            builder: (context, state) => InterviewFeedbackScreen(
              interviewId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: ':id/session',
            builder: (context, state) =>
                Text('SESSION_${state.pathParameters['id']}'),
          ),
          GoRoute(
            path: ':id/cycle',
            builder: (context, state) =>
                Text('CYCLE_${state.pathParameters['id']}'),
          ),
        ],
      ),
    ],
  );
  return ProviderScope(
    overrides: [
      fluentApiProvider.overrideWith((ref) => api),
      authControllerProvider.overrideWith(
        (ref) => AuthController(tokenStore: InMemoryTokenStore(), api: api)
          ..state = AuthState(
            status: AuthStatus.authenticated,
            onboarded: true,
            me: me,
          ),
      ),
    ],
    child: MaterialApp.router(
      routerConfig: router,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
}

/// Cuenta llamadas y puede mantener la ficha en `feedback_pending` durante
/// [pendingPolls] GETs, o hacer fallar `GET /feedback` con [feedbackError].
class _SpyApi extends FakeApi {
  _SpyApi({this.feedbackError}) : super(artificialDelay: Duration.zero);

  int pendingPolls = 0;
  final Object? feedbackError;
  int detailCalls = 0;
  int feedbackCalls = 0;
  int retryCalls = 0;
  int meCalls = 0;

  @override
  Future<InterviewDetail> getInterview(String id) async {
    detailCalls++;
    final detail = await super.getInterview(id);
    if (pendingPolls > 0) {
      pendingPolls--;
      return detail.copyWith(status: 'feedback_pending');
    }
    return detail;
  }

  @override
  Future<InterviewFeedback> getInterviewFeedback(String id) {
    feedbackCalls++;
    final error = feedbackError;
    if (error != null) throw error;
    return super.getInterviewFeedback(id);
  }

  @override
  Future<InterviewDetail> retryInterview(String id) {
    retryCalls++;
    return super.retryInterview(id);
  }

  @override
  Future<MeResponse> getMe() {
    meCalls++;
    return super.getMe();
  }
}

/// Entrevista en `feedback_ready` (el `getInterview` de [FakeApi] pasa
/// `feedback_pending` → `feedback_ready`).
Future<String> _readyFeedback(FakeApi api) async {
  final created = await api.createInterview(
    type: 'technical',
    offerText: 'Senior Backend Engineer at Acme',
  );
  await _advanceToReady(api, created.id);
  api.setInterviewAnsweredCount(created.id, 4);
  api.finishInterview(created.id);
  await api.getInterview(created.id);
  return created.id;
}

/// Entrevista en `feedback_failed`.
Future<String> _failedFeedback(FakeApi api) async {
  final created = await api.createInterview(
    type: 'technical',
    offerText: 'Senior Backend Engineer at Acme',
  );
  await _advanceToReady(api, created.id);
  api.forceInterviewFeedbackFailed(created.id);
  return created.id;
}

/// Avanza la `preparing` de [FakeApi] (avanza un paso por llamada) hasta
/// `ready`, para tener `competencies` con nombres antes de forzar el estado
/// de la entrevista con los ganchos de test.
Future<void> _advanceToReady(FakeApi api, String id) async {
  await api.getInterview(id);
  await api.getInterview(id);
  await api.getInterview(id);
}

void main() {
  testWidgets(
    'IE-06c→IE-06a/b: sin GET /feedback mientras la ficha está pendiente; '
    'un solo GET al salir de feedback_pending',
    (tester) async {
      final api = _SpyApi();
      final id = await _readyFeedback(api);
      final me = await api.getMe();
      api
        ..pendingPolls = 3
        ..detailCalls = 0
        ..meCalls = 0;

      await tester.pumpWidget(_wrap(api, id, me: me));
      await tester.pump();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      // IE-06c: la ficha sigue en feedback_pending → cargando, sin pedir el
      // parecer.
      expect(
        find.text(l10n.interviewHistoryStatusFeedbackPending),
        findsOneWidget,
      );
      expect(api.feedbackCalls, 0);

      // `interviewProvider` repolla cada 3 s.
      await tester.pump(const Duration(seconds: 3));
      await tester.pump(const Duration(seconds: 3));
      expect(api.detailCalls, 3);
      expect(api.feedbackCalls, 0);

      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
      expect(api.feedbackCalls, 1);

      // IE-06a: resumen con el nombre del estado de auth (sin getMe) y
      // tarjeta de competencia con observado/esperado, cita, estudiar y
      // verificado.
      expect(api.meCalls, 0);
      expect(
        find.text(l10n.interviewFeedbackSummaryTitle('María')),
        findsOneWidget,
      );
      expect(
        find.text(
          'Buen manejo general de las preguntas técnicas, con margen de '
          'mejora en bases de datos.',
        ),
        findsOneWidget,
      );
      expect(find.text('APIs REST'), findsOneWidget);
      expect(find.text(l10n.interviewSenioritySemiSenior), findsNWidgets(2));
      expect(
        find.text('“I used an index to speed up that query.”'),
        findsOneWidget,
      );
      expect(
        find.text('Repasar transacciones e índices compuestos.'),
        findsOneWidget,
      );
      expect(find.text(l10n.interviewFeedbackMissingLabel), findsNothing);
      expect(
        find.byKey(const Key('interview_feedback_verified_badge')),
        findsOneWidget,
      );

      // IE-06b: claridad y vocabulario del inglés.
      expect(find.text(l10n.interviewFeedbackEnglishTitle), findsOneWidget);
      expect(find.text(l10n.interviewEnglishRatingGood), findsNWidgets(2));
      expect(find.text('Se entiende bien.'), findsOneWidget);
      expect(find.text('Vocabulario técnico correcto.'), findsOneWidget);

      // FR-14: aviso fijo.
      expect(find.text(l10n.interviewFeedbackDisclaimer), findsOneWidget);

      // Sin botón de compartir en ningún estado de esta pantalla.
      expect(find.byIcon(Icons.share), findsNothing);

      // Con el parecer listo ya no se repolla nada.
      final detailCalls = api.detailCalls;
      await tester.pump(const Duration(minutes: 5));
      expect(api.detailCalls, detailCalls);
      expect(api.feedbackCalls, 1);

      // CTA → ciclo de estudio (F13.2), más abajo del fold.
      final startCycleButton = find.byKey(
        const Key('interview_feedback_start_cycle_button'),
      );
      await tester.scrollUntilVisible(startCycleButton, 200);
      await tester.tap(startCycleButton);
      await tester.pumpAndSettle();
      expect(find.text('CYCLE_$id'), findsOneWidget);
    },
  );

  testWidgets('al salir de la pantalla deja de repollar', (tester) async {
    final api = _SpyApi();
    final id = await _readyFeedback(api);
    api
      ..pendingPolls = 1000
      ..detailCalls = 0;

    await tester.pumpWidget(_wrap(api, id));
    await tester.pump();
    await tester.pump(const Duration(seconds: 3));
    expect(api.detailCalls, 2);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(minutes: 5));
    expect(api.detailCalls, 2);
    expect(api.feedbackCalls, 0);
  });

  testWidgets(
    '404 NOT_READY (todavía no terminó): aviso claro y botón a la ficha',
    (tester) async {
      final api = _SpyApi();
      final created = await api.createInterview(
        type: 'technical',
        offerText: 'Senior Backend Engineer at Acme',
      );
      await _advanceToReady(api, created.id);

      await tester.pumpWidget(_wrap(api, created.id));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.interviewFeedbackNotFinishedTitle), findsOneWidget);
      expect(find.text(l10n.interviewFeedbackFailedTitle), findsNothing);
      expect(api.feedbackCalls, 1);

      await tester.tap(
        find.byKey(const Key('interview_feedback_open_interview_button')),
      );
      await tester.pumpAndSettle();
      expect(find.text('DETAIL_${created.id}'), findsOneWidget);
    },
  );

  testWidgets('IE-06d (resumable): Retomar entrevista y Empezar de nuevo', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createInterview(
      type: 'technical',
      offerText: 'Senior Backend Engineer at Acme',
    );
    api.setInterviewAnsweredCount(created.id, 2);
    api.finishInterview(created.id); // < 4 respuestas → too_short, resumable

    await tester.pumpWidget(_wrap(api, created.id));
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.interviewFeedbackTooShortTitle), findsOneWidget);
    expect(find.byIcon(Icons.share), findsNothing);

    final resumeButton = find.byKey(
      const Key('interview_feedback_resume_button'),
    );
    expect(resumeButton, findsOneWidget);
    await tester.tap(resumeButton);
    await tester.pumpAndSettle();
    expect(find.text('SESSION_${created.id}'), findsOneWidget);
  });

  testWidgets(
    'IE-06d (no resumable): solo Empezar de nuevo, con el resumable del 409',
    (tester) async {
      final detail = InterviewDetail(
        id: 'i1',
        type: 'technical',
        status: 'too_short',
        createdAt: '2026-10-18T10:00:00.000Z',
        // La ficha dice resumable, pero manda el extra del 409.
        resumable: true,
      );
      final api = _FixedTooShortApi(detail);

      await tester.pumpWidget(_wrap(api, 'i1'));
      await tester.pumpAndSettle();

      // Solo el GET de `interviewProvider`: nada de pedir la ficha aparte.
      expect(api.detailCalls, 1);
      expect(
        find.byKey(const Key('interview_feedback_resume_button')),
        findsNothing,
      );
      final restartButton = find.byKey(
        const Key('interview_feedback_restart_button'),
      );
      expect(restartButton, findsOneWidget);
      await tester.tap(restartButton);
      await tester.pumpAndSettle();
      expect(find.text('NEW_INTERVIEW'), findsOneWidget);
    },
  );

  testWidgets(
    'IE-06e (feedback_failed): Reintentar re-encola y muestra el parecer',
    (tester) async {
      final api = _SpyApi();
      final id = await _failedFeedback(api);

      await tester.pumpWidget(_wrap(api, id));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.interviewFeedbackFailedTitle), findsOneWidget);
      final retryButton = find.byKey(
        const Key('interview_feedback_retry_button'),
      );
      expect(
        find.byKey(const Key('interview_feedback_notify_later_button')),
        findsOneWidget,
      );

      await tester.tap(retryButton);
      await tester.pumpAndSettle();

      expect(api.retryCalls, 1);
      expect(find.text(l10n.interviewFeedbackSummaryTitle('')), findsOneWidget);
    },
  );

  testWidgets('IE-06e (red): Reintentar no re-encola, solo vuelve a pedir', (
    tester,
  ) async {
    final api = _SpyApi(feedbackError: Exception('network error'));
    final id = await _failedFeedback(api);

    await tester.pumpWidget(_wrap(api, id));
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.interviewFeedbackFailedTitle), findsOneWidget);
    expect(find.byIcon(Icons.share), findsNothing);
    expect(api.feedbackCalls, 1);

    await tester.tap(find.byKey(const Key('interview_feedback_retry_button')));
    await tester.pumpAndSettle();

    expect(api.retryCalls, 0);
    expect(api.feedbackCalls, 2);
  });

  testWidgets(
    'Avísame (feedback_failed): re-encola, vuelve y avisa con un snackbar',
    (tester) async {
      final api = _SpyApi();
      final id = await _failedFeedback(api);

      await tester.pumpWidget(_wrap(api, id));
      await tester.pumpAndSettle();

      await tester.tap(
        find.byKey(const Key('interview_feedback_notify_later_button')),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(api.retryCalls, 1);
      expect(find.text('INTERVIEWS_HOME'), findsOneWidget);
      expect(find.text(l10n.interviewFeedbackNotifyLaterSnack), findsOneWidget);
    },
  );

  testWidgets('Avísame (red): solo vuelve, sin re-encolar ni snackbar', (
    tester,
  ) async {
    final api = _SpyApi(feedbackError: Exception('network error'));
    final id = await _failedFeedback(api);

    await tester.pumpWidget(_wrap(api, id));
    await tester.pumpAndSettle();

    await tester.tap(
      find.byKey(const Key('interview_feedback_notify_later_button')),
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(api.retryCalls, 0);
    expect(find.text('INTERVIEWS_HOME'), findsOneWidget);
    expect(find.text(l10n.interviewFeedbackNotifyLaterSnack), findsNothing);
  });
}

/// `GET /interviews/:id/feedback` siempre `409 TOO_SHORT` no resumable y
/// `GET /interviews/:id` siempre [detail] (cuenta las llamadas).
class _FixedTooShortApi extends FakeApi {
  _FixedTooShortApi(this.detail) : super(artificialDelay: Duration.zero);

  final InterviewDetail detail;
  int detailCalls = 0;

  @override
  Future<InterviewDetail> getInterview(String id) async {
    detailCalls++;
    return detail;
  }

  @override
  Future<InterviewFeedback> getInterviewFeedback(String id) {
    throw const InterviewTooShort(resumable: false, answeredCount: 2);
  }
}

import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/fluent_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/feedback/interview_feedback_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

Widget _wrap(FluentApi api, String id) {
  final router = GoRouter(
    initialLocation: '/interviews/$id/feedback',
    routes: [
      GoRoute(
        path: '/interviews',
        builder: (context, state) => const Text('INTERVIEWS_HOME'),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const Text('NEW_INTERVIEW'),
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
    overrides: [fluentApiProvider.overrideWith((ref) => api)],
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

/// Lanza un error que no es [ApiException] (red/timeout fuera de la API) al
/// pedir el parecer: IE-06e también lo cubre, no solo `feedback_failed`.
class _NetworkErrorApi extends FakeApi {
  _NetworkErrorApi() : super(artificialDelay: Duration.zero);

  @override
  Future<InterviewFeedback> getInterviewFeedback(String id) {
    throw Exception('network error');
  }
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
    'IE-06c→IE-06a/b: "Armando tu parecer", repolla a los 3 s y muestra el '
    'parecer sin acción de compartir',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createInterview(
        type: 'technical',
        offerText: 'Senior Backend Engineer at Acme',
      );
      await _advanceToReady(api, created.id);
      api.setInterviewAnsweredCount(created.id, 4);
      api.finishInterview(created.id); // -> feedback_pending (4+ respuestas)

      await tester.pumpWidget(_wrap(api, created.id));
      await tester.pump();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      // IE-06c: primera llamada responde 202 y queda cargando.
      expect(
        find.text(l10n.interviewHistoryStatusFeedbackPending),
        findsOneWidget,
      );

      // Repolleo a los 3 s: la segunda llamada ya trae el parecer.
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      // IE-06a: resumen con el nombre (FakeApi.getMe → "María") y tarjeta
      // de competencia con observado/esperado, cita, estudiar y verificado.
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

      // CTA → ciclo de estudio (F13.2), más abajo del fold.
      final startCycleButton = find.byKey(
        const Key('interview_feedback_start_cycle_button'),
      );
      await tester.scrollUntilVisible(startCycleButton, 200);
      await tester.tap(startCycleButton);
      await tester.pumpAndSettle();
      expect(find.text('CYCLE_${created.id}'), findsOneWidget);
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

  testWidgets('IE-06d (no resumable): solo Empezar de nuevo', (tester) async {
    final detail = InterviewDetail(
      id: 'i1',
      type: 'technical',
      status: 'too_short',
      createdAt: '2026-10-18T10:00:00.000Z',
      resumable: false,
    );
    final api = _FixedTooShortApi(detail);

    await tester.pumpWidget(_wrap(api, 'i1'));
    await tester.pumpAndSettle();

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
  });

  testWidgets(
    'IE-06e (feedback_failed): Reintentar re-encola y muestra el parecer',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createInterview(
        type: 'technical',
        offerText: 'Senior Backend Engineer at Acme',
      );
      await _advanceToReady(api, created.id);
      api.forceInterviewFeedbackFailed(created.id);

      await tester.pumpWidget(_wrap(api, created.id));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.interviewFeedbackFailedTitle), findsOneWidget);
      final retryButton = find.byKey(
        const Key('interview_feedback_retry_button'),
      );
      expect(retryButton, findsOneWidget);
      expect(
        find.byKey(const Key('interview_feedback_notify_later_button')),
        findsOneWidget,
      );

      await tester.tap(retryButton);
      await tester.pump();
      // El reintento re-encola (→ feedback_pending) y la pantalla vuelve a
      // repollar cada 3 s como en IE-06c.
      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();

      expect(
        find.text(l10n.interviewFeedbackSummaryTitle('María')),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'IE-06e (red): un error que no es de la API también cae en Reintentar',
    (tester) async {
      await tester.pumpWidget(_wrap(_NetworkErrorApi(), 'i1'));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.interviewFeedbackFailedTitle), findsOneWidget);
      expect(find.byIcon(Icons.share), findsNothing);

      await tester.tap(
        find.byKey(const Key('interview_feedback_notify_later_button')),
      );
      await tester.pumpAndSettle();
      expect(find.text('INTERVIEWS_HOME'), findsOneWidget);
    },
  );
}

/// `GET /interviews/:id/feedback` siempre `409 TOO_SHORT` y
/// `GET /interviews/:id` siempre [detail] (para fijar `resumable: false`
/// sin pasar por el flujo completo de `FakeApi`).
class _FixedTooShortApi extends FakeApi {
  _FixedTooShortApi(this.detail) : super(artificialDelay: Duration.zero);

  final InterviewDetail detail;

  @override
  Future<InterviewDetail> getInterview(String id) async => detail;

  @override
  Future<InterviewFeedback> getInterviewFeedback(String id) {
    throw const ApiException(
      code: ApiErrorCode.interviewTooShort,
      message: 'not enough answers for feedback',
      statusCode: 409,
    );
  }
}

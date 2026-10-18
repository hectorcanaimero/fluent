import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/data/auth_controller.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/interviews/presentation/compare/interview_compare_screen.dart';
import 'package:fluent_mobile/features/interviews/presentation/cycle/interview_cycle_screen.dart';
import 'package:fluent_mobile/features/interviews/presentation/feedback/interview_feedback_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// Lleva una entrevista de `preparing` a `feedback_ready`.
Future<void> _finish(FakeApi api, String id) async {
  await api.getInterview(id);
  await api.getInterview(id);
  await api.getInterview(id);
  await api.startInterviewSession(id);
  api.setInterviewAnsweredCount(id, 8);
  api.finishInterview(id);
  await api.getInterview(id); // feedback_pending → feedback_ready
}

/// Entrevista terminada con el ciclo de estudio completo (las 5 sesiones
/// hechas), lista para la re-entrevista (IE-07).
Future<String> _completedCycleInterview(FakeApi api) async {
  final created = await api.createInterview(
    type: 'technical',
    offerText: 'Senior Backend Engineer at Acme',
  );
  await _finish(api, created.id);
  await api.createStudyCycle(created.id);
  for (var idx = 1; idx <= 5; idx++) {
    api.completeStudySession(created.id, idx);
  }
  return created.id;
}

Future<GoRouter> _pump(
  WidgetTester tester,
  FakeApi api,
  String initialLocation,
) async {
  await tester.binding.setSurfaceSize(const Size(800, 1600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final me = await api.getMe();
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: [
      GoRoute(
        path: '/interviews/:id',
        builder: (context, state) =>
            Scaffold(body: Text('PREP_${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/interviews/:id/cycle',
        builder: (context, state) =>
            InterviewCycleScreen(interviewId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/interviews/:id/feedback',
        builder: (context, state) =>
            InterviewFeedbackScreen(interviewId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/interviews/:id/compare',
        builder: (context, state) => InterviewCompareScreen(
          interviewId: state.pathParameters['id']!,
          initialFeedback: state.extra is InterviewFeedback
              ? state.extra! as InterviewFeedback
              : null,
        ),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
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
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

int _depth(GoRouter router) =>
    router.routerDelegate.currentConfiguration.matches.length;

void main() {
  testWidgets(
    '"Empezar re-entrevista" llama POST /reinterview y reemplaza el ciclo '
    'por la preparación de la hija',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final id = await _completedCycleInterview(api);
      final router = await _pump(tester, api, '/interviews/$id/cycle');

      expect(
        find.byKey(const Key('interview_cycle_view_reinterview_button')),
        findsNothing,
      );
      await tester.tap(
        find.byKey(const Key('interview_cycle_reinterview_button')),
      );
      await tester.pumpAndSettle();

      // La hija es la segunda entrevista creada por el fake (`interview-2`).
      expect(find.text('PREP_interview-2'), findsOneWidget);
      expect(router.canPop(), isFalse);
      final interviews = await api.getInterviews();
      final child = interviews.firstWhere((i) => i.id == 'interview-2');
      expect(child.isReinterview, isTrue);
      expect(child.parentInterviewId, id);
    },
  );

  test(
    'FakeApi.reinterview es idempotente con una hija sin terminar',
    () async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final id = await _completedCycleInterview(api);

      final first = await api.reinterview(id);
      final second = await api.reinterview(id);

      expect(second.id, first.id);
      final children = (await api.getInterviews()).where(
        (i) => i.parentInterviewId == id,
      );
      expect(children, hasLength(1));
    },
  );

  testWidgets(
    'con la hija ya creada el botón pasa a "Ver re-entrevista" y lleva a ella',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final id = await _completedCycleInterview(api);
      final child = await api.reinterview(id);
      await _pump(tester, api, '/interviews/$id/cycle');

      expect(
        find.byKey(const Key('interview_cycle_reinterview_button')),
        findsNothing,
      );
      final view = find.byKey(
        const Key('interview_cycle_view_reinterview_button'),
      );
      expect(find.text('Ver re-entrevista'), findsOneWidget);

      await tester.tap(view);
      await tester.pumpAndSettle();
      expect(find.text('PREP_${child.id}'), findsOneWidget);
    },
  );

  testWidgets('parecer ↔ comparación: ir y volver no hace crecer la pila', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final parent = await _completedCycleInterview(api);
    final child = await api.reinterview(parent);
    await _finish(api, child.id);
    final router = await _pump(tester, api, '/interviews/${child.id}/feedback');
    final depth = _depth(router);

    for (var i = 0; i < 2; i++) {
      await tester.ensureVisible(
        find.byKey(const Key('interview_feedback_view_comparison_button')),
      );
      await tester.tap(
        find.byKey(const Key('interview_feedback_view_comparison_button')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Así cambiaste'), findsOneWidget);
      expect(_depth(router), depth + 1);

      await tester.tap(
        find.byKey(const Key('interview_compare_view_feedback_button')),
      );
      await tester.pumpAndSettle();
      expect(find.text('Así cambiaste'), findsNothing);
      expect(
        find.byKey(const Key('interview_feedback_view_comparison_button')),
        findsOneWidget,
      );
      expect(_depth(router), depth);
    }
  });
}

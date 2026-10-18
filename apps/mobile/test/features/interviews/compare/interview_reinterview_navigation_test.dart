import 'package:fluent_mobile/core/api/fake_api.dart';
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

/// Entrevista con el ciclo de estudio completo (las 5 sesiones hechas), lista
/// para la re-entrevista (IE-07).
Future<String> _completedCycleInterview(FakeApi api) async {
  final created = await api.createInterview(
    type: 'technical',
    offerText: 'Senior Backend Engineer at Acme',
  );
  await api.getInterview(created.id);
  await api.getInterview(created.id);
  await api.getInterview(created.id);
  await api.createStudyCycle(created.id);
  for (var idx = 1; idx <= 5; idx++) {
    api.completeStudySession(created.id, idx);
  }
  return created.id;
}

void main() {
  testWidgets(
    '"Empezar re-entrevista" llama POST /reinterview y navega a la '
    'preparación de la hija',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final api = FakeApi(artificialDelay: Duration.zero);
      final id = await _completedCycleInterview(api);

      final router = GoRouter(
        initialLocation: '/interviews/$id/cycle',
        routes: [
          GoRoute(
            path: '/interviews/:id/cycle',
            builder: (context, state) => InterviewCycleScreen(
              interviewId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/interviews/:id',
            builder: (context, state) =>
                Scaffold(body: Text('PREP_${state.pathParameters['id']}')),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
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
        ),
      );
      await tester.pumpAndSettle();

      final button = find.byKey(const Key('interview_cycle_reinterview_button'));
      expect(button, findsOneWidget);

      await tester.tap(button);
      await tester.pumpAndSettle();

      // La hija es la segunda entrevista creada por el fake (`interview-2`).
      expect(find.text('PREP_interview-2'), findsOneWidget);
      final interviews = await api.getInterviews();
      final child = interviews.firstWhere((i) => i.id == 'interview-2');
      expect(child.isReinterview, isTrue);
    },
  );

  testWidgets(
    'el parecer de una re-entrevista con comparación enlaza a /compare',
    (tester) async {
      await tester.binding.setSurfaceSize(const Size(800, 1600));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      final api = FakeApi(artificialDelay: Duration.zero);
      final parent = await _completedCycleInterview(api);
      final child = await api.reinterview(parent);
      await api.getInterview(child.id);
      await api.getInterview(child.id);
      await api.getInterview(child.id);
      await api.startInterviewSession(child.id);
      api.setInterviewAnsweredCount(child.id, 8);
      api.finishInterview(child.id);
      await api.getInterview(child.id); // feedback_pending → feedback_ready
      final me = await api.getMe();

      final router = GoRouter(
        initialLocation: '/interviews/${child.id}/feedback',
        routes: [
          GoRoute(
            path: '/interviews/:id/feedback',
            builder: (context, state) => InterviewFeedbackScreen(
              interviewId: state.pathParameters['id']!,
            ),
          ),
          GoRoute(
            path: '/interviews/:id/compare',
            builder: (context, state) => InterviewCompareScreen(
              interviewId: state.pathParameters['id']!,
            ),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fluentApiProvider.overrideWith((ref) => api),
            authControllerProvider.overrideWith(
              (ref) =>
                  AuthController(tokenStore: InMemoryTokenStore(), api: api)
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

      final link = find.byKey(
        const Key('interview_feedback_view_comparison_button'),
      );
      expect(link, findsOneWidget);

      await tester.tap(link);
      await tester.pumpAndSettle();

      expect(find.text('Así cambiaste'), findsOneWidget);
    },
  );
}

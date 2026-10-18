import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/compare/interview_compare_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

Future<void> _pump(WidgetTester tester, FakeApi api, String id) async {
  await tester.binding.setSurfaceSize(const Size(800, 1600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final router = GoRouter(
    initialLocation: '/interviews/$id/compare',
    routes: [
      GoRoute(
        path: '/interviews/:id/compare',
        builder: (context, state) =>
            InterviewCompareScreen(interviewId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/interviews/:id/feedback',
        builder: (context, state) =>
            Scaffold(body: Text('FEEDBACK_${state.pathParameters['id']}')),
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
}

/// Entrevista padre con el ciclo completo, su re-entrevista hija y el
/// parecer de la hija en `feedback_ready` (con `comparison`, F13.1.T2).
Future<String> _reinterviewFeedbackReady(FakeApi api) async {
  final parent = await api.createInterview(
    type: 'technical',
    offerText: 'Senior Backend Engineer at Acme',
  );
  await api.createStudyCycle(parent.id);
  for (var idx = 1; idx <= 5; idx++) {
    api.completeStudySession(parent.id, idx);
  }
  final child = await api.reinterview(parent.id);

  // Avanza `preparing` → `ready` (un paso por GET) para tener competencias.
  await api.getInterview(child.id);
  await api.getInterview(child.id);
  await api.getInterview(child.id);

  await api.startInterviewSession(child.id);
  api.setInterviewAnsweredCount(child.id, 8);
  api.finishInterview(child.id);
  await api.getInterview(child.id); // feedback_pending → feedback_ready
  return child.id;
}

void main() {
  testWidgets(
    'muestra las tres competencias con sus estados: avanzó, igual y retrocedió',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final id = await _reinterviewFeedbackReady(api);
      await _pump(tester, api, id);

      expect(find.text('Así cambiaste'), findsOneWidget);

      final c1 = find.byKey(const Key('interview_compare_competency_c1'));
      expect(c1, findsOneWidget);
      expect(
        find.descendant(of: c1, matching: find.text('Avanzó')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: c1, matching: find.text('Junior')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: c1, matching: find.text('Semi-senior')),
        findsWidgets,
      );

      final c2 = find.byKey(const Key('interview_compare_competency_c2'));
      expect(c2, findsOneWidget);
      expect(
        find.descendant(of: c2, matching: find.text('Igual')),
        findsOneWidget,
      );

      final c3 = find.byKey(const Key('interview_compare_competency_c3'));
      expect(c3, findsOneWidget);
      expect(
        find.descendant(of: c3, matching: find.text('Retrocedió')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: c3, matching: find.text('Senior')),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'muestra la fila de inglés con el error repetido antes → después',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final id = await _reinterviewFeedbackReady(api);
      await _pump(tester, api, id);

      expect(
        find.text('I have went to the office. → I have gone to the office.'),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('interview_compare_english_empty')),
        findsNothing,
      );
    },
  );

  testWidgets('muestra el aviso de IA y no tiene botón de compartir', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final id = await _reinterviewFeedbackReady(api);
    await _pump(tester, api, id);

    expect(
      find.text('Comparación orientativa generada por IA.'),
      findsOneWidget,
    );
    expect(find.byIcon(Icons.share), findsNothing);
    expect(find.textContaining('Compartir'), findsNothing);
  });

  testWidgets('"Ver el parecer completo" navega al parecer de la entrevista', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final id = await _reinterviewFeedbackReady(api);
    await _pump(tester, api, id);

    await tester.tap(
      find.byKey(const Key('interview_compare_view_feedback_button')),
    );
    await tester.pumpAndSettle();

    expect(find.text('FEEDBACK_$id'), findsOneWidget);
  });
}

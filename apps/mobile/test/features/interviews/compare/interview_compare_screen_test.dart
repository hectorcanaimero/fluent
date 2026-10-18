import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/compare/interview_compare_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

Future<void> _pump(
  WidgetTester tester,
  FakeApi api,
  String id, {
  bool settle = true,
}) async {
  await tester.binding.setSurfaceSize(const Size(800, 1600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final router = GoRouter(
    initialLocation: '/interviews/$id/compare',
    routes: [
      GoRoute(
        path: '/interviews/:id',
        builder: (context, state) =>
            Scaffold(body: Text('DETAIL_${state.pathParameters['id']}')),
      ),
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
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump();
    await tester.pump();
  }
}

/// Lleva una entrevista de `preparing` a `feedback_ready` (el `getInterview`
/// de [FakeApi] avanza un paso por llamada).
Future<void> _finish(FakeApi api, String id) async {
  await api.getInterview(id);
  await api.getInterview(id);
  await api.getInterview(id);
  await api.startInterviewSession(id);
  api.setInterviewAnsweredCount(id, 8);
  api.finishInterview(id);
  await api.getInterview(id); // feedback_pending → feedback_ready
}

/// Padre terminada con el ciclo completo y su re-entrevista hija recién
/// creada (`preparing`).
Future<(String, String)> _parentAndChild(FakeApi api) async {
  final parent = await api.createInterview(
    type: 'technical',
    offerText: 'Senior Backend Engineer at Acme',
  );
  await _finish(api, parent.id);
  await api.createStudyCycle(parent.id);
  for (var idx = 1; idx <= 5; idx++) {
    api.completeStudySession(parent.id, idx);
  }
  final child = await api.reinterview(parent.id);
  return (parent.id, child.id);
}

/// El parecer de la hija en `feedback_ready` (con `comparison`, F13.1.T2).
Future<String> _reinterviewFeedbackReady(FakeApi api) async {
  final (_, child) = await _parentAndChild(api);
  await _finish(api, child);
  return child;
}

/// La primera ficha sale en `feedback_pending` y recién el repolleo de
/// `interviewProvider` la ve lista.
class _PendingOnceApi extends FakeApi {
  _PendingOnceApi() : super(artificialDelay: Duration.zero);

  String? pendingId;
  final feedbackCalls = <String>[];

  @override
  Future<InterviewDetail> getInterview(String id) async {
    final detail = await super.getInterview(id);
    if (id != pendingId) return detail;
    pendingId = null;
    return detail.copyWith(status: 'feedback_pending');
  }

  @override
  Future<InterviewFeedback> getInterviewFeedback(String id) {
    feedbackCalls.add(id);
    return super.getInterviewFeedback(id);
  }
}

void main() {
  testWidgets(
    'muestra las tres competencias con nombre y estado: avanzó, igual y '
    'retrocedió',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final id = await _reinterviewFeedbackReady(api);
      await _pump(tester, api, id);

      expect(find.text('Así cambiaste'), findsOneWidget);

      final c1 = find.byKey(const Key('interview_compare_competency_c1'));
      expect(
        find.descendant(of: c1, matching: find.text('APIs REST')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: c1, matching: find.text('Avanzó')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: c1, matching: find.text('Junior')),
        findsOneWidget,
      );

      final c2 = find.byKey(const Key('interview_compare_competency_c2'));
      expect(
        find.descendant(of: c2, matching: find.text('Igual')),
        findsOneWidget,
      );

      final c3 = find.byKey(const Key('interview_compare_competency_c3'));
      expect(
        find.descendant(of: c3, matching: find.text('Retrocedió')),
        findsOneWidget,
      );
      expect(
        find.descendant(of: c3, matching: find.text('Senior')),
        findsOneWidget,
      );
      expect(find.text('c1'), findsNothing);
      expect(
        find.byKey(const Key('interview_compare_name_placeholder')),
        findsNothing,
      );
    },
  );

  testWidgets(
    'FR-30: errores de inglés antes → después contra la padre y solo los '
    'repetidos en "Se repitieron"',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final id = await _reinterviewFeedbackReady(api);
      await _pump(tester, api, id);

      expect(find.text('Errores de inglés: 2 → 2'), findsOneWidget);
      expect(find.text('Se repitieron'), findsOneWidget);
      // Misma corrección normalizada (sin el punto final) que en la padre.
      expect(
        find.text('I have went to office. → I have gone to the office'),
        findsOneWidget,
      );
      // Error nuevo de la hija: no se repitió.
      expect(find.textContaining('There is much people.'), findsNothing);
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

  testWidgets('sin comparación (no es re-entrevista): estado vacío y enlace al '
      'parecer, sin titular', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final (parent, _) = await _parentAndChild(api);
    await _pump(tester, api, parent);

    expect(find.text('Esta entrevista no tiene comparación'), findsOneWidget);
    expect(find.text('Así cambiaste'), findsNothing);

    await tester.tap(
      find.byKey(const Key('interview_compare_view_feedback_button')),
    );
    await tester.pumpAndSettle();
    expect(find.text('FEEDBACK_$parent'), findsOneWidget);
  });

  testWidgets('404 NOT_READY: la entrevista no terminó y lleva a su ficha', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final (_, child) = await _parentAndChild(api);
    await api.getInterview(child);
    await api.getInterview(child);
    await api.getInterview(child); // ready, sin terminar
    await _pump(tester, api, child);

    expect(find.text('Así cambiaste'), findsNothing);
    await tester.tap(
      find.byKey(const Key('interview_feedback_open_interview_button')),
    );
    await tester.pumpAndSettle();
    expect(find.text('DETAIL_$child'), findsOneWidget);
  });

  testWidgets(
    'feedback_pending: cargando sin pedir el parecer hasta que el repolleo '
    'lo ve listo',
    (tester) async {
      final api = _PendingOnceApi();
      final id = await _reinterviewFeedbackReady(api);
      api.pendingId = id;
      await _pump(tester, api, id, settle: false);

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(api.feedbackCalls, isNot(contains(id)));

      await tester.pump(const Duration(seconds: 3));
      await tester.pumpAndSettle();
      expect(api.feedbackCalls.where((c) => c == id), hasLength(1));
      expect(find.text('Así cambiaste'), findsOneWidget);
    },
  );

  testWidgets(
    '"Ver el parecer completo" sin venir del parecer lo reemplaza (no apila)',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final id = await _reinterviewFeedbackReady(api);
      await _pump(tester, api, id);

      await tester.tap(
        find.byKey(const Key('interview_compare_view_feedback_button')),
      );
      await tester.pumpAndSettle();

      expect(find.text('FEEDBACK_$id'), findsOneWidget);
      final router = GoRouter.of(tester.element(find.text('FEEDBACK_$id')));
      expect(router.canPop(), isFalse);
    },
  );
}

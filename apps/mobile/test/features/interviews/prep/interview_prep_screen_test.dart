import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/prep/interview_prep_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

Widget _wrap(FakeApi api, String id, {String? sessionRouteText}) {
  final router = GoRouter(
    initialLocation: '/interviews/$id',
    routes: [
      GoRoute(
        path: '/interviews/:id',
        builder: (context, state) =>
            InterviewPrepScreen(interviewId: state.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'session',
            builder: (context, state) => Text(
              sessionRouteText ?? 'SESSION_${state.pathParameters['id']}',
            ),
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

/// Avanza un paso de `preparing` (`FakeApi.getInterview` avanza en cada
/// llamada): la pantalla repolla sola cada 3 s vía `interviewProvider`.
Future<void> _advanceOnePrepStep(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 3));
  await tester.pump();
}

void main() {
  testWidgets(
    'IE-03→IE-04: recorre reading → researching → designing → ready sin mostrar preguntas',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createInterview(
        type: 'technical',
        offerText: 'Senior Backend Engineer at Acme',
      );
      // Recién creada: `reading`, antes de que la pantalla haga su primer
      // poll (FakeApi avanza un paso en cada `getInterview`).
      expect(created.prepStep, 'reading');

      await tester.pumpWidget(_wrap(api, created.id));
      await tester.pump();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      // Primer poll: ya pasó a `researching` con `reading` tildado.
      expect(find.text(l10n.interviewPrepEtaHint), findsOneWidget);
      expect(find.text(l10n.interviewPrepExitHint), findsOneWidget);
      expect(find.byIcon(Icons.check_circle), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await _advanceOnePrepStep(tester);
      // Segundo poll: `designing`, con `reading` y `researching` tildados.
      expect(find.byIcon(Icons.check_circle), findsNWidgets(2));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await _advanceOnePrepStep(tester);
      await tester.pumpAndSettle();

      // IE-04: ficha de empresa, rol/área/seniority/tipo, duración y
      // competencias como chips, pero nunca el texto de las preguntas.
      expect(find.text('Acme Corp'), findsOneWidget);
      expect(
        find.text(l10n.interviewPlanQuestionsSummary(8, 10)),
        findsOneWidget,
      );
      expect(find.text(l10n.interviewFreeNotice), findsOneWidget);
      expect(find.byType(Chip), findsNWidgets(4));
      expect(find.textContaining('?'), findsNothing);
      expect(
        find.byKey(const Key('interview_plan_low_info_badge')),
        findsNothing,
      );

      await tester.tap(find.byKey(const Key('interview_plan_start_button')));
      await tester.pumpAndSettle();
      expect(find.text('SESSION_${created.id}'), findsOneWidget);
    },
  );

  testWidgets('IE-03b: una preparación fallida muestra Reintentar', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createInterview(
      type: 'technical',
      offerText: 'Senior Backend Engineer at Acme',
    );
    api.forceInterviewPrepFailed(created.id);

    await tester.pumpWidget(_wrap(api, created.id));
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.interviewPrepFailedTitle), findsOneWidget);
    final retryButton = find.byKey(const Key('interview_prep_retry_button'));
    expect(retryButton, findsOneWidget);

    await tester.tap(retryButton);
    await tester.pump();
    await tester.pump();

    // Volvió a `preparing`: el panel de fallo desaparece.
    expect(find.text(l10n.interviewPrepFailedTitle), findsNothing);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    // Deja que el nuevo repolleo llegue a `ready` para no dejar un Timer
    // pendiente de `Future.delayed` colgado al terminar el test.
    await _advanceOnePrepStep(tester);
    await _advanceOnePrepStep(tester);
    await tester.pumpAndSettle();
  });
}

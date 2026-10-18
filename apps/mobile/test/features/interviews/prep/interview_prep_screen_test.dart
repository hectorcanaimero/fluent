import 'dart:async';

import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
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
          GoRoute(
            path: 'feedback',
            builder: (context, state) =>
                Text('FEEDBACK_${state.pathParameters['id']}'),
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

/// `GET /interviews/:id` devuelve siempre [detail] (estados que el flujo
/// del FakeApi no alcanza solo, o fichas a medida).
class _FixedApi extends FakeApi {
  _FixedApi(this.detail) : super(artificialDelay: Duration.zero);

  final InterviewDetail detail;

  @override
  Future<InterviewDetail> getInterview(String id) async => detail;
}

/// `retryInterview` queda colgado hasta [release] (reintento en vuelo).
class _SlowRetryApi extends _FixedApi {
  _SlowRetryApi(super.detail);

  final release = Completer<void>();
  var retryCalls = 0;

  @override
  Future<InterviewDetail> retryInterview(String id) async {
    retryCalls++;
    await release.future;
    return detail;
  }
}

InterviewDetail _detail({
  required String status,
  String? prepStep,
  CompanyInfo? company,
  String? role,
  bool resumable = false,
}) => InterviewDetail(
  id: 'i1',
  type: 'technical',
  status: status,
  createdAt: '2026-10-18T10:00:00.000Z',
  prepStep: prepStep,
  company: company,
  role: role,
  resumable: resumable,
);

/// Avanza un paso de `preparing` (`FakeApi.getInterview` avanza en cada
/// llamada): la pantalla repolla sola cada 3 s vía `interviewProvider`.
Future<void> _advanceOnePrepStep(WidgetTester tester) async {
  await tester.pump(const Duration(seconds: 3));
  await tester.pump();
}

/// Desmonta (corta el repolleo de `preparing`/`feedback_pending`) y deja
/// vencer el `Future.delayed` que quedó en vuelo.
Future<void> _unmountAndDrain(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 3));
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
      // workMode localizado (`remote` → "Remoto").
      expect(find.text('Software · Buenos Aires · Remoto'), findsOneWidget);
      // IE-04 no reintenta un plan listo (la API solo reintenta prep_failed).
      expect(
        find.byKey(const Key('interview_plan_retry_button')),
        findsNothing,
      );
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

  testWidgets('IE-03b: Reintentar se deshabilita mientras está en vuelo', (
    tester,
  ) async {
    final api = _SlowRetryApi(_detail(status: 'prep_failed'));

    await tester.pumpWidget(_wrap(api, 'i1'));
    await tester.pumpAndSettle();

    final retryButton = find.byKey(const Key('interview_prep_retry_button'));
    await tester.tap(retryButton);
    await tester.pump();
    expect(tester.widget<ElevatedButton>(retryButton).onPressed, isNull);
    await tester.tap(retryButton, warnIfMissed: false);
    expect(api.retryCalls, 1);

    api.release.complete();
    await tester.pumpAndSettle();
    expect(tester.widget<ElevatedButton>(retryButton).onPressed, isNotNull);
  });

  testWidgets('prepStep done mientras preparing: dos tildes y spinner', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(_FixedApi(_detail(status: 'preparing', prepStep: 'done')), 'i1'),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byIcon(Icons.check_circle), findsNWidgets(2));
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    // IE-03a: ya pasó `researching` y la ficha de empresa sigue vacía.
    expect(
      find.byKey(const Key('interview_plan_low_info_badge')),
      findsOneWidget,
    );
    await _unmountAndDrain(tester);
  });

  testWidgets('prepStep desconocido arranca en el primer paso', (tester) async {
    await tester.pumpWidget(
      _wrap(_FixedApi(_detail(status: 'preparing', prepStep: 'zzz')), 'i1'),
    );
    await tester.pump();
    await tester.pump();

    expect(find.byIcon(Icons.check_circle), findsNothing);
    expect(
      find.byKey(const Key('interview_plan_low_info_badge')),
      findsNothing,
    );
    await _unmountAndDrain(tester);
  });

  testWidgets('IE-04 a 360dp: rol largo y workMode desconocido sin overflow', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final role = 'Senior Staff Principal Distributed Systems ' * 4;
    await tester.pumpWidget(
      _wrap(
        _FixedApi(
          _detail(
            status: 'ready',
            role: role,
            company: const CompanyInfo(name: 'Globex', workMode: 'flex'),
          ),
        ),
        'i1',
      ),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text(role), findsOneWidget);
    expect(find.text('flex'), findsOneWidget);
  });

  for (final (status, resumable) in [
    ('in_progress', false),
    ('too_short', true),
  ]) {
    testWidgets('$status (resumable: $resumable) → Continuar a la sesión', (
      tester,
    ) async {
      await tester.pumpWidget(
        _wrap(_FixedApi(_detail(status: status, resumable: resumable)), 'i1'),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.interviewInProgressTitle), findsOneWidget);
      await tester.tap(find.byKey(const Key('interview_continue_button')));
      await tester.pumpAndSettle();
      expect(find.text('SESSION_i1'), findsOneWidget);
    });
  }

  for (final status in [
    'too_short',
    'feedback_pending',
    'feedback_ready',
    'feedback_failed',
  ]) {
    testWidgets('$status → Ver parecer', (tester) async {
      await tester.pumpWidget(_wrap(_FixedApi(_detail(status: status)), 'i1'));
      await tester.pump();
      await tester.pump();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.interviewFinishedTitle), findsOneWidget);
      await tester.tap(find.byKey(const Key('interview_view_feedback_button')));
      await tester.pumpAndSettle();
      expect(find.text('FEEDBACK_i1'), findsOneWidget);
      await _unmountAndDrain(tester);
    });
  }
}

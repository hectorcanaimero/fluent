import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/entry/new_interview_screen.dart';
import 'package:fluent_mobile/features/interviews/presentation/history/interview_history_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

/// `GET /interviews` devuelve siempre [summaries].
class _FixedListApi extends FakeApi {
  _FixedListApi(this.summaries) : super(artificialDelay: Duration.zero);

  List<InterviewSummary> summaries;
  int listCalls = 0;

  @override
  Future<List<InterviewSummary>> getInterviews() async {
    listCalls++;
    return summaries;
  }
}

Widget _wrap(FakeApi api, {Widget newInterview = const Text('NEW_INTERVIEW')}) {
  final router = GoRouter(
    initialLocation: '/interviews',
    routes: [
      GoRoute(
        path: '/interviews',
        builder: (context, state) => const InterviewHistoryScreen(),
        routes: [
          GoRoute(path: 'new', builder: (context, state) => newInterview),
          GoRoute(
            path: ':id',
            builder: (context, state) =>
                Text('PREP_${state.pathParameters['id']}'),
            routes: [
              GoRoute(
                path: 'feedback',
                builder: (context, state) =>
                    Text('FEEDBACK_${state.pathParameters['id']}'),
              ),
              GoRoute(
                path: 'cycle',
                builder: (context, state) =>
                    Text('CYCLE_${state.pathParameters['id']}'),
              ),
            ],
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

const _october = [
  InterviewSummary(
    id: 'i1',
    type: 'technical',
    status: 'preparing',
    createdAt: '2026-10-15T10:00:00.000Z',
    role: 'Backend',
    company: CompanyInfo(name: 'Acme'),
  ),
  InterviewSummary(
    id: 'i2',
    type: 'technical',
    status: 'in_progress',
    createdAt: '2026-10-10T10:00:00.000Z',
    role: 'Backend',
    company: CompanyInfo(name: 'Globex'),
  ),
  InterviewSummary(
    id: 'i3',
    type: 'mixed',
    status: 'feedback_ready',
    createdAt: '2026-10-05T10:00:00.000Z',
    role: 'Frontend',
    company: CompanyInfo(name: 'Initech'),
  ),
];

const _september = [
  InterviewSummary(
    id: 'i4',
    type: 'technical',
    status: 'feedback_ready',
    createdAt: '2026-09-20T10:00:00.000Z',
    role: 'Data',
    company: CompanyInfo(name: 'Hooli'),
    cycleCompletedSessions: 2,
  ),
  InterviewSummary(
    id: 'i5',
    type: 'technical',
    status: 'feedback_ready',
    createdAt: '2026-09-10T10:00:00.000Z',
    role: 'Data',
    company: CompanyInfo(name: 'Umbrella'),
    isReinterview: true,
  ),
];

void main() {
  testWidgets(
    'IE-09: 5 entrevistas en distintos estados, agrupadas por mes, cada una '
    'navega a su pantalla',
    (tester) async {
      await tester.pumpWidget(
        _wrap(_FixedListApi([..._october, ..._september])),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      final locale = Localizations.localeOf(
        tester.element(find.byType(InterviewHistoryScreen)),
      ).toLanguageTag();

      expect(
        find.text(DateFormat.yMMMM(locale).format(DateTime(2026, 10))),
        findsOneWidget,
      );
      expect(
        find.text(DateFormat.yMMMM(locale).format(DateTime(2026, 9))),
        findsOneWidget,
      );

      expect(find.text(l10n.interviewHistoryStatusPreparing), findsOneWidget);
      expect(find.text(l10n.interviewHistoryStatusUnfinished), findsOneWidget);
      expect(
        find.text(l10n.interviewHistoryStatusFeedbackReady),
        findsOneWidget,
      );
      expect(find.text(l10n.interviewHistoryStatusCycle(3)), findsOneWidget);
      expect(
        find.text(l10n.interviewHistoryStatusReinterviewDone),
        findsOneWidget,
      );

      // Preparando… → la pantalla de preparación (IE-03/03b/04).
      await tester.tap(find.byKey(const Key('interview_history_row_i1')));
      await tester.pumpAndSettle();
      expect(find.text('PREP_i1'), findsOneWidget);
    },
  );

  testWidgets('Sin terminar → la pantalla de preparación', (tester) async {
    await tester.pumpWidget(_wrap(_FixedListApi(_october)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('interview_history_row_i2')));
    await tester.pumpAndSettle();
    expect(find.text('PREP_i2'), findsOneWidget);
  });

  testWidgets('Parecer listo → el parecer', (tester) async {
    await tester.pumpWidget(_wrap(_FixedListApi(_october)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('interview_history_row_i3')));
    await tester.pumpAndSettle();
    expect(find.text('FEEDBACK_i3'), findsOneWidget);
  });

  testWidgets('Ciclo n de 5 → el ciclo de estudio', (tester) async {
    await tester.pumpWidget(_wrap(_FixedListApi(_september)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('interview_history_row_i4')));
    await tester.pumpAndSettle();
    expect(find.text('CYCLE_i4'), findsOneWidget);
  });

  testWidgets('Re-entrevista hecha → el parecer', (tester) async {
    await tester.pumpWidget(_wrap(_FixedListApi(_september)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('interview_history_row_i5')));
    await tester.pumpAndSettle();
    expect(find.text('FEEDBACK_i5'), findsOneWidget);
  });

  testWidgets('el botón de nueva entrevista navega a /interviews/new', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(_FixedListApi(_october)));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('interview_history_new_button')));
    await tester.pumpAndSettle();
    expect(find.text('NEW_INTERVIEW'), findsOneWidget);
  });

  testWidgets('sin entrevistas muestra el estado vacío', (tester) async {
    await tester.pumpWidget(_wrap(_FixedListApi(const [])));
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.interviewHistoryEmpty), findsOneWidget);
  });

  InterviewSummary summary(
    String id,
    String status, {
    bool resumable = false,
    String createdAt = '2026-10-15T10:00:00.000Z',
  }) => InterviewSummary(
    id: id,
    type: 'technical',
    status: status,
    createdAt: createdAt,
    resumable: resumable,
  );

  final l10nFuture = AppLocalizations.delegate.load(const Locale('es'));

  for (final (status, resumable, label, target) in [
    (
      'prep_failed',
      false,
      (AppLocalizations l) => l.interviewHistoryStatusPrepFailed,
      'PREP_x',
    ),
    (
      'feedback_pending',
      false,
      (AppLocalizations l) => l.interviewHistoryStatusFeedbackPending,
      'FEEDBACK_x',
    ),
    (
      'feedback_failed',
      false,
      (AppLocalizations l) => l.interviewHistoryStatusFeedbackFailed,
      'FEEDBACK_x',
    ),
    (
      'too_short',
      true,
      (AppLocalizations l) => l.interviewHistoryStatusUnfinished,
      'PREP_x',
    ),
    (
      'too_short',
      false,
      (AppLocalizations l) => l.interviewHistoryStatusFinishedNoFeedback,
      'PREP_x',
    ),
    (
      'in_progress',
      false,
      (AppLocalizations l) => l.interviewHistoryStatusUnfinished,
      'PREP_x',
    ),
  ]) {
    testWidgets('$status (resumable: $resumable) → su etiqueta y $target', (
      tester,
    ) async {
      final l10n = await l10nFuture;
      await tester.pumpWidget(
        _wrap(_FixedListApi([summary('x', status, resumable: resumable)])),
      );
      await tester.pumpAndSettle();
      expect(find.text(label(l10n)), findsOneWidget);
      await tester.tap(find.byKey(const Key('interview_history_row_x')));
      await tester.pumpAndSettle();
      expect(find.text(target), findsOneWidget);
    });
  }

  testWidgets('un ciclo sin terminar manda sobre "Re-entrevista hecha"', (
    tester,
  ) async {
    final l10n = await l10nFuture;
    await tester.pumpWidget(
      _wrap(
        _FixedListApi(const [
          InterviewSummary(
            id: 'r',
            type: 'technical',
            status: 'feedback_ready',
            createdAt: '2026-10-15T10:00:00.000Z',
            isReinterview: true,
            cycleCompletedSessions: 1,
          ),
        ]),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text(l10n.interviewHistoryStatusCycle(2)), findsOneWidget);
    expect(find.text(l10n.interviewHistoryStatusReinterviewDone), findsNothing);
    await tester.tap(find.byKey(const Key('interview_history_row_r')));
    await tester.pumpAndSettle();
    expect(find.text('CYCLE_r'), findsOneWidget);
  });

  testWidgets('createdAt ilegible → "Fecha desconocida" al final, sin fecha', (
    tester,
  ) async {
    final l10n = await l10nFuture;
    await tester.pumpWidget(
      _wrap(
        _FixedListApi([
          summary('bad', 'in_progress', createdAt: 'no-es-fecha'),
          summary('ok', 'in_progress'),
        ]),
      ),
    );
    await tester.pumpAndSettle();
    final unknown = find.text(l10n.interviewHistoryUnknownDate);
    expect(unknown, findsOneWidget);
    final locale = Localizations.localeOf(
      tester.element(find.byType(InterviewHistoryScreen)),
    ).toLanguageTag();
    final october = find.text(
      DateFormat.yMMMM(locale).format(DateTime(2026, 10)),
    );
    expect(
      tester.getTopLeft(october).dy < tester.getTopLeft(unknown).dy,
      isTrue,
    );
    expect(
      tester.getTopLeft(unknown).dy <
          tester
              .getTopLeft(find.byKey(const Key('interview_history_row_bad')))
              .dy,
      isTrue,
    );
    final subtitle = tester.widget<ListTile>(
      find.byKey(const Key('interview_history_row_bad')),
    );
    expect((subtitle.subtitle! as Text).data, l10n.interviewTypeTechnical);
  });

  testWidgets('al volver de una fila se vuelve a pedir la lista', (
    tester,
  ) async {
    final l10n = await l10nFuture;
    final api = _FixedListApi([summary('x', 'preparing')]);
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();
    expect(api.listCalls, 1);

    await tester.tap(find.byKey(const Key('interview_history_row_x')));
    await tester.pumpAndSettle();
    api.summaries = [summary('x', 'feedback_pending')];
    final nav = tester.state<NavigatorState>(find.byType(Navigator).last);
    nav.pop();
    await tester.pumpAndSettle();

    expect(api.listCalls, 2);
    expect(
      find.text(l10n.interviewHistoryStatusFeedbackPending),
      findsOneWidget,
    );
  });

  testWidgets('tirar hacia abajo vuelve a pedir la lista', (tester) async {
    final l10n = await l10nFuture;
    final api = _FixedListApi([summary('x', 'preparing')]);
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    api.summaries = [summary('x', 'feedback_failed')];
    await tester.fling(
      find.byKey(const Key('interview_history_row_x')),
      const Offset(0, 400),
      1000,
    );
    await tester.pumpAndSettle();

    expect(api.listCalls, 2);
    expect(
      find.text(l10n.interviewHistoryStatusFeedbackFailed),
      findsOneWidget,
    );
  });

  testWidgets(
    'historial → nueva → botón de historial vuelve atrás sin apilar otro',
    (tester) async {
      await tester.pumpWidget(
        _wrap(
          _FixedListApi([summary('x', 'preparing')]),
          newInterview: const NewInterviewScreen(),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const Key('interview_history_new_button')));
      await tester.pumpAndSettle();
      expect(find.byType(NewInterviewScreen), findsOneWidget);

      await tester.tap(find.byKey(const Key('interview_entry_history_button')));
      await tester.pumpAndSettle();
      expect(find.byType(NewInterviewScreen), findsNothing);
      expect(find.byType(InterviewHistoryScreen), findsOneWidget);
      expect(
        GoRouter.of(tester.element(find.byType(InterviewHistoryScreen)))
            .canPop(),
        isFalse,
      );
    },
  );
}

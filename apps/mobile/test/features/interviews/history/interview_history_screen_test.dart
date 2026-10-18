import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
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

  final List<InterviewSummary> summaries;

  @override
  Future<List<InterviewSummary>> getInterviews() async => summaries;
}

Widget _wrap(FakeApi api) {
  final router = GoRouter(
    initialLocation: '/interviews',
    routes: [
      GoRoute(
        path: '/interviews',
        builder: (context, state) => const InterviewHistoryScreen(),
        routes: [
          GoRoute(
            path: 'new',
            builder: (context, state) => const Text('NEW_INTERVIEW'),
          ),
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
      await tester.pumpWidget(_wrap(_FixedListApi([..._october, ..._september])));
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
}

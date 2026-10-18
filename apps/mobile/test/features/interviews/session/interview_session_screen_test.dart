import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/session/interview_session_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// `POST /interviews/:id/session` que falla con [error].
class _FailingStartApi extends FakeApi {
  _FailingStartApi(this.error) : super(artificialDelay: Duration.zero);

  final ApiException error;
  final List<String> requested = [];

  @override
  Future<InterviewSessionStart> startInterviewSession(String id) async {
    requested.add(id);
    throw error;
  }
}

Future<void> _pump(WidgetTester tester, FakeApi api) async {
  final router = GoRouter(
    initialLocation: '/interviews/i-1/session',
    routes: [
      GoRoute(
        path: '/interviews/:id',
        builder: (context, state) =>
            Text('DETAIL_${state.pathParameters['id']}'),
        routes: [
          GoRoute(
            path: 'session',
            builder: (context, state) => InterviewSessionScreen(
              interviewId: state.pathParameters['id']!,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/session/:id',
        builder: (context, state) =>
            Text('NORMAL_SESSION_${state.pathParameters['id']}'),
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

void main() {
  test('ApiException.fromBody lee activeSession.interviewId del 409', () {
    final e = ApiException.fromBody({
      'error': 'SESSION_ALREADY_ACTIVE',
      'message': 'ya hay una',
      'activeSessionId': 's-9',
      'activeSession': {'id': 's-9', 'kind': 'interview', 'interviewId': 'i-2'},
    }, statusCode: 409);
    expect(e.code, ApiErrorCode.sessionAlreadyActive);
    expect(e.activeSessionRoute, '/interviews/i-2/session');

    final normal = ApiException.fromBody({
      'error': 'SESSION_ALREADY_ACTIVE',
      'message': 'ya hay una',
      'activeSessionId': 's-9',
    });
    expect(normal.activeSessionRoute, '/session/s-9');
    expect(
      ApiErrorCode.fromWire('INTERVIEW_NOT_OPENABLE'),
      ApiErrorCode.interviewNotOpenable,
    );
  });

  testWidgets(
    'SESSION_ALREADY_ACTIVE de otra entrevista: el CTA la retoma en modo '
    'entrevista, no en /session/:id',
    (tester) async {
      final api = _FailingStartApi(
        const ApiException(
          code: ApiErrorCode.sessionAlreadyActive,
          message: 'busy',
          statusCode: 409,
          activeSessionId: 's-9',
          activeInterviewId: 'i-2',
        ),
      );
      await _pump(tester, api);

      await tester.tap(
        find.byKey(const Key('interview_session_active_session_cta')),
      );
      await tester.pumpAndSettle();

      // Abrió `/interviews/i-2/session` (que con este doble falla igual).
      expect(api.requested, ['i-1', 'i-2']);
      expect(find.textContaining('NORMAL_SESSION_'), findsNothing);
    },
  );

  testWidgets(
    'INTERVIEW_NOT_OPENABLE vuelve al detalle en vez de ofrecer reintentar',
    (tester) async {
      await _pump(
        tester,
        _FailingStartApi(
          const ApiException(
            code: ApiErrorCode.interviewNotOpenable,
            message: 'no',
            statusCode: 409,
          ),
        ),
      );

      expect(find.text('DETAIL_i-1'), findsOneWidget);
      expect(
        find.byKey(const Key('interview_session_retry_button')),
        findsNothing,
      );
    },
  );

  testWidgets('el error tiene flecha para volver', (tester) async {
    await _pump(
      tester,
      _FailingStartApi(
        const ApiException(
          code: ApiErrorCode.internal,
          message: 'boom',
          statusCode: 500,
        ),
      ),
    );

    expect(find.byKey(const Key('interview_session_retry_button')), findsOne);
    await tester.tap(find.byKey(const Key('interview_session_error_back')));
    await tester.pumpAndSettle();
    expect(find.text('DETAIL_i-1'), findsOneWidget);
  });
}

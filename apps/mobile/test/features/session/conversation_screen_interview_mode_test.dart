import 'package:dio/dio.dart' show CancelToken;
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/api/turn_stream_event.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/data/auth_controller.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/session/data/speech_service.dart';
import 'package:fluent_mobile/features/session/data/tts_service.dart';
import 'package:fluent_mobile/features/session/domain/chat_message.dart';
import 'package:fluent_mobile/features/session/presentation/conversation_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// F12.4.T1: sesión `kind = 'interview'` — turnos resueltos de una (sin
/// desglosar en tokens, igual que `_InstantReplyApi` del test de arriba) con
/// el `TurnResult.interview` y las correcciones que indiquen los tests.
class _InterviewApi extends FakeApi {
  _InterviewApi({super.artificialDelay});

  TurnInterviewInfo? nextInterview;
  List<Correction> nextCorrections = const [];

  /// Textos que llegaron a `sendTurn` (también los que fallaron).
  final List<String> sentTexts = [];

  /// Si no es null, el próximo turno falla con esta excepción (una vez).
  ApiException? failNext;

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) async {
    sentTexts.add(text);
    final fail = failNext;
    if (fail != null) {
      failNext = null;
      throw fail;
    }
    final base = await super.sendTurn(
      sessionId: sessionId,
      text: text,
      cancelToken: cancelToken,
    );
    return base.copyWith(
      corrections: nextCorrections,
      interview: nextInterview,
    );
  }

  @override
  Stream<TurnStreamEvent> sendTurnStream({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) async* {
    yield TurnStreamDone(
      await sendTurn(
        sessionId: sessionId,
        text: text,
        cancelToken: cancelToken,
      ),
    );
  }
}

const _delegates = [
  AppLocalizations.delegate,
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
];

/// Conversación en modo entrevista bajo un router con el detalle y el
/// parecer como destinos, y un `AuthController` con [sessionId] activa.
Future<AuthController> _pumpInterview(
  WidgetTester tester,
  _InterviewApi api,
  String sessionId, {
  FakeSpeechService? speech,
  FakeTtsService? tts,
  TurnInterviewInfo? initialInterview,
}) async {
  final auth = AuthController(tokenStore: InMemoryTokenStore(), api: api);
  auth.state = AuthState(
    status: AuthStatus.authenticated,
    onboarded: true,
    activeSessionId: sessionId,
    activeSessionKind: 'interview',
    activeInterviewId: 'interview-1',
  );
  final router = GoRouter(
    initialLocation: '/interviews/interview-1/session',
    routes: [
      GoRoute(
        path: '/interviews/:id',
        builder: (context, state) =>
            Text('DETAIL_SCREEN_${state.pathParameters['id']}'),
        routes: [
          GoRoute(
            path: 'session',
            builder: (context, state) => ConversationScreen(
              sessionId: sessionId,
              mode: ConversationMode.interview,
              interviewId: state.pathParameters['id'],
              initialInterview: initialInterview,
            ),
          ),
          GoRoute(
            path: 'feedback',
            builder: (context, state) =>
                Text('FEEDBACK_SCREEN_${state.pathParameters['id']}'),
          ),
        ],
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        fluentApiProvider.overrideWith((ref) => api),
        authControllerProvider.overrideWith((ref) => auth),
        speechServiceProvider.overrideWith(
          (ref) => speech ?? FakeSpeechService(),
        ),
        ttsServiceProvider.overrideWith((ref) => tts ?? FakeTtsService()),
      ],
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: _delegates,
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return auth;
}

void main() {
  testWidgets(
    'modo entrevista: pasar a segundo plano corta mic y TTS y deja la '
    'respuesta pendiente sin enviarla; al volver se puede enviar',
    (tester) async {
      final api = _InterviewApi(artificialDelay: Duration.zero);
      final created = await api.createSession(kind: 'interview');
      final speech = FakeSpeechService();
      final tts = FakeTtsService();
      await _pumpInterview(
        tester,
        api,
        created.session.id,
        speech: speech,
        tts: tts,
      );

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();
      speech.emit('I led a team of five');
      await tester.pump();

      for (final state in const [
        AppLifecycleState.inactive,
        AppLifecycleState.hidden,
        AppLifecycleState.paused,
      ]) {
        tester.binding.handleAppLifecycleStateChanged(state);
      }
      await tester.pumpAndSettle();

      expect(speech.cancelCalled, isTrue);
      expect(tts.stopCalled, isTrue);
      expect(api.sentTexts, isEmpty);
      expect(find.byKey(const Key('conversation_draft_field')), findsNothing);
      expect(find.text('I led a team of five'), findsOneWidget);

      for (final state in const [
        AppLifecycleState.hidden,
        AppLifecycleState.inactive,
        AppLifecycleState.resumed,
      ]) {
        tester.binding.handleAppLifecycleStateChanged(state);
      }
      await tester.pumpAndSettle();
      expect(api.sentTexts, isEmpty);

      await tester.tap(
        find.byKey(const Key('conversation_pending_send_button')),
      );
      await tester.pumpAndSettle();
      expect(api.sentTexts, ['I led a team of five']);
    },
  );

  testWidgets(
    'modo entrevista: si el turno falla no hay revisión editable sino '
    '"Reintentar envío" con la misma transcripción',
    (tester) async {
      final api = _InterviewApi(artificialDelay: Duration.zero)
        ..failNext = const ApiException(
          code: ApiErrorCode.internal,
          message: 'boom',
          statusCode: 500,
        );
      final created = await api.createSession(kind: 'interview');
      final speech = FakeSpeechService();
      await _pumpInterview(tester, api, created.session.id, speech: speech);

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();
      speech.emit('I shipped it on time', isFinal: true);
      await tester.pump();
      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.byKey(const Key('conversation_draft_field')), findsNothing);
      expect(find.text(l10n.conversationInterviewRetrySend), findsOneWidget);

      await tester.tap(find.text(l10n.conversationInterviewRetrySend));
      await tester.pumpAndSettle();
      expect(api.sentTexts, ['I shipped it on time', 'I shipped it on time']);
      expect(find.text(l10n.conversationInterviewRetrySend), findsNothing);
    },
  );

  for (final code in const [
    ApiErrorCode.sessionNotActive,
    ApiErrorCode.interviewNotResumable,
  ]) {
    testWidgets(
      'modo entrevista: $code en un turno limpia la sesión activa y va al '
      'detalle de la entrevista',
      (tester) async {
        final api = _InterviewApi(artificialDelay: Duration.zero)
          ..failNext = ApiException(
            code: code,
            message: 'closed',
            statusCode: 409,
          );
        final created = await api.createSession(kind: 'interview');
        final auth = await _pumpInterview(tester, api, created.session.id);

        await tester.tap(
          find.byKey(const Key('conversation_text_mode_button')),
        );
        await tester.pump();
        await tester.enterText(
          find.byKey(const Key('conversation_draft_field')),
          'late answer',
        );
        await tester.tap(find.byKey(const Key('conversation_send_button')));
        await tester.pumpAndSettle();

        expect(find.text('DETAIL_SCREEN_interview-1'), findsOneWidget);
        expect(auth.state.activeSessionId, isNull);
        expect(auth.state.activeInterviewId, isNull);
      },
    );
  }

  testWidgets(
    'modo entrevista: interview.done limpia la sesión activa antes de ir '
    'al parecer',
    (tester) async {
      final api = _InterviewApi(artificialDelay: Duration.zero)
        ..nextInterview = const TurnInterviewInfo(
          questionIdx: 8,
          totalQuestions: 8,
          competency: 'Comunicación',
          remainingSec: 0,
          done: true,
        );
      final created = await api.createSession(kind: 'interview');
      final auth = await _pumpInterview(tester, api, created.session.id);

      await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('conversation_draft_field')),
        'my last answer',
      );
      await tester.tap(find.byKey(const Key('conversation_send_button')));
      await tester.pumpAndSettle();

      expect(find.text('FEEDBACK_SCREEN_interview-1'), findsOneWidget);
      expect(auth.state.activeSessionId, isNull);
    },
  );

  testWidgets(
    'modo entrevista: el encabezado muestra la pregunta y el tiempo desde '
    'la apertura, y se actualiza con cada turno',
    (tester) async {
      final api = _InterviewApi(artificialDelay: Duration.zero)
        ..nextInterview = const TurnInterviewInfo(
          questionIdx: 4,
          totalQuestions: 8,
          competency: 'Liderazgo',
          remainingSec: 600,
        );
      final created = await api.createSession(kind: 'interview');
      await _pumpInterview(
        tester,
        api,
        created.session.id,
        initialInterview: const TurnInterviewInfo(
          questionIdx: 3,
          totalQuestions: 8,
          competency: 'Comunicación',
          remainingSec: 900,
        ),
      );

      expect(find.text('Pregunta 3 de 8'), findsOneWidget);
      expect(find.text('15:00'), findsOneWidget);
      expect(
        find.byKey(const Key('conversation_interview_remaining')),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('conversation_draft_field')),
        'an answer',
      );
      await tester.tap(find.byKey(const Key('conversation_send_button')));
      await tester.pumpAndSettle();

      expect(find.text('Pregunta 4 de 8'), findsOneWidget);
      expect(find.text('10:00'), findsOneWidget);
    },
  );

  testWidgets(
    'modo entrevista: la transcripción de voz se envía sin revisión y sin chips',
    (tester) async {
      final api = _InterviewApi(artificialDelay: Duration.zero);
      // Aunque la API (por error, o por un turno viejo) mandara una
      // corrección, el modo entrevista no la muestra.
      api.nextCorrections = const [
        Correction(
          original: 'I go there yesterday',
          corrected: 'I went there yesterday',
          category: 'past_simple',
          note: 'Usa el pasado simple para acciones terminadas.',
        ),
      ];
      final created = await api.createSession(
        kind: 'interview',
        topic: 'Entrevista',
      );
      final speech = FakeSpeechService();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fluentApiProvider.overrideWith((ref) => api),
            speechServiceProvider.overrideWith((ref) => speech),
            ttsServiceProvider.overrideWith((ref) => FakeTtsService()),
          ],
          child: MaterialApp(
            localizationsDelegates: _delegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: ConversationScreen(
              sessionId: created.session.id,
              mode: ConversationMode.interview,
              interviewId: 'interview-1',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // El aviso del modo entrevista está siempre visible.
      expect(
        find.byKey(const Key('conversation_interview_mode_banner')),
        findsOneWidget,
      );

      // idle -> escuchar -> el usuario dice algo y toca el mic para
      // terminar su turno (igual que en modo normal).
      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();
      speech.emit('I go there yesterday', isFinal: true);
      await tester.pump();
      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pumpAndSettle();

      // FR-34: nunca pasa por la pantalla de revisión — el campo editable
      // no aparece en ningún momento de este flujo.
      expect(find.byKey(const Key('conversation_draft_field')), findsNothing);
      // La transcripción queda en el chat tal cual se dijo.
      expect(find.text('I go there yesterday'), findsOneWidget);
      // Sin chips de corrección.
      expect(
        find.byKey(const Key('conversation_correction_chip')),
        findsNothing,
      );
    },
  );

  testWidgets(
    'modo entrevista: un turno vacío (tocar terminar sin decir nada) no se '
    'envía y avisa en vez de mandar una respuesta vacía',
    (tester) async {
      final api = _InterviewApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'interview',
        topic: 'Entrevista',
      );
      final speech = FakeSpeechService();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fluentApiProvider.overrideWith((ref) => api),
            speechServiceProvider.overrideWith((ref) => speech),
            ttsServiceProvider.overrideWith((ref) => FakeTtsService()),
          ],
          child: MaterialApp(
            localizationsDelegates: _delegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: ConversationScreen(
              sessionId: created.session.id,
              mode: ConversationMode.interview,
              interviewId: 'interview-1',
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();
      // Corta sin decir nada.
      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.conversationSttErrorNoMatch), findsOneWidget);
      expect(find.byKey(const Key('conversation_mic_button')), findsOneWidget);
    },
  );

  testWidgets('modo normal: una transcripción de voz sigue pasando por la '
      'revisión editable', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );
    final speech = FakeSpeechService();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          speechServiceProvider.overrideWith((ref) => speech),
          ttsServiceProvider.overrideWith((ref) => FakeTtsService()),
        ],
        child: MaterialApp(
          localizationsDelegates: _delegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: ConversationScreen(sessionId: created.session.id),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.byKey(const Key('conversation_interview_mode_banner')),
      findsNothing,
    );

    await tester.tap(find.byKey(const Key('conversation_mic_button')));
    await tester.pump();
    speech.emit('I go there yesterday', isFinal: true);
    await tester.pump();
    await tester.tap(find.byKey(const Key('conversation_mic_button')));
    await tester.pump();

    // A diferencia del modo entrevista: queda en revisión, editable, sin
    // enviarse todavía.
    final draftField = tester.widget<TextField>(
      find.byKey(const Key('conversation_draft_field')),
    );
    expect(draftField.controller!.text, 'I go there yesterday');
  });

  testWidgets('modo entrevista: interview.done en un turno navega al parecer', (
    tester,
  ) async {
    final api = _InterviewApi(artificialDelay: Duration.zero);
    api.nextInterview = const TurnInterviewInfo(
      questionIdx: 8,
      totalQuestions: 8,
      competency: 'Comunicación',
      remainingSec: 0,
      done: true,
    );
    final created = await api.createSession(
      kind: 'interview',
      topic: 'Entrevista',
    );

    final router = GoRouter(
      initialLocation: '/session/${created.session.id}',
      routes: [
        GoRoute(
          path: '/session/:id',
          builder: (context, state) => ConversationScreen(
            sessionId: state.pathParameters['id']!,
            mode: ConversationMode.interview,
            interviewId: 'interview-1',
          ),
        ),
        GoRoute(
          path: '/interviews/:id/feedback',
          builder: (context, state) =>
              Text('FEEDBACK_SCREEN_${state.pathParameters['id']}'),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          speechServiceProvider.overrideWith((ref) => FakeSpeechService()),
          ttsServiceProvider.overrideWith((ref) => FakeTtsService()),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          localizationsDelegates: _delegates,
          supportedLocales: AppLocalizations.supportedLocales,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
    await tester.pump();
    await tester.enterText(
      find.byKey(const Key('conversation_draft_field')),
      'my last answer',
    );
    await tester.tap(find.byKey(const Key('conversation_send_button')));
    await tester.pumpAndSettle();

    expect(find.text('FEEDBACK_SCREEN_interview-1'), findsOneWidget);
  });

  testWidgets('modo entrevista: Terminar con confirmación navega al parecer', (
    tester,
  ) async {
    final api = _InterviewApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'interview',
      topic: 'Entrevista',
    );

    final router = GoRouter(
      initialLocation: '/session/${created.session.id}',
      routes: [
        GoRoute(
          path: '/session/:id',
          builder: (context, state) => ConversationScreen(
            sessionId: state.pathParameters['id']!,
            mode: ConversationMode.interview,
            interviewId: 'interview-1',
          ),
        ),
        GoRoute(
          path: '/interviews/:id/feedback',
          builder: (context, state) =>
              Text('FEEDBACK_SCREEN_${state.pathParameters['id']}'),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          speechServiceProvider.overrideWith((ref) => FakeSpeechService()),
          ttsServiceProvider.overrideWith((ref) => FakeTtsService()),
        ],
        child: MaterialApp.router(
          routerConfig: router,
          localizationsDelegates: _delegates,
          supportedLocales: AppLocalizations.supportedLocales,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('conversation_end_button')));
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    await tester.tap(find.text(l10n.conversationEndConfirmConfirm));
    await tester.pumpAndSettle();

    expect(find.text('FEEDBACK_SCREEN_interview-1'), findsOneWidget);
  });
}

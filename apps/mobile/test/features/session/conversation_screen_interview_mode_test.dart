import 'package:dio/dio.dart' show CancelToken;
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/api/turn_stream_event.dart';
import 'package:fluent_mobile/core/providers.dart';
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

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) async {
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
      await sendTurn(sessionId: sessionId, text: text, cancelToken: cancelToken),
    );
  }
}

const _delegates = [
  AppLocalizations.delegate,
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
];

void main() {
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
    final created = await api.createSession(kind: 'free_topic', topic: 'Travel');
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

  testWidgets(
    'modo entrevista: interview.done en un turno navega al parecer',
    (tester) async {
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
    },
  );

  testWidgets(
    'modo entrevista: Terminar con confirmación navega al parecer',
    (tester) async {
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
    },
  );
}

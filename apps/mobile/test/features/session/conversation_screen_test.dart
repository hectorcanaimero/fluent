import 'dart:async';

import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/api/turn_stream_event.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/session/data/speech_service.dart';
import 'package:fluent_mobile/features/session/data/tts_service.dart';
import 'package:fluent_mobile/features/session/presentation/conversation_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// Deja emitir eventos del stream a mano, para poder aislar el rebuild que
/// dispara un único token (MEJ-17).
class _ControlledStreamApi extends FakeApi {
  _ControlledStreamApi({super.artificialDelay});

  final _controller = StreamController<TurnStreamEvent>();

  @override
  Stream<TurnStreamEvent> sendTurnStream({
    required String sessionId,
    required String text,
  }) {
    return _controller.stream;
  }

  void emit(TurnStreamEvent event) => _controller.add(event);

  Future<void> closeStream() => _controller.close();
}

/// Simula un stream que arranca bien (algunos `token`) y se corta antes de
/// `done` (conexión perdida, o el `error` SSE de PEND-55 de PR-04.md): la
/// pantalla debe caer al endpoint sin streaming y quedarse con **ese**
/// `reply`, descartando el texto parcial que ya había pintado.
class _StreamDropsBeforeDoneApi extends FakeApi {
  _StreamDropsBeforeDoneApi({super.artificialDelay});

  @override
  Stream<TurnStreamEvent> sendTurnStream({
    required String sessionId,
    required String text,
  }) async* {
    yield const TurnStreamToken('Partial');
    yield const TurnStreamToken(' reply...');
    throw Exception('conexión perdida');
  }

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
  }) async {
    final base = await super.sendTurn(sessionId: sessionId, text: text);
    return base.copyWith(reply: 'Full reply from the non-streaming endpoint.');
  }
}

/// Garantiza que el turno vuelva con al menos una corrección, sin
/// depender de la semilla aleatoria de [FakeApi.sendTurn].
class _AlwaysCorrectingApi extends FakeApi {
  _AlwaysCorrectingApi({super.artificialDelay});

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
  }) async {
    final base = await super.sendTurn(sessionId: sessionId, text: text);
    if (base.corrections.isNotEmpty) return base;
    return base.copyWith(
      corrections: const [
        Correction(
          original: 'I go there yesterday',
          corrected: 'I went there yesterday',
          category: 'past_simple',
          note: 'Usá el pasado simple para acciones terminadas.',
        ),
      ],
    );
  }
}

/// Simula la cadena de modelos agotada: `POST /sessions/:id/turns` no
/// lanza `503 LLM_UNAVAILABLE` (ver `turns.service.ts`), responde `200` con
/// `TurnResult.unavailable: true` siempre, para probar el diálogo de 3
/// intentos seguidos.
class _UnavailableApi extends FakeApi {
  _UnavailableApi({super.artificialDelay});

  int calls = 0;

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
  }) async {
    calls++;
    return const TurnResult(
      turnIdx: 0,
      reply: 'Sorry, I lost my train of thought. Could you say that again?',
      degraded: true,
      unavailable: true,
    );
  }
}

/// Simula un `getSession` que falla siempre en la primera llamada (MAL-09):
/// la pantalla debe mostrar el error de arranque con Reintentar/Volver en
/// vez de girar para siempre.
class _FailingGetSessionApi extends FakeApi {
  _FailingGetSessionApi({super.artificialDelay});

  var calls = 0;

  @override
  Future<SessionDetailResult> getSession(String sessionId) {
    calls++;
    if (calls == 1) return Future.error(Exception('boom'));
    return super.getSession(sessionId);
  }
}

const _delegates = [
  AppLocalizations.delegate,
  GlobalMaterialLocalizations.delegate,
  GlobalWidgetsLocalizations.delegate,
  GlobalCupertinoLocalizations.delegate,
];

void main() {
  testWidgets('escuchar, editar, enviar, mostrar corrección y reproducir', (
    tester,
  ) async {
    final api = _AlwaysCorrectingApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );
    final speech = FakeSpeechService();
    final tts = FakeTtsService();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          speechServiceProvider.overrideWith((ref) => speech),
          ttsServiceProvider.overrideWith((ref) => tts),
        ],
        child: MaterialApp(
          localizationsDelegates: _delegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: ConversationScreen(sessionId: created.session.id),
        ),
      ),
    );
    await tester.pumpAndSettle();

    // idle -> tap mic -> listening.
    await tester.tap(find.byKey(const Key('conversation_mic_button')));
    await tester.pump();
    expect(speech.isListening, isTrue);

    // El usuario dice algo; el STT simulado entrega el resultado final.
    speech.emit('I go there yesterday', isFinal: true);
    await tester.pump();

    // listening -> reviewing, con la transcripción editable.
    final draftField = tester.widget<TextField>(
      find.byKey(const Key('conversation_draft_field')),
    );
    expect(draftField.controller!.text, 'I go there yesterday');

    // Editar antes de enviar.
    await tester.enterText(
      find.byKey(const Key('conversation_draft_field')),
      'I go there yesterday, it was fun',
    );

    // Enviar -> sending -> speaking -> idle.
    await tester.tap(find.byKey(const Key('conversation_send_button')));
    await tester.pumpAndSettle();

    // Se muestra la corrección de forma no intrusiva (chip expandible).
    expect(
      find.byKey(const Key('conversation_correction_chip')),
      findsOneWidget,
    );
    expect(
      find.byKey(const Key('conversation_correction_detail')),
      findsNothing,
    );
    await tester.tap(find.byKey(const Key('conversation_correction_chip')));
    await tester.pump();
    expect(
      find.byKey(const Key('conversation_correction_detail')),
      findsOneWidget,
    );

    // El tutor "reprodujo" su respuesta.
    expect(tts.spokenTexts, isNotEmpty);
  });

  testWidgets(
    'si el stream se corta antes de done, cae al endpoint completo y descarta el texto parcial',
    (tester) async {
      final api = _StreamDropsBeforeDoneApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      final tts = FakeTtsService();

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fluentApiProvider.overrideWith((ref) => api),
            speechServiceProvider.overrideWith((ref) => FakeSpeechService()),
            ttsServiceProvider.overrideWith((ref) => tts),
          ],
          child: MaterialApp(
            localizationsDelegates: _delegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: ConversationScreen(sessionId: created.session.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('conversation_draft_field')),
        'hello',
      );
      await tester.tap(find.byKey(const Key('conversation_send_button')));
      await tester.pumpAndSettle();

      // El `done` (acá, el resultado del endpoint completo de caída) es la
      // fuente de verdad: se descarta "Partial reply..." y se pinta y
      // reproduce el `reply` del endpoint sin streaming.
      expect(
        find.text('Full reply from the non-streaming endpoint.'),
        findsOneWidget,
      );
      expect(find.textContaining('Partial'), findsNothing);
      expect(tts.spokenTexts, ['Full reply from the non-streaming endpoint.']);
    },
  );

  testWidgets(
    'tres LLM_UNAVAILABLE seguidos muestran un diálogo para terminar',
    (tester) async {
      final api = _UnavailableApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fluentApiProvider.overrideWith((ref) => api),
            speechServiceProvider.overrideWith((ref) => FakeSpeechService()),
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

      // Cada turno degradado se persiste con `200` (no lanza una excepción,
      // ver `turns.service.ts`), así que la conversación vuelve a `idle` entre
      // envío y envío: hay que reabrir el modo texto en cada vuelta en vez de
      // una sola vez al principio.
      for (var i = 0; i < 3; i++) {
        await tester.tap(
          find.byKey(const Key('conversation_text_mode_button')),
        );
        await tester.pump();
        await tester.enterText(
          find.byKey(const Key('conversation_draft_field')),
          'hello $i',
        );
        await tester.tap(find.byKey(const Key('conversation_send_button')));
        await tester.pumpAndSettle();
      }

      expect(api.calls, 3);
      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.conversationUnavailableTitle), findsOneWidget);
    },
  );

  testWidgets('el temporizador llega a 0 y dispara /end', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );

    final router = GoRouter(
      initialLocation: '/session/${created.session.id}',
      routes: [
        GoRoute(
          path: '/session/:id',
          builder: (context, state) => ConversationScreen(
            sessionId: state.pathParameters['id']!,
            sessionDuration: const Duration(seconds: 2),
            warningThreshold: const Duration(seconds: 1),
          ),
        ),
        GoRoute(
          path: '/session/:id/summary',
          builder: (context, state) => const Text('SUMMARY_SCREEN'),
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

    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();

    expect(find.text('SUMMARY_SCREEN'), findsOneWidget);
  });

  testWidgets('si falla el arranque muestra Reintentar y Volver', (
    tester,
  ) async {
    final api = _FailingGetSessionApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );

    final router = GoRouter(
      initialLocation: '/session/${created.session.id}',
      routes: [
        GoRoute(
          path: '/session/:id',
          builder: (context, state) =>
              ConversationScreen(sessionId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/',
          builder: (context, state) => const Text('HOME_SCREEN'),
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

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.commonLoadErrorTitle), findsOneWidget);

    await tester.tap(find.byKey(const Key('conversation_boot_error_retry')));
    await tester.pumpAndSettle();

    expect(find.text(l10n.commonLoadErrorTitle), findsNothing);
    expect(find.byKey(const Key('conversation_mic_button')), findsOneWidget);
  });

  testWidgets('Volver en el error de arranque navega a home', (tester) async {
    final api = _FailingGetSessionApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );

    final router = GoRouter(
      initialLocation: '/session/${created.session.id}',
      routes: [
        GoRoute(
          path: '/session/:id',
          builder: (context, state) =>
              ConversationScreen(sessionId: state.pathParameters['id']!),
        ),
        GoRoute(
          path: '/',
          builder: (context, state) => const Text('HOME_SCREEN'),
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

    await tester.tap(find.byKey(const Key('conversation_boot_error_back')));
    await tester.pumpAndSettle();

    expect(find.text('HOME_SCREEN'), findsOneWidget);
  });

  testWidgets('MEJ-17: un token de streaming no reconstruye el AppBar', (
    tester,
  ) async {
    final api = _ControlledStreamApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          speechServiceProvider.overrideWith((ref) => FakeSpeechService()),
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

    await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
    await tester.pump();
    await tester.enterText(
      find.byKey(const Key('conversation_draft_field')),
      'hello',
    );
    await tester.tap(find.byKey(const Key('conversation_send_button')));
    await tester.pump();

    // El primer token todavía hace un `setState` (crea la burbuja en
    // `_messages`), así que se descarta antes de medir.
    api.emit(const TurnStreamToken('Hi'));
    await tester.pump();
    expect(find.text('Hi'), findsOneWidget);

    final rebuiltLines = <String>[];
    final previousDebugPrint = debugPrint;
    debugPrint = (String? message, {int? wrapWidth}) {
      if (message != null) rebuiltLines.add(message);
    };
    debugPrintRebuildDirtyWidgets = true;
    try {
      api.emit(const TurnStreamToken(' there'));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 1));
    } finally {
      debugPrintRebuildDirtyWidgets = false;
      debugPrint = previousDebugPrint;
    }

    expect(find.text('Hi there'), findsOneWidget);
    final rebuilt = rebuiltLines.join('\n');
    expect(rebuilt.contains('AppBar'), isFalse);
    expect(rebuilt.contains('ListView'), isFalse);

    await api.closeStream();
  });
}

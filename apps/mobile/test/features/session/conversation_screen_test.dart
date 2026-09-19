import 'dart:async';

import 'package:dio/dio.dart' show CancelToken;
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/api/turn_stream_event.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
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

  /// MAL-08: el `CancelToken` que la pantalla pasó a esta llamada, para
  /// comprobar que `dispose()` lo cancela.
  CancelToken? capturedToken;

  @override
  Stream<TurnStreamEvent> sendTurnStream({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) {
    capturedToken = cancelToken;
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
    CancelToken? cancelToken,
  }) async* {
    yield const TurnStreamToken('Partial');
    yield const TurnStreamToken(' reply...');
    throw Exception('conexión perdida');
  }

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
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
    CancelToken? cancelToken,
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
    CancelToken? cancelToken,
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

/// MAL-08: simula un stream que nunca manda ningún evento (proxy colgado):
/// en la app real esto lo convierte `HttpFluentApi` en un
/// `ApiException(streamTimeout)` después de 30 s; acá se lanza directo para
/// no depender de tiempo real. Debe caer al endpoint completo igual que
/// cualquier otro corte de transporte.
class _StreamTimeoutApi extends FakeApi {
  _StreamTimeoutApi({super.artificialDelay});

  @override
  Stream<TurnStreamEvent> sendTurnStream({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) async* {
    throw const ApiException(
      code: ApiErrorCode.streamTimeout,
      message: 'turn stream timed out waiting for the next event',
    );
  }

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) async {
    final base = await super.sendTurn(sessionId: sessionId, text: text);
    return base.copyWith(reply: 'Full reply after stream timeout.');
  }
}

/// MEJ-04: resuelve el turno en un único evento `done`, sin partirlo en
/// palabras — para probar los estados `sending`/`speaking` sin depender de
/// cuántos `pump()` hacen falta para drenar el streaming palabra por
/// palabra de [FakeApi.sendTurnStream].
class _InstantReplyApi extends FakeApi {
  _InstantReplyApi({super.artificialDelay, this.turnDelay = Duration.zero});

  /// Retraso solo del turno. `artificialDelay` afecta también a
  /// `createSession`, que el helper `pumpConversation` espera **antes** de
  /// montar el widget: dentro de la zona de tiempo simulado de `testWidgets`
  /// ese `Future.delayed` nunca vence y el test se cuelga.
  final Duration turnDelay;

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) async {
    if (turnDelay > Duration.zero) {
      await Future<void>.delayed(turnDelay);
    }
    return super.sendTurn(
      sessionId: sessionId,
      text: text,
      cancelToken: cancelToken,
    );
  }

  @override
  Stream<TurnStreamEvent> sendTurnStream({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) async* {
    final result = await sendTurn(
      sessionId: sessionId,
      text: text,
      cancelToken: cancelToken,
    );
    yield TurnStreamDone(result);
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

/// `getSession` tarda: para ver el estado de arranque de la pantalla.
class _SlowGetSessionApi extends FakeApi {
  _SlowGetSessionApi() : super(artificialDelay: Duration.zero);

  @override
  Future<SessionDetailResult> getSession(String sessionId) async {
    await Future<void>.delayed(const Duration(seconds: 1));
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
    'MAL-08: si el stream nunca manda un evento (timeout), cae al endpoint completo',
    (tester) async {
      final api = _StreamTimeoutApi(artificialDelay: Duration.zero);
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
      await tester.pumpAndSettle();

      expect(find.text('Full reply after stream timeout.'), findsOneWidget);
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

  testWidgets('MAL-22: event: reset vacía la burbuja viva', (tester) async {
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

    api.emit(const TurnStreamToken('Partial answer'));
    await tester.pump();
    expect(find.text('Partial answer'), findsOneWidget);

    // La API descarta el intento (va a reintentar con otro modelo): el
    // texto parcial ya pintado no forma parte de la respuesta final.
    // El reset solo toca el `ValueNotifier` (sin `setState`), así que —
    // igual que los tokens sucesivos en el test de MEJ-17 — hace falta más
    // de un `pump()` para que se propague hasta el `ValueListenableBuilder`.
    api.emit(const TurnStreamReset());
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));
    expect(find.text('Partial answer'), findsNothing);

    api.emit(const TurnStreamToken('Fresh answer'));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1));
    expect(find.text('Fresh answer'), findsOneWidget);
    expect(find.textContaining('Partial'), findsNothing);

    // `done` trae un texto distinto del último token: así se comprueba que
    // de verdad se procesa (es la fuente de verdad, reemplaza lo pintado).
    api.emit(
      const TurnStreamDone(
        TurnResult(turnIdx: 1, reply: 'Final answer', corrections: []),
      ),
    );
    // Al recibir `done` la pantalla cancela la suscripción; ese cancel
    // termina fuera del reloj simulado del test, así que hace falta cerrar
    // el fake y dejar correr un instante de async real.
    unawaited(api.closeStream());
    await tester.runAsync(() => Future<void>.delayed(Duration.zero));
    await tester.pumpAndSettle();

    expect(find.text('Final answer'), findsOneWidget);
    expect(find.text('Fresh answer'), findsNothing);
    expect(find.textContaining('Partial'), findsNothing);
  });

  Future<void> pumpConversation(
    WidgetTester tester, {
    required FakeApi api,
    required FakeSpeechService speech,
    FakeTtsService? tts,
  }) async {
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          speechServiceProvider.overrideWith((ref) => speech),
          ttsServiceProvider.overrideWith((ref) => tts ?? FakeTtsService()),
        ],
        child: MaterialApp(
          localizationsDelegates: _delegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: ConversationScreen(sessionId: created.session.id),
        ),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('MAL-08: al salir de la conversación cancela el turno en vuelo', (
    tester,
  ) async {
    final api = _ControlledStreamApi(artificialDelay: Duration.zero);
    final speech = FakeSpeechService();
    await pumpConversation(tester, api: api, speech: speech);

    await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
    await tester.pump();
    await tester.enterText(
      find.byKey(const Key('conversation_draft_field')),
      'hello',
    );
    await tester.tap(find.byKey(const Key('conversation_send_button')));
    await tester.pump();

    expect(api.capturedToken, isNotNull);
    expect(api.capturedToken!.isCancelled, isFalse);

    // Saca la pantalla del árbol sin que el stream haya mandado `done`.
    await tester.pumpWidget(const SizedBox.shrink());

    expect(api.capturedToken!.isCancelled, isTrue);

    await api.closeStream();
  });

  testWidgets(
    'MAL-05: si el motor termina solo sin resultado final, pasa a revisar con el parcial',
    (tester) async {
      final speech = FakeSpeechService();
      await pumpConversation(
        tester,
        api: FakeApi(artificialDelay: Duration.zero),
        speech: speech,
      );

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();
      speech.emit('partial text', isFinal: false);
      await tester.pump();

      speech.emitDoneWithoutResult();
      await tester.pump();

      final draftField = tester.widget<TextField>(
        find.byKey(const Key('conversation_draft_field')),
      );
      expect(draftField.controller!.text, 'partial text');
      expect(find.byKey(const Key('conversation_send_button')), findsOneWidget);
      expect(speech.isListening, isFalse);
    },
  );

  testWidgets(
    'MAL-05: un error del motor sin coincidencia vuelve a idle con un aviso',
    (tester) async {
      final speech = FakeSpeechService();
      await pumpConversation(
        tester,
        api: FakeApi(artificialDelay: Duration.zero),
        speech: speech,
      );

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();
      speech.emitError('error_no_match');
      await tester.pump();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.conversationSttErrorNoMatch), findsOneWidget);
      expect(speech.isListening, isFalse);
      // Vuelve a idle: el botón de mic sigue ahí para reintentar.
      expect(find.byKey(const Key('conversation_mic_button')), findsOneWidget);
    },
  );

  testWidgets(
    'MAL-05: sin permiso de micrófono ofrece abrir Ajustes, distinto del diálogo de locale ausente',
    (tester) async {
      final speech = FakeSpeechService(
        available: false,
        permissionGranted: false,
      );
      await pumpConversation(
        tester,
        api: FakeApi(artificialDelay: Duration.zero),
        speech: speech,
      );

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(
        find.text(l10n.conversationMicPermissionDeniedTitle),
        findsOneWidget,
      );
      expect(
        find.text(l10n.conversationMicPermissionDeniedOpenSettings),
        findsOneWidget,
      );
      expect(find.text(l10n.conversationMicUnavailableTitle), findsNothing);
    },
  );

  testWidgets(
    'MAL-05: sin STT pero con permiso concedido, muestra el diálogo genérico de siempre',
    (tester) async {
      final speech = FakeSpeechService(
        available: false,
        permissionGranted: true,
      );
      await pumpConversation(
        tester,
        api: FakeApi(artificialDelay: Duration.zero),
        speech: speech,
      );

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.conversationMicUnavailableTitle), findsOneWidget);
      expect(
        find.text(l10n.conversationMicPermissionDeniedTitle),
        findsNothing,
      );
    },
  );

  testWidgets(
    'MAL-07: minimizar la app (paused) cancela el STT y para el TTS',
    (tester) async {
      final speech = FakeSpeechService();
      final tts = FakeTtsService();
      await pumpConversation(
        tester,
        api: FakeApi(artificialDelay: Duration.zero),
        speech: speech,
        tts: tts,
      );

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();
      expect(speech.isListening, isTrue);

      tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
      await tester.pump();

      expect(speech.cancelCalled, isTrue);
      expect(tts.stopCalled, isTrue);
    },
  );

  testWidgets('MAL-07: volver (resumed) reanuda el timer', (tester) async {
    final speech = FakeSpeechService();
    await pumpConversation(
      tester,
      api: FakeApi(artificialDelay: Duration.zero),
      speech: speech,
    );

    await tester.pump(const Duration(seconds: 1));
    final beforePause = tester
        .widget<Text>(find.byKey(const Key('conversation_timer')))
        .data;

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pump();
    // Mientras está pausada, el timer no debería seguir corriendo.
    await tester.pump(const Duration(seconds: 3));
    final duringPause = tester
        .widget<Text>(find.byKey(const Key('conversation_timer')))
        .data;
    expect(duringPause, beforePause);

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump(const Duration(seconds: 1));
    final afterResume = tester
        .widget<Text>(find.byKey(const Key('conversation_timer')))
        .data;
    expect(afterResume, isNot(duringPause));
  });

  testWidgets(
    'MAL-07: el back del sistema pide confirmar en vez de abandonar la sesión',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      final router = GoRouter(
        initialLocation: '/session/${created.session.id}',
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const Text('HOME_SCREEN'),
          ),
          GoRoute(
            path: '/session/:id',
            builder: (context, state) =>
                ConversationScreen(sessionId: state.pathParameters['id']!),
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
      final navigator = tester.state<NavigatorState>(
        find.byType(Navigator).first,
      );
      unawaited(navigator.maybePop());
      await tester.pumpAndSettle();

      expect(find.text(l10n.conversationEndConfirmTitle), findsOneWidget);
      expect(find.text('HOME_SCREEN'), findsNothing);
    },
  );

  testWidgets(
    'MEJ-04: la cuenta regresiva arranca en el máximo del turno y solo se ve al final',
    (tester) async {
      final speech = FakeSpeechService();
      await pumpConversation(
        tester,
        api: FakeApi(artificialDelay: Duration.zero),
        speech: speech,
      );

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      bool shown(int seconds) => tester
          .widget<Visibility>(
            find.ancestor(
              of: find.text(l10n.conversationListeningSecondsLeft(seconds)),
              matching: find.byType(Visibility),
            ),
          )
          .visible;

      final window = kListenWindow.inSeconds;
      expect(shown(window), isFalse);

      await tester.pump(Duration(seconds: window - 20));
      expect(shown(20), isTrue);

      speech.emit('hello', isFinal: true);
      await tester.pump();
    },
  );

  testWidgets(
    'MEJ-04: el nivel de sonido del micrófono no reconstruye toda la pantalla',
    (tester) async {
      final speech = FakeSpeechService();
      await pumpConversation(
        tester,
        api: FakeApi(artificialDelay: Duration.zero),
        speech: speech,
      );

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();

      // No debería tirar ni dejar el anillo en un estado roto con niveles
      // fuera del rango típico de `speech_to_text` (-2..10).
      speech.emitSoundLevel(-2);
      await tester.pump();
      speech.emitSoundLevel(8.5);
      await tester.pump();
      speech.emitSoundLevel(15);
      await tester.pump();

      expect(find.byKey(const Key('conversation_mic_button')), findsOneWidget);

      speech.emit('hello', isFinal: true);
      await tester.pump();
    },
  );

  testWidgets(
    'MEJ-04: el botón de mic tiene un Semantics distinto en idle y escuchando',
    (tester) async {
      final speech = FakeSpeechService();
      final semantics = tester.ensureSemantics();
      await pumpConversation(
        tester,
        api: FakeApi(artificialDelay: Duration.zero),
        speech: speech,
      );

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(
        find.bySemanticsLabel(l10n.conversationMicButtonSemantics),
        findsOneWidget,
      );

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();

      expect(
        find.bySemanticsLabel(l10n.conversationMicButtonListeningSemantics),
        findsOneWidget,
      );

      speech.emit('hello', isFinal: true);
      await tester.pump();
      semantics.dispose();
    },
  );

  testWidgets('MEJ-04: al enviar el turno muestra "Pensando…"', (tester) async {
    final api = _InstantReplyApi(
      artificialDelay: Duration.zero,
      turnDelay: const Duration(milliseconds: 50),
    );
    final speech = FakeSpeechService();
    await pumpConversation(tester, api: api, speech: speech);

    await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
    await tester.pump();
    await tester.enterText(
      find.byKey(const Key('conversation_draft_field')),
      'hello',
    );
    await tester.tap(find.byKey(const Key('conversation_send_button')));
    await tester.pump();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.conversationThinkingHint), findsOneWidget);

    await tester.pumpAndSettle();
  });

  testWidgets(
    'MEJ-04: "Hablando…" muestra Parar, que corta el audio y vuelve a idle',
    (tester) async {
      final api = _InstantReplyApi(artificialDelay: Duration.zero);
      final speech = FakeSpeechService();
      final tts = FakeTtsService(speakDelay: const Duration(milliseconds: 300));
      await pumpConversation(tester, api: api, speech: speech, tts: tts);

      await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('conversation_draft_field')),
        'hello',
      );
      await tester.tap(find.byKey(const Key('conversation_send_button')));
      // `_InstantReplyApi` con delay cero solo tiene un `await` de por
      // medio: un par de `pump()` alcanza para llegar a `speaking` sin
      // arriesgarse a que `pumpAndSettle` avance el reloj virtual y
      // termine también el `speakDelay` del TTS.
      await tester.pump();
      await tester.pump();
      await tester.pump();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.conversationSpeakingHint), findsOneWidget);
      expect(
        find.byKey(const Key('conversation_stop_speaking_button')),
        findsOneWidget,
      );

      await tester.tap(
        find.byKey(const Key('conversation_stop_speaking_button')),
      );
      await tester.pump();

      expect(tts.stopCalled, isTrue);
      expect(
        find.byKey(const Key('conversation_stop_speaking_button')),
        findsNothing,
      );

      // Deja completar el `speakDelay` pendiente del fake para no dejar un
      // temporizador colgado entre tests.
      await tester.pump(const Duration(milliseconds: 400));
    },
  );

  testWidgets(
    'en una pantalla angosta, los controles de una respuesta degradada no '
    'desbordan',
    (tester) async {
      tester.view.physicalSize = const Size(360, 640);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
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

      await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('conversation_draft_field')),
        'hello',
      );
      await tester.tap(find.byKey(const Key('conversation_send_button')));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.conversationDegradedChip), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'la burbuja en streaming no muestra reproducir ni velocidades hasta que '
    'el mensaje es final',
    (tester) async {
      final api = _ControlledStreamApi(artificialDelay: Duration.zero);
      await pumpConversation(tester, api: api, speech: FakeSpeechService());
      final replaysBefore = find
          .byIcon(Icons.volume_up_outlined)
          .evaluate()
          .length;

      await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('conversation_draft_field')),
        'hello',
      );
      await tester.tap(find.byKey(const Key('conversation_send_button')));
      await tester.pump();

      api.emit(const TurnStreamToken('Partial answer'));
      await tester.pump();
      await tester.pump();
      expect(find.text('Partial answer'), findsOneWidget);
      expect(
        find.byIcon(Icons.volume_up_outlined).evaluate().length,
        replaysBefore,
      );

      api.emit(
        const TurnStreamDone(
          TurnResult(turnIdx: 1, reply: 'Final answer', corrections: []),
        ),
      );
      // Al recibir `done` la pantalla cancela la suscripción; ese cancel
      // termina fuera del reloj simulado del test, así que hace falta
      // cerrar el fake y dejar correr un instante de async real.
      unawaited(api.closeStream());
      await tester.runAsync(() => Future<void>.delayed(Duration.zero));
      await tester.pumpAndSettle();
      expect(find.text('Final answer'), findsOneWidget);
      expect(
        find.byIcon(Icons.volume_up_outlined).evaluate().length,
        replaysBefore + 1,
      );
    },
  );

  testWidgets(
    'el anillo del micrófono no cambia el tamaño del botón ni el alto del '
    'chat',
    (tester) async {
      final speech = FakeSpeechService();
      await pumpConversation(
        tester,
        api: FakeApi(artificialDelay: Duration.zero),
        speech: speech,
      );
      final box = find.byKey(const Key('conversation_mic_box'));
      final chat = find.byType(ListView);
      final idleBox = tester.getSize(box);

      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();
      // Empezar a escuchar no agranda el botón (el halo es solo pintura).
      expect(tester.getSize(box), idleBox);
      final listeningChat = tester.getSize(chat);
      for (final level in [0.0, 10.0, 4.0]) {
        speech.emitSoundLevel(level);
        await tester.pump();
        expect(tester.getSize(box), idleBox);
        expect(tester.getSize(chat), listeningChat);
      }
    },
  );

  testWidgets(
    'el streaming sigue el final solo si el usuario ya estaba abajo',
    (tester) async {
      tester.view.physicalSize = const Size(390, 700);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final api = _ControlledStreamApi(artificialDelay: Duration.zero);
      await pumpConversation(tester, api: api, speech: FakeSpeechService());

      await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('conversation_draft_field')),
        'hello',
      );
      await tester.tap(find.byKey(const Key('conversation_send_button')));
      await tester.pump();

      ScrollPosition position() => tester
          .state<ScrollableState>(
            find.descendant(
              of: find.byType(ListView),
              matching: find.byType(Scrollable),
            ),
          )
          .position;

      // Un token largo desborda la lista; el usuario estaba abajo, así que
      // la vista lo sigue.
      api.emit(TurnStreamToken(List.filled(80, 'word').join(' ')));
      await tester.pump();
      await tester.pump();
      await tester.pump();
      expect(position().maxScrollExtent, greaterThan(0));
      expect(position().pixels, position().maxScrollExtent);

      // El usuario sube a releer: los tokens siguientes no lo arrastran.
      await tester.drag(find.byType(ListView), const Offset(0, 300));
      await tester.pumpAndSettle();
      final readingAt = position().pixels;
      expect(readingAt, lessThan(position().maxScrollExtent));

      api.emit(TurnStreamToken(' ${List.filled(40, 'more').join(' ')}'));
      await tester.pump();
      await tester.pump();
      await tester.pump();
      expect(position().pixels, readingAt);
      unawaited(api.closeStream());
    },
  );

  testWidgets('mientras arranca la sesión muestra un skeleton, no un spinner', (
    tester,
  ) async {
    final api = _SlowGetSessionApi();
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
    await tester.pump();

    expect(find.byKey(const Key('conversation_skeleton')), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('conversation_skeleton')), findsNothing);
  });

  testWidgets(
    'mientras el tutor piensa, el micrófono se anuncia deshabilitado',
    (tester) async {
      final api = _ControlledStreamApi(artificialDelay: Duration.zero);
      await pumpConversation(tester, api: api, speech: FakeSpeechService());
      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      final mic = find.bySemanticsLabel(l10n.conversationMicButtonSemantics);
      expect(tester.getSemantics(mic), isSemantics(isEnabled: true));

      await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
      await tester.pump();
      await tester.enterText(
        find.byKey(const Key('conversation_draft_field')),
        'hello',
      );
      await tester.tap(find.byKey(const Key('conversation_send_button')));
      await tester.pump();

      expect(tester.getSemantics(mic), isSemantics(isEnabled: false));
      unawaited(api.closeStream());
    },
  );

  Future<void> sendHello(WidgetTester tester) async {
    await tester.tap(find.byKey(const Key('conversation_text_mode_button')));
    await tester.pump();
    await tester.enterText(
      find.byKey(const Key('conversation_draft_field')),
      'hello',
    );
    await tester.tap(find.byKey(const Key('conversation_send_button')));
    await tester.pump();
  }

  testWidgets(
    'el tutor "escribiendo" aparece antes del primer token y lo reemplaza '
    'la respuesta',
    (tester) async {
      final api = _ControlledStreamApi(artificialDelay: Duration.zero);
      await pumpConversation(tester, api: api, speech: FakeSpeechService());
      await sendHello(tester);

      final typing = find.byKey(const Key('conversation_typing_bubble'));
      expect(typing, findsOneWidget);

      api.emit(const TurnStreamToken('First words'));
      await tester.pump();
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(typing, findsNothing);
      expect(find.text('First words'), findsOneWidget);
      unawaited(api.closeStream());
    },
  );

  testWidgets(
    'con "reducir movimiento" el tutor escribiendo y el micrófono quedan '
    'quietos',
    (tester) async {
      final api = _ControlledStreamApi(artificialDelay: Duration.zero);
      final speech = FakeSpeechService();
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
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
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(context).copyWith(disableAnimations: true),
              child: child!,
            ),
            home: ConversationScreen(sessionId: created.session.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Escuchando: el halo no respira ni sigue la voz.
      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pump();
      speech.emitSoundLevel(10);
      await tester.pump();
      expect(tester.hasRunningAnimations, isFalse);
      await tester.tap(find.byKey(const Key('conversation_mic_button')));
      await tester.pumpAndSettle();

      // Al detener la escucha queda en revisión: se envía desde ahí.
      // Pensando: la burbuja se ve, pero sin animación.
      await tester.enterText(
        find.byKey(const Key('conversation_draft_field')),
        'hello',
      );
      await tester.tap(find.byKey(const Key('conversation_send_button')));
      await tester.pump();
      expect(
        find.byKey(const Key('conversation_typing_bubble')),
        findsOneWidget,
      );
      expect(tester.hasRunningAnimations, isFalse);
      unawaited(api.closeStream());
    },
  );

  testWidgets('el halo del micrófono respira en silencio sin cambiar la caja', (
    tester,
  ) async {
    final speech = FakeSpeechService();
    await pumpConversation(
      tester,
      api: FakeApi(artificialDelay: Duration.zero),
      speech: speech,
    );
    final box = find.byKey(const Key('conversation_mic_box'));
    final idle = tester.getSize(box);
    await tester.tap(find.byKey(const Key('conversation_mic_button')));
    await tester.pump();

    double haloScale() => tester
        .widget<Transform>(find.byKey(const Key('conversation_mic_halo')))
        .transform
        .getMaxScaleOnAxis();

    await tester.pump(const Duration(milliseconds: 100));
    final early = haloScale();
    await tester.pump(const Duration(milliseconds: 800));
    expect(haloScale(), isNot(early));
    expect(tester.getSize(box), idle);
  });

  testWidgets('"Más lento" en el compositor baja la velocidad del tutor', (
    tester,
  ) async {
    final tts = FakeTtsService();
    await pumpConversation(
      tester,
      api: FakeApi(artificialDelay: Duration.zero),
      speech: FakeSpeechService(),
      tts: tts,
    );
    final toggle = find.byKey(const Key('conversation_slower_toggle'));
    expect(tester.widget<FilterChip>(toggle).selected, isFalse);

    await tester.tap(toggle);
    await tester.pump();
    expect(tester.widget<FilterChip>(toggle).selected, isTrue);

    await tester.tap(find.byIcon(Icons.volume_up_outlined).first);
    await tester.pumpAndSettle();
    expect(tts.lastRate, 0.8);
  });
}

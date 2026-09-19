import 'dart:async';

import 'package:dio/dio.dart' show CancelToken;
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/api/turn_stream_event.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/errors/l10n_for_api_error.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/speech_service.dart';
import '../data/tts_service.dart';
import '../domain/chat_message.dart';

/// Conversación por voz (SPEC-06 §4.3, §5). Máquina de estados
/// `idle -> listening -> reviewing -> sending -> speaking -> idle`.
///
/// [sessionDuration] y [warningThreshold] son inyectables para poder
/// probar el temporizador sin esperar 10 minutos reales.
class ConversationScreen extends ConsumerStatefulWidget {
  const ConversationScreen({
    super.key,
    required this.sessionId,
    this.sessionDuration = const Duration(minutes: 10),
    this.warningThreshold = const Duration(minutes: 2),
  });

  final String sessionId;
  final Duration sessionDuration;
  final Duration warningThreshold;

  @override
  ConsumerState<ConversationScreen> createState() => _ConversationScreenState();
}

class _ConversationScreenState extends ConsumerState<ConversationScreen>
    with WidgetsBindingObserver {
  /// MEJ-04: igual al `listenFor` de `speech_service.dart` — el motor corta
  /// solo a los 45 s, así que la cuenta regresiva visible debe arrancar del
  /// mismo número para no desincronizarse con lo que realmente pasa.
  static const _listenWindowSeconds = 45;

  ConvState _state = ConvState.idle;
  final List<ChatMessage> _messages = [];
  final _draftController = TextEditingController();
  final _scrollController = ScrollController();

  bool _loading = true;
  bool _bootError = false;
  String? _sessionTopic;
  String _partialText = '';
  double _ttsRate = 1.0;
  int _unavailableCount = 0;
  bool _pendingTimerEnd = false;
  bool _endingSession = false;
  String? _errorMessage;

  Timer? _timer;

  /// MEJ-17: el timer tiqueaba cada segundo con un `setState` de pantalla
  /// completa (AppBar, lista de mensajes y controles de abajo). Con esto
  /// solo repinta el `Text` del AppBar envuelto en `ValueListenableBuilder`.
  late final ValueNotifier<int> _remainingSecondsNotifier = ValueNotifier(
    widget.sessionDuration.inSeconds,
  );
  int get _remainingSeconds => _remainingSecondsNotifier.value;
  bool _warningShown = false;

  /// MEJ-17: la burbuja del tutor mientras llegan tokens del streaming
  /// actualizaba `_messages` con un `setState` por delta. Ahora solo el
  /// texto en vivo (mientras `_liveIndex` apunta a esa burbuja) pasa por
  /// este notifier; `_AssistantBubble` lo escucha con
  /// `ValueListenableBuilder` en vez de que reconstruya toda la pantalla.
  final ValueNotifier<String> _liveText = ValueNotifier('');
  int? _liveIndex;

  bool _micAvailable = true;
  bool _micHasEnUsLocale = true;

  /// MAL-05: si `initialize()` falló, distingue "el usuario denegó el
  /// permiso" (se ofrece abrir Ajustes) de "el dispositivo no tiene
  /// reconocimiento de voz en absoluto" (diálogo genérico, ya existente).
  bool _micPermissionDenied = false;

  /// MEJ-04: nivel de volumen del micrófono mientras escucha, para el
  /// anillo alrededor del botón — en un `ValueNotifier` para no reconstruir
  /// toda la pantalla en cada callback (llega muy seguido).
  final ValueNotifier<double> _soundLevel = ValueNotifier(0);

  /// MEJ-04: cuenta regresiva visible de los 45 s que dura `listenFor`
  /// (`speech_service.dart`), para que quien practica sepa cuánto le queda
  /// antes de que el motor corte solo.
  final ValueNotifier<int> _listenSecondsLeft = ValueNotifier(
    _listenWindowSeconds,
  );
  Timer? _listenCountdownTimer;

  // Se leen una sola vez: son `Provider` simples (sin `watch`), y así
  // `dispose()` puede usarlos sin tocar `ref` después de desmontar.
  late final SpeechService _speech = ref.read(speechServiceProvider);
  late final TtsService _tts = ref.read(ttsServiceProvider);

  /// MAL-08: un solo token por pantalla (no por turno) para poder cancelar
  /// cualquier `sendTurn`/`sendTurnStream` en vuelo al salir de la
  /// conversación, en vez de dejarlo terminar en segundo plano.
  final _turnCancelToken = CancelToken();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _bootstrap();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _turnCancelToken.cancel();
    _timer?.cancel();
    _listenCountdownTimer?.cancel();
    _draftController.dispose();
    _scrollController.dispose();
    _speech.cancel();
    // MAL-07: sin esto, minimizar la app durante `speaking` dejaba al tutor
    // sonando en segundo plano indefinidamente.
    _tts.stop();
    _remainingSecondsNotifier.dispose();
    _liveText.dispose();
    _soundLevel.dispose();
    _listenSecondsLeft.dispose();
    super.dispose();
  }

  /// MAL-07: sin observar el ciclo de vida, minimizar la app (o el pop-up
  /// de una llamada entrante) dejaba el timer corriendo en segundo plano —
  /// al volver, el cronómetro ya había avanzado sin que la sesión hubiera
  /// "pasado" realmente — y el STT/TTS seguían activos sin que nadie los
  /// viera ni escuchara.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.paused:
        _timer?.cancel();
        _listenCountdownTimer?.cancel();
        _speech.cancel();
        _tts.stop();
      case AppLifecycleState.resumed:
        if (!_loading && !_bootError && _remainingSeconds > 0) {
          _startTimer();
        }
      case AppLifecycleState.inactive:
      case AppLifecycleState.detached:
      case AppLifecycleState.hidden:
        break;
    }
  }

  Future<void> _bootstrap() async {
    setState(() {
      _loading = true;
      _bootError = false;
    });
    try {
      final api = ref.read(fluentApiProvider);
      final speech = _speech;
      final tts = _tts;

      await tts.setLanguage('en-US');
      _micAvailable = await speech.initialize();
      if (_micAvailable) {
        _micHasEnUsLocale = await speech.hasLocale('en_US');
      } else {
        _micPermissionDenied = !(await speech.hasPermission);
      }

      final detail = await api.getSession(widget.sessionId);
      if (!mounted) return;
      setState(() {
        _sessionTopic = detail.session.topic;
        _messages.addAll(
          detail.turns.map(
            (t) => ChatMessage(
              role: t.role == 'user' ? 'user' : 'assistant',
              text: t.text,
            ),
          ),
        );
        _loading = false;
      });
      _startTimer();
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _bootError = true;
      });
    }
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _onTick());
  }

  void _onTick() {
    if (!mounted) return;
    _remainingSecondsNotifier.value = (_remainingSeconds - 1).clamp(
      0,
      widget.sessionDuration.inSeconds,
    );

    if (!_warningShown &&
        _remainingSeconds <= widget.warningThreshold.inSeconds) {
      _warningShown = true;
      final l10n = AppLocalizations.of(context);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(l10n.conversationTwoMinutesWarning)),
      );
    }

    if (_remainingSeconds <= 0) {
      _timer?.cancel();
      if (_state == ConvState.idle) {
        _endSession(reason: 'timer');
      } else {
        _pendingTimerEnd = true;
      }
    }
  }

  String _formatTime(int seconds) {
    final m = (seconds ~/ 60).toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  Future<void> _endSession({required String reason}) async {
    if (_endingSession) return;
    _endingSession = true;
    _timer?.cancel();
    SessionSummary? summary;
    try {
      final result = await ref
          .read(fluentApiProvider)
          .endSession(sessionId: widget.sessionId, reason: reason);
      summary = result.summary;
    } catch (_) {
      // Si falla el /end no tenemos resumen: el usuario no debe quedar
      // atrapado en la conversación, así que vuelve a Home.
    }
    if (!mounted) return;
    if (summary != null) {
      context.pushReplacement(
        '/session/${widget.sessionId}/summary',
        extra: summary,
      );
    } else {
      context.go('/');
    }
  }

  Future<void> _confirmEndByUser() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.conversationEndConfirmTitle),
        content: Text(l10n.conversationEndConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.conversationEndConfirmCancel),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.conversationEndConfirmConfirm),
          ),
        ],
      ),
    );
    if (confirmed == true) {
      await _endSession(reason: 'user');
    }
  }

  Future<void> _startListening() async {
    if (!_micAvailable) {
      if (_micPermissionDenied) {
        await _showMicPermissionDeniedDialog();
      } else {
        await _showMicUnavailableDialog();
      }
      return;
    }
    if (!_micHasEnUsLocale) {
      await _showMicUnavailableDialog();
      return;
    }
    // Ducking: cortar cualquier audio del tutor antes de escuchar.
    await _tts.stop();
    setState(() {
      _state = ConvState.listening;
      _partialText = '';
    });
    _soundLevel.value = 0;
    _startListenCountdown();
    await _speech.listen(
      onResult: (text, isFinal) {
        if (!mounted) return;
        setState(() {
          _partialText = text;
          if (isFinal) {
            _draftController.text = text;
            _state = ConvState.reviewing;
          }
        });
        if (isFinal) _listenCountdownTimer?.cancel();
      },
      // MAL-05: el motor puede terminar solo sin `isFinal` (45 s, una
      // llamada entrante) — se pasa a revisar con lo que ya se transcribió
      // en vez de dejar el mic "escuchando" para siempre.
      onDoneWithoutResult: () {
        _listenCountdownTimer?.cancel();
        if (!mounted) return;
        setState(() {
          _draftController.text = _partialText;
          _state = ConvState.reviewing;
        });
      },
      // MAL-05: un error del motor (sin coincidencia, timeout) vuelve a
      // `idle` con un aviso, en vez de quedarse "escuchando".
      onError: (errorCode) {
        _listenCountdownTimer?.cancel();
        if (!mounted) return;
        final l10n = AppLocalizations.of(context);
        setState(() {
          _state = ConvState.idle;
          _partialText = '';
        });
        final message = switch (errorCode) {
          'error_no_match' => l10n.conversationSttErrorNoMatch,
          'error_speech_timeout' => l10n.conversationSttErrorTimeout,
          _ => l10n.conversationSttErrorGeneric,
        };
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(message)));
      },
      // MEJ-04: nivel de volumen del micrófono, para el anillo alrededor
      // del botón mientras escucha.
      onSoundLevelChange: (level) {
        if (!mounted) return;
        _soundLevel.value = level;
      },
    );
  }

  /// MEJ-04: cuenta regresiva visible de los 45 s de `listenFor`. Vive
  /// aparte de `_listen` porque es puramente de UI — el motor nativo corta
  /// solo sin depender de esto.
  void _startListenCountdown() {
    _listenCountdownTimer?.cancel();
    _listenSecondsLeft.value = _listenWindowSeconds;
    _listenCountdownTimer = Timer.periodic(const Duration(seconds: 1), (
      timer,
    ) {
      final next = _listenSecondsLeft.value - 1;
      if (next <= 0) {
        timer.cancel();
        _listenSecondsLeft.value = 0;
        return;
      }
      _listenSecondsLeft.value = next;
    });
  }

  Future<void> _stopListening() async {
    _listenCountdownTimer?.cancel();
    await _speech.stop();
  }

  /// MEJ-04: botón **Parar** visible mientras el tutor habla, para no
  /// esperar a que termine todo el audio para poder actuar de nuevo.
  Future<void> _stopSpeaking() async {
    await _tts.stop();
    if (!mounted) return;
    setState(() => _state = ConvState.idle);
  }

  Future<void> _showMicPermissionDeniedDialog() async {
    final l10n = AppLocalizations.of(context);
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.conversationMicPermissionDeniedTitle),
        content: Text(l10n.conversationMicPermissionDeniedBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.conversationMicPermissionDeniedCancel),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              openAppSettings();
            },
            child: Text(l10n.conversationMicPermissionDeniedOpenSettings),
          ),
        ],
      ),
    );
  }

  Future<void> _showMicUnavailableDialog() async {
    final l10n = AppLocalizations.of(context);
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.conversationMicUnavailableTitle),
        content: Text(l10n.conversationMicUnavailableBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.conversationMicUnavailableAccept),
          ),
        ],
      ),
    );
    if (mounted) {
      setState(() {
        _state = ConvState.reviewing;
        _draftController.clear();
      });
    }
  }

  void _enterTextMode() {
    _speech.cancel();
    setState(() {
      _draftController.clear();
      _state = ConvState.reviewing;
    });
  }

  void _retry() {
    setState(() {
      _draftController.clear();
      _partialText = '';
      _errorMessage = null;
      _state = ConvState.idle;
    });
  }

  /// `POST /sessions/:id/turns` **nunca** devuelve `503 LLM_UNAVAILABLE`
  /// (SPEC-04 §4 paso 4 y `apps/api/src/sessions/turns.service.ts`): si se
  /// agota la cadena de modelos, la API responde igual `200` con
  /// `TurnResult.unavailable: true` y un texto de disculpa fijo
  /// (`DEGRADED_REPLY`), para que la conversación siga. Por eso el aviso de
  /// "3 intentos seguidos" mira `result.unavailable`, no una excepción; el
  /// catch de abajo queda solo para errores reales (403/409/429/400 o de
  /// red). Ver PEND de `docs/specs/pendientes/PR-06.md`.
  ///
  /// El turno se pide por streaming (`_sendTurnWithStreamFallback`): la
  /// burbuja del tutor va creciendo token a token, pero el mensaje del
  /// usuario y las correcciones no se pintan hasta tener el `TurnResult`
  /// completo (por streaming o por la caída al endpoint sin streaming), para
  /// poder deshacer ambos de una si el turno termina en error — igual que
  /// antes de que existiera el streaming.
  Future<void> _send() async {
    final l10n = AppLocalizations.of(context);
    final text = _draftController.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _state = ConvState.sending;
      _errorMessage = null;
      _messages.add(ChatMessage(role: 'user', text: text));
    });
    final userIndex = _messages.length - 1;
    _scrollToBottom(force: true);

    int? assistantIndex;
    final liveReply = StringBuffer();
    // MEJ-17: solo el primer token reconstruye la pantalla (agrega la
    // burbuja a `_messages`); los siguientes deltas solo tocan `_liveText`,
    // que únicamente escucha la burbuja en vivo (`ValueListenableBuilder`
    // en `_AssistantBubble`).
    void onToken(String delta) {
      liveReply.write(delta);
      if (!mounted) return;
      if (assistantIndex == null) {
        setState(() {
          assistantIndex = _messages.length;
          _liveIndex = assistantIndex;
          _messages.add(
            ChatMessage(role: 'assistant', text: liveReply.toString()),
          );
        });
      }
      _liveText.value = liveReply.toString();
      _scrollToBottom(animate: false);
    }

    // MAL-22: `event: reset` llega cuando la API descarta el intento actual
    // para reintentar con otro modelo de la cadena de fallback — el texto
    // parcial pintado hasta ahora no forma parte de la respuesta final.
    void onReset() {
      liveReply.clear();
      if (!mounted) return;
      _liveText.value = '';
    }

    try {
      final result = await _sendTurnWithStreamFallback(
        text: text,
        onToken: onToken,
        onReset: onReset,
      );
      _unavailableCount = result.unavailable ? _unavailableCount + 1 : 0;
      if (!mounted) return;
      setState(() {
        _messages[userIndex] = _messages[userIndex].copyWith(
          corrections: result.corrections,
        );
        final aIdx = assistantIndex;
        if (aIdx == null) {
          _messages.add(
            ChatMessage(
              role: 'assistant',
              text: result.reply,
              degraded: result.degraded,
            ),
          );
        } else {
          // `done` es la fuente de verdad (SPEC-04 §4, PEND-56 de PR-04.md):
          // reemplaza cualquier texto parcial pintado por los `token`.
          _messages[aIdx] = _messages[aIdx].copyWith(
            text: result.reply,
            degraded: result.degraded,
          );
        }
        _liveIndex = null;
        _draftController.clear();
        _state = ConvState.speaking;
      });
      _scrollToBottom();
      await _tts.setSpeechRate(_ttsRate);
      await _tts.speak(result.reply);
      if (!mounted) return;
      if (result.unavailable && _unavailableCount >= 3) {
        setState(() => _state = ConvState.idle);
        await _showUnavailableDialog();
        return;
      }
      setState(() => _state = ConvState.idle);
      if (_pendingTimerEnd) {
        await _endSession(reason: 'timer');
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        final aIdx = assistantIndex;
        if (aIdx != null) _messages.removeAt(aIdx);
        _messages.removeAt(userIndex);
        _liveIndex = null;
        _state = ConvState.reviewing;
        _errorMessage = l10nForApiError(e.code, l10n);
      });
    }
  }

  /// Consume `POST /sessions/:id/turns/stream` (SPEC-04 §4) llamando
  /// [onToken] por cada delta de texto y devolviendo el `TurnResult` del
  /// evento `done` (la fuente de verdad, PEND-56 de
  /// `docs/specs/pendientes/PR-04.md`).
  ///
  /// Si el stream falla, cae al endpoint sin streaming
  /// (`POST /sessions/:id/turns`, SPEC-04 §4 «si el parser falla, cae al
  /// modo no streaming»): un error que llega **antes** de cualquier evento
  /// se relanza tal cual en vez de reintentar (es el mismo `403/409/429/400`
  /// que daría el endpoint sin streaming, así que reintentar solo gastaría
  /// una llamada de más); cualquier otro corte —de red, un `error` SSE
  /// después de haber empezado a recibir tokens, o un `streamTimeout`
  /// (MAL-08: proxy/conexión colgada, nunca la rechazó el servidor)— cae al
  /// endpoint completo. Ver PEND de `docs/specs/pendientes/PR-06.md` sobre
  /// el turno duplicado que puede producir esa caída si el stream ya había
  /// terminado del lado del servidor cuando se corta la conexión.
  Future<TurnResult> _sendTurnWithStreamFallback({
    required String text,
    required void Function(String delta) onToken,
    required void Function() onReset,
  }) async {
    final api = ref.read(fluentApiProvider);
    var sawEvent = false;
    try {
      final stream = api.sendTurnStream(
        sessionId: widget.sessionId,
        text: text,
        cancelToken: _turnCancelToken,
      );
      await for (final event in stream) {
        switch (event) {
          case TurnStreamToken(text: final delta):
            sawEvent = true;
            onToken(delta);
          case TurnStreamCorrections():
            // `done` trae la misma lista: no hace falta pintarla dos veces.
            sawEvent = true;
          case TurnStreamDone(result: final result):
            return result;
          case TurnStreamError(exception: final exception):
            throw exception;
          case TurnStreamReset():
            // MAL-22: la API está por reintentar con otro modelo de la
            // cadena de fallback — el texto acumulado hasta ahora no sirve.
            sawEvent = true;
            onReset();
        }
      }
    } on ApiException catch (e) {
      if (!sawEvent && e.code != ApiErrorCode.streamTimeout) rethrow;
    } catch (_) {
      // Fallo de transporte antes de cualquier evento: se intenta igual el
      // modo completo abajo.
    }
    return api.sendTurn(
      sessionId: widget.sessionId,
      text: text,
      cancelToken: _turnCancelToken,
    );
  }

  Future<void> _showUnavailableDialog() async {
    final l10n = AppLocalizations.of(context);
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.conversationUnavailableTitle),
        content: Text(l10n.conversationUnavailableBody),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _unavailableCount = 0;
              setState(() => _state = ConvState.reviewing);
            },
            child: Text(l10n.conversationUnavailableStay),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              _endSession(reason: 'user');
            },
            child: Text(l10n.conversationUnavailableEnd),
          ),
        ],
      ),
    );
  }

  Future<void> _replay(String text) async {
    await _tts.setSpeechRate(_ttsRate);
    await _tts.speak(text);
  }

  void _setRate(double rate) {
    setState(() => _ttsRate = rate);
  }

  /// Distancia al final dentro de la cual se considera que el usuario está
  /// "abajo" siguiendo la conversación.
  static const _followThreshold = 48.0;
  bool _scrollScheduled = false;

  /// Baja al último mensaje solo si el usuario ya estaba abajo (o si
  /// [force], cuando acaba de mandar su turno): no lo arrastra mientras
  /// relee algo más arriba. Los tokens del streaming usan `jumpTo`
  /// ([animate] en false) y se agrupan en un salto por frame, en vez de
  /// encadenar un `animateTo` por token.
  void _scrollToBottom({bool force = false, bool animate = true}) {
    if (!_scrollController.hasClients || _scrollScheduled) return;
    final position = _scrollController.position;
    final nearBottom =
        position.maxScrollExtent - position.pixels <= _followThreshold;
    if (!force && !nearBottom) return;
    _scrollScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollScheduled = false;
      if (!_scrollController.hasClients) return;
      final target = _scrollController.position.maxScrollExtent;
      if (animate && !MediaQuery.disableAnimationsOf(context)) {
        _scrollController.animateTo(
          target,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      } else {
        _scrollController.jumpTo(target);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (_loading) {
      return const _ConversationSkeleton();
    }

    if (_bootError) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  l10n.commonLoadErrorTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l10n.commonLoadErrorBody,
                  style: Theme.of(context).textTheme.bodySmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.lg),
                ElevatedButton(
                  key: const Key('conversation_boot_error_retry'),
                  onPressed: _bootstrap,
                  child: Text(l10n.commonRetry),
                ),
                const SizedBox(height: AppSpacing.sm),
                TextButton(
                  key: const Key('conversation_boot_error_back'),
                  onPressed: () => context.go('/'),
                  child: Text(l10n.conversationBootErrorBack),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return PopScope<Object?>(
      // MAL-07: el back de Android abandonaba la sesión activa sin avisar;
      // ahora reutiliza el mismo diálogo de confirmación que el botón de
      // cerrar del AppBar.
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        _confirmEndByUser();
      },
      child: Scaffold(
        appBar: AppBar(
          title: Text(_sessionTopic ?? ''),
          actions: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
              child: Center(
                child: ValueListenableBuilder<int>(
                  valueListenable: _remainingSecondsNotifier,
                  builder: (context, seconds, _) => Text(
                    _formatTime(seconds),
                    key: const Key('conversation_timer'),
                  ),
                ),
              ),
            ),
            IconButton(
              key: const Key('conversation_end_button'),
              icon: const Icon(Icons.close),
              onPressed: _confirmEndByUser,
              tooltip: l10n.conversationEndButton,
            ),
          ],
        ),
        body: Column(
          children: [
            Expanded(
              child: ListView.builder(
                key: const Key('conversation_message_list'),
                controller: _scrollController,
                padding: const EdgeInsets.all(AppSpacing.screenPad),
                itemCount: _messages.length,
                itemBuilder: (context, index) {
                  final message = _messages[index];
                  return message.isAssistant
                      ? _AssistantBubble(
                          message: message,
                          rate: _ttsRate,
                          onSetRate: _setRate,
                          onReplay: () => _replay(message.text),
                          liveText: index == _liveIndex ? _liveText : null,
                        )
                      : _UserBubble(message: message);
                },
              ),
            ),
            _BottomControls(
              state: _state,
              partialText: _partialText,
              draftController: _draftController,
              errorMessage: _errorMessage,
              soundLevel: _soundLevel,
              listenSecondsLeft: _listenSecondsLeft,
              onMicTap: _state == ConvState.listening
                  ? _stopListening
                  : _startListening,
              onSend: _send,
              onRetry: _retry,
              onTextMode: _enterTextMode,
              onStopSpeaking: _stopSpeaking,
            ),
          ],
        ),
      ),
    );
  }
}

class _AssistantBubble extends StatelessWidget {
  const _AssistantBubble({
    required this.message,
    required this.rate,
    required this.onSetRate,
    required this.onReplay,
    this.liveText,
  });

  final ChatMessage message;
  final double rate;
  final ValueChanged<double> onSetRate;
  final VoidCallback onReplay;

  /// MEJ-17: mientras esta burbuja es la que está recibiendo tokens del
  /// streaming, el texto viene de acá (actualizado sin reconstruir el
  /// resto de la pantalla) en vez de `message.text`.
  final ValueListenable<String>? liveText;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final live = liveText;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadius.md),
              border: Border.all(color: AppColors.border),
            ),
            child: live == null
                ? Text(message.text)
                : ValueListenableBuilder<String>(
                    valueListenable: live,
                    builder: (context, value, _) => Text(value),
                  ),
          ),
          // Wrap: con el chip de respuesta degradada no entra en una línea
          // en pantallas angostas. Mientras llega el streaming no se
          // muestran: `message.text` todavía es el primer token.
          if (live == null)
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                IconButton(
                  key: Key('conversation_replay_${message.text.hashCode}'),
                  icon: const Icon(Icons.volume_up_outlined, size: 18),
                  tooltip: l10n.conversationReplayAudio,
                  onPressed: onReplay,
                ),
                for (final r in const [0.8, 1.0, 1.2])
                  TextButton(
                    onPressed: () => onSetRate(r),
                    style: TextButton.styleFrom(
                      // AA en ambos estados (MEJ-01).
                      foregroundColor: rate == r
                          ? AppColors.primaryDark
                          : AppColors.textSecondary,
                    ),
                    child: Text(l10n.conversationSpeedButtonLabel(r.toString())),
                  ),
                if (message.degraded)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.locked,
                      borderRadius: BorderRadius.circular(AppRadius.pill),
                    ),
                    child: Text(
                      l10n.conversationDegradedChip,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: AppColors.textSecondary,
                      ),
                    ),
                  ),
              ],
            ),
        ],
      ),
    );
  }
}

class _UserBubble extends StatefulWidget {
  const _UserBubble({required this.message});

  final ChatMessage message;

  @override
  State<_UserBubble> createState() => _UserBubbleState();
}

class _UserBubbleState extends State<_UserBubble> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final hasCorrections = widget.message.corrections.isNotEmpty;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Align(
        alignment: Alignment.centerRight,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Text(widget.message.text),
            ),
            if (hasCorrections)
              InkWell(
                key: const Key('conversation_correction_chip'),
                onTap: () => setState(() => _expanded = !_expanded),
                child: Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xs),
                  child: Text(
                    l10n.conversationCorrectionChip(
                      widget.message.corrections.length,
                    ),
                    // `accent` como texto da 2.5:1 (MEJ-01).
                    style: const TextStyle(
                      color: AppColors.accentText,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            if (hasCorrections && _expanded)
              Container(
                key: const Key('conversation_correction_detail'),
                margin: const EdgeInsets.only(top: AppSpacing.xs),
                padding: const EdgeInsets.all(AppSpacing.md),
                constraints: const BoxConstraints(maxWidth: 280),
                decoration: BoxDecoration(
                  color: AppColors.accentSoft,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final c in widget.message.corrections) ...[
                      Text(
                        '${l10n.conversationCorrectionOriginalLabel}: ${c.original}',
                        style: const TextStyle(
                          decoration: TextDecoration.lineThrough,
                          color: AppColors.textSecondary,
                        ),
                      ),
                      Text(
                        '${l10n.conversationCorrectionCorrectedLabel}: ${c.corrected}',
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      Text(
                        c.note,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _BottomControls extends StatelessWidget {
  const _BottomControls({
    required this.state,
    required this.partialText,
    required this.draftController,
    required this.errorMessage,
    required this.soundLevel,
    required this.listenSecondsLeft,
    required this.onMicTap,
    required this.onSend,
    required this.onRetry,
    required this.onTextMode,
    required this.onStopSpeaking,
  });

  final ConvState state;
  final String partialText;
  final TextEditingController draftController;
  final String? errorMessage;
  final ValueListenable<double> soundLevel;
  final ValueListenable<int> listenSecondsLeft;
  final VoidCallback onMicTap;
  final VoidCallback onSend;
  final VoidCallback onRetry;
  final VoidCallback onTextMode;
  final VoidCallback onStopSpeaking;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.screenPad),
        child: switch (state) {
          ConvState.reviewing => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.conversationEditableHint,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.xs),
              TextField(
                key: const Key('conversation_draft_field'),
                controller: draftController,
                minLines: 1,
                maxLines: 4,
                decoration: InputDecoration(
                  hintText: l10n.conversationTextFieldHint,
                ),
              ),
              if (errorMessage != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    errorMessage!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: AppColors.errorText,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      key: const Key('conversation_retry_button'),
                      onPressed: onRetry,
                      child: Text(l10n.conversationRetryButton),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: ElevatedButton(
                      key: const Key('conversation_send_button'),
                      onPressed: onSend,
                      child: Text(l10n.conversationSendButton),
                    ),
                  ),
                ],
              ),
            ],
          ),
          ConvState.listening => Column(
            children: [
              ValueListenableBuilder<int>(
                valueListenable: listenSecondsLeft,
                builder: (context, seconds, _) => Text(
                  l10n.conversationListeningSecondsLeft(seconds),
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ),
              Text(partialText, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.sm),
              Text(
                l10n.conversationListeningHint,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.md),
              _MicButton(active: true, onTap: onMicTap, soundLevel: soundLevel),
            ],
          ),
          ConvState.sending => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _MicButton(active: false, onTap: null),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l10n.conversationThinkingHint,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          ConvState.speaking => Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const _MicButton(active: false, onTap: null),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l10n.conversationSpeakingHint,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: AppSpacing.sm),
                OutlinedButton(
                  key: const Key('conversation_stop_speaking_button'),
                  onPressed: onStopSpeaking,
                  child: Text(l10n.conversationStopButton),
                ),
              ],
            ),
          ),
          ConvState.idle => Column(
            children: [
              Text(
                l10n.conversationTapToSpeak,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.md),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _MicButton(active: false, onTap: onMicTap),
                  const SizedBox(width: AppSpacing.lg),
                  IconButton(
                    key: const Key('conversation_text_mode_button'),
                    icon: const Icon(Icons.keyboard_alt_outlined),
                    tooltip: l10n.conversationTextModeButton,
                    onPressed: onTextMode,
                  ),
                ],
              ),
            ],
          ),
        },
      ),
    );
  }
}

class _MicButton extends StatelessWidget {
  const _MicButton({required this.active, required this.onTap, this.soundLevel});

  final bool active;
  final VoidCallback? onTap;

  /// MEJ-04: nivel de volumen del micrófono mientras escucha, para dibujar
  /// un anillo que reacciona a la voz. `null` fuera de `listening` (nada
  /// que animar).
  final ValueListenable<double>? soundLevel;

  static const _buttonSize = 72.0;
  static const _haloGrowth = 0.3;
  static const _haloBox = _buttonSize * (1 + _haloGrowth);

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final enabled = onTap != null;
    // Escuchando: `accentText` (blanco encima 5:1; `accent` da 2.7:1).
    // Deshabilitado (enviando/hablando): gris, distinto del reposo.
    final button = Material(
      shape: const CircleBorder(),
      color: !enabled
          ? AppColors.locked
          : active
          ? AppColors.accentText
          : AppColors.primaryDark,
      child: InkWell(
        key: const Key('conversation_mic_button'),
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox.square(
          dimension: _buttonSize,
          child: Icon(
            Icons.mic,
            color: enabled ? Colors.white : AppColors.textMuted,
            size: 32,
          ),
        ),
      ),
    );

    // Caja fija: el halo se dibuja con `Transform.scale` (solo pintura),
    // así el panel inferior no cambia de alto con la voz ni al empezar a
    // escuchar.
    final level = soundLevel;
    final visual = SizedBox.square(
      key: const Key('conversation_mic_box'),
      dimension: _haloBox,
      child: Stack(
        alignment: Alignment.center,
        children: [
          if (level != null)
            ValueListenableBuilder<double>(
              valueListenable: level,
              builder: (context, value, _) {
                // `speech_to_text` no normaliza `onSoundLevelChange` (suele
                // moverse entre -2 y 10 aprox.): se recorta a 0-10. Con
                // animaciones desactivadas el halo queda fijo.
                final normalized = MediaQuery.disableAnimationsOf(context)
                    ? 0.5
                    : (value / 10).clamp(0.0, 1.0);
                return Transform.scale(
                  scale: 1 + normalized * _haloGrowth,
                  child: Container(
                    width: _buttonSize,
                    height: _buttonSize,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.accent.withValues(
                        alpha: 0.15 + normalized * 0.25,
                      ),
                    ),
                  ),
                );
              },
            ),
          button,
        ],
      ),
    );

    return Semantics(
      button: true,
      enabled: enabled,
      label: active
          ? l10n.conversationMicButtonListeningSemantics
          : l10n.conversationMicButtonSemantics,
      child: visual,
    );
  }
}

/// Forma de la conversación mientras arranca la sesión: encabezado, un par
/// de burbujas y el micrófono.
class _ConversationSkeleton extends StatelessWidget {
  const _ConversationSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      key: Key('conversation_skeleton'),
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(AppSpacing.screenPad),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SkeletonBox(width: 160, height: 24),
              SizedBox(height: AppSpacing.xl),
              SkeletonBox(width: 260, height: 72, borderRadius: 18),
              SizedBox(height: AppSpacing.md),
              Align(
                alignment: Alignment.centerRight,
                child: SkeletonBox(width: 200, height: 48, borderRadius: 18),
              ),
              Spacer(),
              Center(
                child: SkeletonBox(
                  width: 72,
                  height: 72,
                  borderRadius: AppRadius.pill,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

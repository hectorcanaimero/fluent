import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/api/turn_stream_event.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/providers.dart';
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

class _ConversationScreenState extends ConsumerState<ConversationScreen> {
  ConvState _state = ConvState.idle;
  final List<ChatMessage> _messages = [];
  final _draftController = TextEditingController();
  final _scrollController = ScrollController();

  bool _loading = true;
  String? _sessionTopic;
  String _partialText = '';
  double _ttsRate = 1.0;
  int _unavailableCount = 0;
  bool _pendingTimerEnd = false;
  bool _endingSession = false;
  String? _errorMessage;

  Timer? _timer;
  late int _remainingSeconds;
  bool _warningShown = false;

  bool _micAvailable = true;
  bool _micHasEnUsLocale = true;

  // Se leen una sola vez: son `Provider` simples (sin `watch`), y así
  // `dispose()` puede usarlos sin tocar `ref` después de desmontar.
  late final SpeechService _speech = ref.read(speechServiceProvider);
  late final TtsService _tts = ref.read(ttsServiceProvider);

  @override
  void initState() {
    super.initState();
    _remainingSeconds = widget.sessionDuration.inSeconds;
    _bootstrap();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _draftController.dispose();
    _scrollController.dispose();
    _speech.cancel();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final api = ref.read(fluentApiProvider);
    final speech = _speech;
    final tts = _tts;

    await tts.setLanguage('en-US');
    _micAvailable = await speech.initialize();
    if (_micAvailable) {
      _micHasEnUsLocale = await speech.hasLocale('en_US');
    }

    final detail = await api.getSession(widget.sessionId);
    if (!mounted) return;
    setState(() {
      _sessionTopic = detail.session.topic;
      _messages.addAll(
        detail.turns.map(
          (t) => ChatMessage(role: t.role == 'user' ? 'user' : 'assistant', text: t.text),
        ),
      );
      _loading = false;
    });
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _onTick());
  }

  void _onTick() {
    if (!mounted) return;
    setState(() => _remainingSeconds = (_remainingSeconds - 1).clamp(0, widget.sessionDuration.inSeconds));

    if (!_warningShown && _remainingSeconds <= widget.warningThreshold.inSeconds) {
      _warningShown = true;
      final l10n = AppLocalizations.of(context);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.conversationTwoMinutesWarning)));
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

  String get _formattedTime {
    final m = (_remainingSeconds ~/ 60).toString().padLeft(2, '0');
    final s = (_remainingSeconds % 60).toString().padLeft(2, '0');
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
      context.pushReplacement('/session/${widget.sessionId}/summary', extra: summary);
    } else {
      context.go('/');
    }
  }

  Future<void> _confirmEndByUser() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (ctx) => AlertDialog(
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
    if (!_micAvailable || !_micHasEnUsLocale) {
      await _showMicUnavailableDialog();
      return;
    }
    // Ducking: cortar cualquier audio del tutor antes de escuchar.
    await _tts.stop();
    setState(() {
      _state = ConvState.listening;
      _partialText = '';
    });
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
      },
    );
  }

  Future<void> _stopListening() async {
    await _speech.stop();
  }

  Future<void> _showMicUnavailableDialog() async {
    final l10n = AppLocalizations.of(context);
    await showDialog<void>(
      context: context,
      builder:
          (ctx) => AlertDialog(
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
    _scrollToBottom();

    int? assistantIndex;
    final liveReply = StringBuffer();
    void onToken(String delta) {
      liveReply.write(delta);
      if (!mounted) return;
      setState(() {
        final aIdx = assistantIndex;
        if (aIdx == null) {
          assistantIndex = _messages.length;
          _messages.add(ChatMessage(role: 'assistant', text: liveReply.toString()));
        } else {
          _messages[aIdx] = _messages[aIdx].copyWith(text: liveReply.toString());
        }
      });
      _scrollToBottom();
    }

    try {
      final result = await _sendTurnWithStreamFallback(text: text, onToken: onToken);
      _unavailableCount = result.unavailable ? _unavailableCount + 1 : 0;
      if (!mounted) return;
      setState(() {
        _messages[userIndex] = _messages[userIndex].copyWith(corrections: result.corrections);
        final aIdx = assistantIndex;
        if (aIdx == null) {
          _messages.add(
            ChatMessage(role: 'assistant', text: result.reply, degraded: result.degraded),
          );
        } else {
          // `done` es la fuente de verdad (SPEC-04 §4, PEND-56 de PR-04.md):
          // reemplaza cualquier texto parcial pintado por los `token`.
          _messages[aIdx] = _messages[aIdx].copyWith(
            text: result.reply,
            degraded: result.degraded,
          );
        }
        _draftController.clear();
        _state = ConvState.speaking;
      });
      _scrollToBottom();
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
    } on ApiException catch (_) {
      if (!mounted) return;
      setState(() {
        final aIdx = assistantIndex;
        if (aIdx != null) _messages.removeAt(aIdx);
        _messages.removeAt(userIndex);
        _state = ConvState.reviewing;
        _errorMessage = l10n.conversationSendErrorGeneric;
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
  /// una llamada de más); cualquier otro corte —de red, o un `error` SSE
  /// después de haber empezado a recibir tokens— cae al endpoint completo.
  /// Ver PEND de `docs/specs/pendientes/PR-06.md` sobre el turno duplicado
  /// que puede producir esa caída si el stream ya había terminado del lado
  /// del servidor cuando se corta la conexión.
  Future<TurnResult> _sendTurnWithStreamFallback({
    required String text,
    required void Function(String delta) onToken,
  }) async {
    final api = ref.read(fluentApiProvider);
    var sawEvent = false;
    try {
      final stream = api.sendTurnStream(sessionId: widget.sessionId, text: text);
      await for (final event in stream) {
        sawEvent = true;
        switch (event) {
          case TurnStreamToken(text: final delta):
            onToken(delta);
          case TurnStreamCorrections():
            // `done` trae la misma lista: no hace falta pintarla dos veces.
            break;
          case TurnStreamDone(result: final result):
            return result;
          case TurnStreamError(exception: final exception):
            throw exception;
        }
      }
    } on ApiException {
      if (!sawEvent) rethrow;
    } catch (_) {
      // Fallo de transporte antes de cualquier evento: se intenta igual el
      // modo completo abajo.
    }
    return api.sendTurn(sessionId: widget.sessionId, text: text);
  }

  Future<void> _showUnavailableDialog() async {
    final l10n = AppLocalizations.of(context);
    if (!mounted) return;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder:
          (ctx) => AlertDialog(
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

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_scrollController.hasClients) return;
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    if (_loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Scaffold(
      appBar: AppBar(
        title: Text(_sessionTopic ?? ''),
        actions: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: Center(
              child: Text(_formattedTime, key: const Key('conversation_timer')),
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
            onMicTap: _state == ConvState.listening ? _stopListening : _startListening,
            onSend: _send,
            onRetry: _retry,
            onTextMode: _enterTextMode,
          ),
        ],
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
  });

  final ChatMessage message;
  final double rate;
  final ValueChanged<double> onSetRate;
  final VoidCallback onReplay;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
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
            child: Text(message.text),
          ),
          Row(
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
                    foregroundColor: rate == r ? AppColors.primary : AppColors.textMuted,
                  ),
                  child: Text(l10n.conversationSpeedButtonLabel(r.toString())),
                ),
              if (message.degraded)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.locked,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    l10n.conversationDegradedChip,
                    style: Theme.of(context).textTheme.labelSmall,
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
                    l10n.conversationCorrectionChip(widget.message.corrections.length),
                    style: const TextStyle(color: AppColors.accent, fontWeight: FontWeight.w600),
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
                      Text(c.note, style: Theme.of(context).textTheme.bodySmall),
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
    required this.onMicTap,
    required this.onSend,
    required this.onRetry,
    required this.onTextMode,
  });

  final ConvState state;
  final String partialText;
  final TextEditingController draftController;
  final String? errorMessage;
  final VoidCallback onMicTap;
  final VoidCallback onSend;
  final VoidCallback onRetry;
  final VoidCallback onTextMode;

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
              Text(l10n.conversationEditableHint, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: AppSpacing.xs),
              TextField(
                key: const Key('conversation_draft_field'),
                controller: draftController,
                minLines: 1,
                maxLines: 4,
                decoration: InputDecoration(hintText: l10n.conversationTextFieldHint),
              ),
              if (errorMessage != null) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(errorMessage!, style: const TextStyle(color: AppColors.error)),
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
              Text(partialText, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.sm),
              Text(l10n.conversationListeningHint, style: Theme.of(context).textTheme.bodySmall),
              const SizedBox(height: AppSpacing.md),
              _MicButton(active: true, onTap: onMicTap),
            ],
          ),
          ConvState.sending || ConvState.speaking => Center(
            child: _MicButton(active: false, onTap: null),
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
  const _MicButton({required this.active, required this.onTap});

  final bool active;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      key: const Key('conversation_mic_button'),
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: active ? AppColors.accent : AppColors.primary,
        ),
        child: const Icon(Icons.mic, color: Colors.white, size: 32),
      ),
    );
  }
}

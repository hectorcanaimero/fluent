import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
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
          (t) => ChatMessage(role: t.role == 'assistant' ? 'assistant' : 'user', text: t.text),
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

  Future<void> _send() async {
    final l10n = AppLocalizations.of(context);
    final text = _draftController.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _state = ConvState.sending;
      _errorMessage = null;
    });
    try {
      final result = await ref
          .read(fluentApiProvider)
          .sendTurn(sessionId: widget.sessionId, text: text);
      _unavailableCount = 0;
      if (!mounted) return;
      setState(() {
        _messages.add(ChatMessage(role: 'user', text: text, corrections: result.corrections));
        _messages.add(
          ChatMessage(role: 'assistant', text: result.reply, degraded: result.degraded),
        );
        _draftController.clear();
        _state = ConvState.speaking;
      });
      _scrollToBottom();
      await _tts.speak(result.reply);
      if (!mounted) return;
      setState(() => _state = ConvState.idle);
      if (_pendingTimerEnd) {
        await _endSession(reason: 'timer');
      }
    } on ApiException catch (e) {
      if (e.code == ApiErrorCode.llmUnavailable) {
        _unavailableCount++;
        if (_unavailableCount >= 3) {
          await _showUnavailableDialog();
          return;
        }
      }
      if (!mounted) return;
      setState(() {
        _state = ConvState.reviewing;
        _errorMessage = l10n.conversationSendErrorGeneric;
      });
    }
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

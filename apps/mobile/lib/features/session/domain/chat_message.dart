import '../../../core/api/models.dart';

enum ConvState { idle, listening, reviewing, sending, speaking }

class ChatMessage {
  const ChatMessage({
    required this.role,
    required this.text,
    this.corrections = const [],
    this.degraded = false,
  });

  /// `'assistant'` o `'user'`.
  final String role;
  final String text;
  final List<Correction> corrections;
  final bool degraded;

  bool get isAssistant => role == 'assistant';
}

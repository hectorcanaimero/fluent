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

  /// Usado por el streaming del turno (SPEC-04 §4): actualiza el texto de
  /// la burbuja del tutor token a token y, al llegar `done`, sus
  /// correcciones/`degraded` finales.
  ChatMessage copyWith({String? text, List<Correction>? corrections, bool? degraded}) =>
      ChatMessage(
        role: role,
        text: text ?? this.text,
        corrections: corrections ?? this.corrections,
        degraded: degraded ?? this.degraded,
      );
}

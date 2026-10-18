import '../../../core/api/models.dart';

enum ConvState { idle, listening, reviewing, sending, speaking }

/// `normal`: conversación de siempre, con revisión de la transcripción antes
/// de enviar y chips de corrección (SPEC-06 §4.3).
///
/// `interview`: sesión de entrevista (IE-05, F12.4.T1, FR-34) — la
/// transcripción de voz se envía directo, sin pantalla de revisión ni
/// chips, con el encabezado "Pregunta n de 8" en vez del tema.
enum ConversationMode { normal, interview }

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

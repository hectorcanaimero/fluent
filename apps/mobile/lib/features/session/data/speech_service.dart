import 'package:speech_to_text/speech_to_text.dart' as stt;

/// Abstrae `speech_to_text` (SPEC-06 §5) para poder simular el flujo de
/// voz en tests y con `USE_FAKE_API=true`, sin permisos de micrófono ni
/// hardware real.
abstract class SpeechService {
  /// Pide permiso e inicializa el reconocedor. Devuelve `false` si el
  /// dispositivo no tiene STT disponible.
  Future<bool> initialize();

  /// `true` si el locale (por ejemplo `en_US`) está instalado en el
  /// dispositivo. Si es `false`, la UI debe ofrecer instalarlo u ofrecer
  /// modo texto (SPEC-06 §5).
  Future<bool> hasLocale(String localeId);

  /// Empieza a escuchar. [onResult] se llama con cada actualización de la
  /// transcripción parcial y una vez más con `isFinal: true` al terminar.
  Future<void> listen({
    required void Function(String text, bool isFinal) onResult,
    String localeId = 'en_US',
  });

  /// Termina de escuchar de forma prolija: dispara el resultado final.
  Future<void> stop();

  /// Cancela sin emitir resultado final (por ejemplo, si el usuario
  /// cambia a modo texto a mitad de una escucha).
  Future<void> cancel();

  bool get isListening;
}

class SpeechToTextService implements SpeechService {
  final stt.SpeechToText _speech = stt.SpeechToText();
  void Function(String text, bool isFinal)? _onResult;

  @override
  Future<bool> initialize() => _speech.initialize();

  @override
  Future<bool> hasLocale(String localeId) async {
    final locales = await _speech.locales();
    return locales.any((l) => l.localeId == localeId);
  }

  @override
  Future<void> listen({
    required void Function(String text, bool isFinal) onResult,
    String localeId = 'en_US',
  }) {
    _onResult = onResult;
    return _speech.listen(
      onResult: (result) => _onResult?.call(result.recognizedWords, result.finalResult),
      listenOptions: stt.SpeechListenOptions(
        listenMode: stt.ListenMode.dictation,
        partialResults: true,
        localeId: localeId,
        pauseFor: const Duration(seconds: 3),
        listenFor: const Duration(seconds: 45),
      ),
    );
  }

  @override
  Future<void> stop() => _speech.stop();

  @override
  Future<void> cancel() => _speech.cancel();

  @override
  bool get isListening => _speech.isListening;
}

/// Simula un dictado: los tests (o el modo `USE_FAKE_API`) llaman a
/// [emit] para ir empujando texto parcial/final en vez de hablarle al
/// micrófono.
class FakeSpeechService implements SpeechService {
  FakeSpeechService({this.available = true, this.hasEnUsLocale = true});

  final bool available;
  final bool hasEnUsLocale;

  void Function(String text, bool isFinal)? _onResult;
  bool _listening = false;
  String _lastPartial = '';

  @override
  Future<bool> initialize() async => available;

  @override
  Future<bool> hasLocale(String localeId) async =>
      localeId == 'en_US' ? hasEnUsLocale : false;

  @override
  Future<void> listen({
    required void Function(String text, bool isFinal) onResult,
    String localeId = 'en_US',
  }) async {
    _onResult = onResult;
    _listening = true;
    _lastPartial = '';
  }

  @override
  Future<void> stop() async {
    if (_listening) {
      _onResult?.call(_lastPartial, true);
    }
    _listening = false;
  }

  @override
  Future<void> cancel() async {
    _listening = false;
  }

  @override
  bool get isListening => _listening;

  /// Helper de test: simula que el usuario dijo [text].
  void emit(String text, {bool isFinal = false}) {
    _lastPartial = text;
    _onResult?.call(text, isFinal);
    if (isFinal) _listening = false;
  }
}

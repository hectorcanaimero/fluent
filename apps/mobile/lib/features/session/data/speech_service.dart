import 'package:speech_to_text/speech_recognition_error.dart';
import 'package:speech_to_text/speech_to_text.dart' as stt;

/// Abstrae `speech_to_text` (SPEC-06 §5) para poder simular el flujo de
/// voz en tests y con `USE_FAKE_API=true`, sin permisos de micrófono ni
/// hardware real.
abstract class SpeechService {
  /// Pide permiso e inicializa el reconocedor. Devuelve `false` si el
  /// dispositivo no tiene STT disponible **o** si el permiso de micrófono
  /// está denegado — para distinguir el caso, revisar [hasPermission]
  /// después (MAL-05).
  Future<bool> initialize();

  /// `true` si el usuario ya concedió el permiso de micrófono. Se consulta
  /// cuando [initialize] devuelve `false`, para mostrar "activá el
  /// micrófono en Ajustes" en vez del diálogo genérico de "no hay
  /// reconocimiento de voz".
  Future<bool> get hasPermission;

  /// `true` si el locale (por ejemplo `en_US`) está instalado en el
  /// dispositivo. Si es `false`, la UI debe ofrecer instalarlo u ofrecer
  /// modo texto (SPEC-06 §5).
  Future<bool> hasLocale(String localeId);

  /// Empieza a escuchar. [onResult] se llama con cada actualización de la
  /// transcripción parcial y una vez más con `isFinal: true` al terminar.
  ///
  /// MAL-05: el motor puede terminar solo sin emitir nunca `isFinal: true`
  /// (los 45 s de `listenFor`, una llamada entrante, `error_no_match`) —
  /// [onDoneWithoutResult] cubre el primer caso (status `done`/
  /// `notListening` sin resultado final) y [onError] los errores del motor
  /// (`error.errorMsg`, por ejemplo `error_no_match` o
  /// `error_speech_timeout`).
  Future<void> listen({
    required void Function(String text, bool isFinal) onResult,
    void Function()? onDoneWithoutResult,
    void Function(String errorCode)? onError,
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
  void Function()? _onDoneWithoutResult;
  void Function(String errorCode)? _onError;
  bool _finalResultReceived = false;

  @override
  Future<bool> initialize() =>
      _speech.initialize(onStatus: _handleStatus, onError: _handleError);

  @override
  Future<bool> get hasPermission => _speech.hasPermission;

  void _handleStatus(String status) {
    final done =
        status == stt.SpeechToText.doneStatus ||
        status == stt.SpeechToText.notListeningStatus;
    if (done && !_finalResultReceived) {
      _onDoneWithoutResult?.call();
    }
  }

  void _handleError(SpeechRecognitionError error) {
    _onError?.call(error.errorMsg);
  }

  @override
  Future<bool> hasLocale(String localeId) async {
    final locales = await _speech.locales();
    return locales.any((l) => l.localeId == localeId);
  }

  @override
  Future<void> listen({
    required void Function(String text, bool isFinal) onResult,
    void Function()? onDoneWithoutResult,
    void Function(String errorCode)? onError,
    String localeId = 'en_US',
  }) async {
    _onResult = onResult;
    _onDoneWithoutResult = onDoneWithoutResult;
    _onError = onError;
    _finalResultReceived = false;
    try {
      await _speech.listen(
        onResult: (result) {
          if (result.finalResult) _finalResultReceived = true;
          _onResult?.call(result.recognizedWords, result.finalResult);
        },
        listenOptions: stt.SpeechListenOptions(
          listenMode: stt.ListenMode.dictation,
          partialResults: true,
          localeId: localeId,
          pauseFor: const Duration(seconds: 3),
          listenFor: const Duration(seconds: 45),
        ),
      );
    } catch (_) {
      // MAL-05: `listen()` puede lanzar (por ejemplo si el motor nativo
      // rechaza la sesión) en vez de reportarlo por `onError` — sin este
      // catch, la app quedaba "escuchando" para siempre.
      _onError?.call('listen_failed');
    }
  }

  @override
  Future<void> stop() => _speech.stop();

  @override
  Future<void> cancel() => _speech.cancel();

  @override
  bool get isListening => _speech.isListening;
}

/// Simula un dictado: los tests (o el modo `USE_FAKE_API`) llaman a
/// [emit]/[emitDoneWithoutResult]/[emitError] en vez de hablarle al
/// micrófono.
class FakeSpeechService implements SpeechService {
  FakeSpeechService({
    this.available = true,
    this.hasEnUsLocale = true,
    this.permissionGranted = true,
  });

  final bool available;
  final bool hasEnUsLocale;

  /// Si `initialize()` devuelve `false` porque el usuario denegó el
  /// permiso (en vez de porque el dispositivo no tiene STT), MAL-05.
  final bool permissionGranted;

  void Function(String text, bool isFinal)? _onResult;
  void Function()? _onDoneWithoutResult;
  void Function(String errorCode)? _onError;
  bool _listening = false;
  String _lastPartial = '';

  @override
  Future<bool> initialize() async => available;

  @override
  Future<bool> get hasPermission async => permissionGranted;

  @override
  Future<bool> hasLocale(String localeId) async =>
      localeId == 'en_US' ? hasEnUsLocale : false;

  @override
  Future<void> listen({
    required void Function(String text, bool isFinal) onResult,
    void Function()? onDoneWithoutResult,
    void Function(String errorCode)? onError,
    String localeId = 'en_US',
  }) async {
    _onResult = onResult;
    _onDoneWithoutResult = onDoneWithoutResult;
    _onError = onError;
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

  bool cancelCalled = false;

  @override
  Future<void> cancel() async {
    cancelCalled = true;
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

  /// Helper de test (MAL-05): el motor termina solo sin resultado final
  /// (los 45 s, una llamada entrante).
  void emitDoneWithoutResult() {
    _listening = false;
    _onDoneWithoutResult?.call();
  }

  /// Helper de test (MAL-05): el motor reporta un error
  /// (`error_no_match`, `error_speech_timeout`, etc.).
  void emitError(String errorCode) {
    _listening = false;
    _onError?.call(errorCode);
  }
}

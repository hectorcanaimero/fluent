import 'package:flutter_tts/flutter_tts.dart';

/// Abstrae `flutter_tts` (SPEC-06 §5) para poder simular la voz del tutor
/// en tests y con `USE_FAKE_API=true`.
abstract class TtsService {
  Future<void> setLanguage(String language);

  /// [rate] es el multiplicador que ofrece la UI (0.8x/1x/1.2x, control de
  /// velocidad, SPEC-06 §4.3), no el valor nativo de `flutter_tts`.
  Future<void> setSpeechRate(double rate);

  /// Completa cuando termina de reproducir (equivalente a
  /// `awaitSpeakCompletion(true)`), para poder encadenar estados.
  Future<void> speak(String text);

  /// Ducking: se llama al empezar a escuchar para cortar cualquier audio
  /// en curso.
  Future<void> stop();
}

class FlutterTtsService implements TtsService {
  FlutterTtsService({FlutterTts? tts}) : _tts = tts ?? FlutterTts() {
    _tts.awaitSpeakCompletion(true);
  }

  final FlutterTts _tts;

  @override
  Future<void> setLanguage(String language) async {
    await _tts.setLanguage(language);
  }

  @override
  Future<void> setSpeechRate(double rate) async {
    // `setSpeechRate` de flutter_tts usa el rango nativo de cada plataforma:
    // Android multiplica por 2 (0.5 nativo == "normal"), iOS usa 0-1 con 0.5
    // como "normal". El multiplicador de la UI (0.8x/1x/1.2x) asume 1.0 ==
    // "normal", así que hay que centrarlo en 0.5 en vez de pasarlo crudo
    // (eso sonaba al doble de rápido, MAL-06).
    await _tts.setSpeechRate(0.5 * rate);
  }

  @override
  Future<void> speak(String text) async {
    await _tts.speak(text);
  }

  @override
  Future<void> stop() async {
    await _tts.stop();
  }
}

/// No reproduce audio real; completa casi al instante para que los tests
/// puedan avanzar la máquina de estados sin esperar.
class FakeTtsService implements TtsService {
  FakeTtsService({this.speakDelay = Duration.zero});

  final Duration speakDelay;
  final List<String> spokenTexts = [];
  double lastRate = 1.0;
  String? lastLanguage;
  bool stopCalled = false;

  @override
  Future<void> setLanguage(String language) async {
    lastLanguage = language;
  }

  @override
  Future<void> setSpeechRate(double rate) async {
    lastRate = rate;
  }

  @override
  Future<void> speak(String text) async {
    spokenTexts.add(text);
    if (speakDelay > Duration.zero) {
      await Future.delayed(speakDelay);
    }
  }

  @override
  Future<void> stop() async {
    stopCalled = true;
  }
}

import 'package:flutter_tts/flutter_tts.dart';

/// Abstrae `flutter_tts` (SPEC-06 §5) para poder simular la voz del tutor
/// en tests y con `USE_FAKE_API=true`.
abstract class TtsService {
  Future<void> setLanguage(String language);

  /// [rate] va de 0.0 a 1.0. La UI ofrece 0.8x/1x/1.2x (control de
  /// velocidad, SPEC-06 §4.3); se mapean a valores razonables del rango
  /// nativo en la implementación real.
  Future<void> setSpeechRate(double rate);

  /// Completa cuando termina de reproducir (equivalente a
  /// `awaitSpeakCompletion(true)`), para poder encadenar estados.
  Future<void> speak(String text);

  /// Ducking: se llama al empezar a escuchar para cortar cualquier audio
  /// en curso.
  Future<void> stop();
}

class FlutterTtsService implements TtsService {
  FlutterTtsService() {
    _tts.awaitSpeakCompletion(true);
  }

  final FlutterTts _tts = FlutterTts();

  @override
  Future<void> setLanguage(String language) async {
    await _tts.setLanguage(language);
  }

  @override
  Future<void> setSpeechRate(double rate) async {
    await _tts.setSpeechRate(rate);
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

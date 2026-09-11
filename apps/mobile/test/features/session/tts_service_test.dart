import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:mocktail/mocktail.dart';

import 'package:fluent_mobile/features/session/data/tts_service.dart';

class MockFlutterTts extends Mock implements FlutterTts {}

void main() {
  late MockFlutterTts tts;
  late FlutterTtsService service;

  setUp(() {
    tts = MockFlutterTts();
    when(() => tts.awaitSpeakCompletion(any())).thenAnswer((_) async => 1);
    when(() => tts.setSpeechRate(any())).thenAnswer((_) async => 1);
    service = FlutterTtsService(tts: tts);
  });

  test('mapea el multiplicador de la UI a la mitad para flutter_tts (MAL-06)', () async {
    await service.setSpeechRate(1.0);
    verify(() => tts.setSpeechRate(0.5)).called(1);

    await service.setSpeechRate(0.8);
    verify(() => tts.setSpeechRate(0.4)).called(1);

    await service.setSpeechRate(1.2);
    verify(() => tts.setSpeechRate(0.6)).called(1);
  });
}

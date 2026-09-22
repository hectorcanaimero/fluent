import 'package:fluent_mobile/features/session/data/speech_service.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  // iOS devuelve los identificadores con guion; comparar contra 'en_US'
  // dejaba sin voz a todos los iPhone.
  test('encuentra el inglés de EE. UU. con guion (iOS)', () {
    expect(pickLocaleId(['es-ES', 'en-US', 'pt-BR'], 'en'), 'en-US');
  });

  test('encuentra el inglés de EE. UU. con guion bajo (Android)', () {
    expect(pickLocaleId(['es_ES', 'en_US'], 'en'), 'en_US');
  });

  test('sin la variante de EE. UU. sirve otra del mismo idioma', () {
    expect(pickLocaleId(['en-GB', 'es-ES'], 'en'), 'en-GB');
  });

  test('prefiere EE. UU. aunque venga después', () {
    expect(pickLocaleId(['en-AU', 'en-US'], 'en'), 'en-US');
  });

  test('sin el idioma devuelve null', () {
    expect(pickLocaleId(['es-ES', 'pt-BR'], 'en'), isNull);
  });
}

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Ambos ARB deben declarar exactamente las mismas claves de traducción.
/// Cada tarea que agrega texto a la UI agrega la clave a `app_es.arb` y a
/// `app_pt.arb` en el mismo commit (docs/specs/README.md).
void main() {
  test('app_es.arb y app_pt.arb tienen las mismas claves', () {
    final esFile = File('lib/l10n/app_es.arb');
    final ptFile = File('lib/l10n/app_pt.arb');

    final es = jsonDecode(esFile.readAsStringSync()) as Map<String, dynamic>;
    final pt = jsonDecode(ptFile.readAsStringSync()) as Map<String, dynamic>;

    Set<String> translationKeys(Map<String, dynamic> arb) {
      return arb.keys.where((k) => !k.startsWith('@')).toSet();
    }

    final esKeys = translationKeys(es);
    final ptKeys = translationKeys(pt);

    expect(esKeys, isNotEmpty);
    expect(
      esKeys.difference(ptKeys),
      isEmpty,
      reason: 'Claves presentes en app_es.arb pero no en app_pt.arb',
    );
    expect(
      ptKeys.difference(esKeys),
      isEmpty,
      reason: 'Claves presentes en app_pt.arb pero no en app_es.arb',
    );
  });
}

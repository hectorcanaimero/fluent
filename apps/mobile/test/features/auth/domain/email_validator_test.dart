import 'package:flutter_test/flutter_test.dart';
import 'package:fluent_mobile/features/auth/domain/email_validator.dart';

void main() {
  test('acepta emails con usuario, arroba y dominio con punto', () {
    expect(isValidEmail('ana@example.com'), isTrue);
    expect(isValidEmail('  ana.perez+x@sub.example.co  '), isTrue);
  });

  test('rechaza lo que seguro no es un email', () {
    for (final v in ['', 'ana', 'ana@', '@example.com', 'ana@example', 'a a@b.com']) {
      expect(isValidEmail(v), isFalse, reason: v);
    }
  });
}

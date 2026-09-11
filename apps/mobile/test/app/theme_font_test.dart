import 'package:flutter_test/flutter_test.dart';

import 'package:fluent_mobile/app/theme.dart';

void main() {
  test('la tipografía del tema es Plus Jakarta Sans', () {
    final theme = AppTheme.light();
    expect(theme.textTheme.bodyMedium!.fontFamily, 'PlusJakartaSans');
  });
}

import 'package:fluent_mobile/core/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test(
    'MAL-12: si el plugin nativo falla (sin binding en test), cae a UTC',
    () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final timezone = await container.read(timezoneProvider.future);

      expect(timezone, 'UTC');
    },
  );
}

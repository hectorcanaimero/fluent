import 'package:fluent_mobile/app/app.dart';
import 'package:fluent_mobile/app/router.dart';
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/push/push_service.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../core/push/push_service_test.dart' show FakePushPlatform;

Future<(ProviderContainer, FakePushPlatform, FakeApi)> _pumpSignedIn(
  WidgetTester tester, {
  String? launchRoute,
}) async {
  final platform = FakePushPlatform()..launchRoute = launchRoute;
  final api = FakeApi(artificialDelay: Duration.zero);
  final container = ProviderContainer(
    overrides: [
      tokenStoreProvider.overrideWithValue(
        InMemoryTokenStore()
          ..write(const AuthTokens(accessToken: 'a', refreshToken: 'r')),
      ),
      fluentApiProvider.overrideWith((ref) => api),
      pushPlatformProvider.overrideWithValue(platform),
      timezoneProvider.overrideWith((ref) async => 'UTC'),
      // Sin la animación del splash: el router sigue apenas hay sesión.
      splashDoneProvider.overrideWith((ref) => true),
    ],
  );
  addTearDown(container.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(container: container, child: const FluentApp()),
  );
  await tester.pumpAndSettle();
  return (container, platform, api);
}

String _location(ProviderContainer container) =>
    container.read(routerProvider).routerDelegate.currentConfiguration.uri.path;

void main() {
  testWidgets('con sesión registra el dispositivo si ya había permiso', (
    tester,
  ) async {
    final (_, _, api) = await _pumpSignedIn(tester);
    expect(api.pushTokens, {'token-1': 'android'});
  });

  testWidgets('tocar un push en segundo plano lleva a su ruta', (tester) async {
    final (container, platform, _) = await _pumpSignedIn(tester);
    platform.opened.add('/group');
    await tester.pumpAndSettle();
    expect(_location(container), '/group');
  });

  testWidgets('un push que abrió la app desde cerrada lleva a su ruta', (
    tester,
  ) async {
    final (container, _, _) = await _pumpSignedIn(
      tester,
      launchRoute: '/group',
    );
    expect(_location(container), '/group');
  });

  testWidgets('con la app abierta muestra un aviso que lleva a la ruta', (
    tester,
  ) async {
    final (container, platform, _) = await _pumpSignedIn(tester);
    platform.foreground.add((
      title: 'Camila practicó sobre viajes',
      body: '¿Te animás?',
      route: '/group',
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(
      find.text('Camila practicó sobre viajes\n¿Te animás?'),
      findsOneWidget,
    );
    final action = tester.widget<SnackBarAction>(
      find.widgetWithText(SnackBarAction, 'Ver'),
    );
    action.onPressed();
    await tester.pumpAndSettle();
    expect(_location(container), '/group');
  });

  testWidgets('cerrar sesión da de baja el token de push', (tester) async {
    final (container, _, api) = await _pumpSignedIn(tester);
    expect(api.pushTokens, isNotEmpty);
    // La cadena del logout (token store, baja del token) termina fuera del
    // reloj simulado del test: se corre en async real.
    await tester.runAsync(
      () => container.read(authControllerProvider.notifier).logout(),
    );
    await tester.pumpAndSettle();
    expect(api.pushTokens, isEmpty);
  });
}

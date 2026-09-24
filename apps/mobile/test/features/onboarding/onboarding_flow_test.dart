import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/onboarding/presentation/onboarding_flow.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

Future<ProviderContainer> _authenticatedContainer() async {
  final container = ProviderContainer(
    overrides: [
      tokenStoreProvider.overrideWithValue(
        InMemoryTokenStore()
          ..write(const AuthTokens(accessToken: 'a', refreshToken: 'r')),
      ),
      fluentApiProvider.overrideWith(
        (ref) => FakeApi(artificialDelay: Duration.zero),
      ),
      // MAL-12: el plugin real de flutter_timezone no tiene binding en
      // tests; se inyecta un valor fijo en vez de depender de su fallback.
      timezoneProvider.overrideWith((ref) async => 'UTC'),
    ],
  );
  await container.read(authControllerProvider.notifier).bootstrap();
  return container;
}

Future<void> _pumpOnboarding(
  WidgetTester tester,
  ProviderContainer container,
) async {
  final router = GoRouter(
    initialLocation: '/onboarding',
    routes: [
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingFlow(),
      ),
      GoRoute(
        path: '/',
        builder: (context, state) => const Text('HOME_SCREEN'),
      ),
    ],
  );
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// MAL-24: el onboarding ya no pide el nombre (lo pidió el registro) —
/// arranca directo en el paso de nivel.
Future<void> _goThroughLevel(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('onboarding_level_intermediate')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('onboarding_continue_button')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('no deja avanzar con menos de 3 intereses', (tester) async {
    final container = await _authenticatedContainer();
    addTearDown(container.dispose);
    await _pumpOnboarding(tester, container);
    await _goThroughLevel(tester);

    // Estamos en el paso de intereses: seleccionamos solo 2.
    await tester.tap(find.byKey(const Key('onboarding_interest_travel')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('onboarding_interest_technology')));
    await tester.pumpAndSettle();

    final finishButton = tester.widget<ElevatedButton>(
      find.byKey(const Key('onboarding_continue_button')),
    );
    expect(finishButton.onPressed, isNull);

    // Con un tercer interés, el botón se habilita.
    await tester.tap(
      find.byKey(const Key('onboarding_interest_movies-series')),
    );
    await tester.pumpAndSettle();
    final enabledButton = tester.widget<ElevatedButton>(
      find.byKey(const Key('onboarding_continue_button')),
    );
    expect(enabledButton.onPressed, isNotNull);
  });

  testWidgets('al terminar con un proveedor ya conectado, navega a /', (
    tester,
  ) async {
    final container = await _authenticatedContainer();
    addTearDown(container.dispose);
    await _pumpOnboarding(tester, container);
    await _goThroughLevel(tester);

    await tester.tap(find.byKey(const Key('onboarding_interest_travel')));
    await tester.tap(find.byKey(const Key('onboarding_interest_technology')));
    await tester.tap(
      find.byKey(const Key('onboarding_interest_movies-series')),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('onboarding_continue_button')));
    await tester.pumpAndSettle();

    expect(find.text('HOME_SCREEN'), findsOneWidget);
  });

  testWidgets(
    'MAL-12: usa la timezone inyectada, no el valor fijo de Buenos Aires',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final container = ProviderContainer(
        overrides: [
          tokenStoreProvider.overrideWithValue(
            InMemoryTokenStore()
              ..write(const AuthTokens(accessToken: 'a', refreshToken: 'r')),
          ),
          fluentApiProvider.overrideWith((ref) => api),
          timezoneProvider.overrideWith((ref) async => 'America/Sao_Paulo'),
        ],
      );
      await container.read(authControllerProvider.notifier).bootstrap();
      addTearDown(container.dispose);
      await _pumpOnboarding(tester, container);
      await _goThroughLevel(tester);

      await tester.tap(find.byKey(const Key('onboarding_interest_travel')));
      await tester.tap(find.byKey(const Key('onboarding_interest_technology')));
      await tester.tap(
        find.byKey(const Key('onboarding_interest_movies-series')),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('onboarding_continue_button')));
      await tester.pumpAndSettle();

      final me = await api.getMe();
      expect(me.profile.timezone, 'America/Sao_Paulo');
    },
  );

  testWidgets('los chips de intereses tienen al menos 48 dp de alto', (
    tester,
  ) async {
    final container = await _authenticatedContainer();
    addTearDown(container.dispose);
    await _pumpOnboarding(tester, container);
    await _goThroughLevel(tester);

    final chip = find.byKey(const Key('onboarding_interest_technology'));
    expect(chip, findsOneWidget);
    expect(tester.getSize(chip).height, greaterThanOrEqualTo(48));
  });
}

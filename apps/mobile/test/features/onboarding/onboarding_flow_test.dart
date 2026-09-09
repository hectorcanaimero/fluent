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
        InMemoryTokenStore()..write(const AuthTokens(accessToken: 'a', refreshToken: 'r')),
      ),
      fluentApiProvider.overrideWith((ref) => FakeApi(artificialDelay: Duration.zero)),
    ],
  );
  await container.read(authControllerProvider.notifier).bootstrap();
  return container;
}

Future<void> _pumpOnboarding(WidgetTester tester, ProviderContainer container) async {
  final router = GoRouter(
    initialLocation: '/onboarding',
    routes: [
      GoRoute(path: '/onboarding', builder: (context, state) => const OnboardingFlow()),
      GoRoute(path: '/providers', builder: (context, state) => const Text('PROVIDERS_SCREEN')),
      GoRoute(path: '/', builder: (context, state) => const Text('HOME_SCREEN')),
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

Future<void> _goThroughNameAndLevel(WidgetTester tester) async {
  await tester.enterText(find.byKey(const Key('onboarding_name_field')), 'María');
  await tester.pump();
  await tester.tap(find.byKey(const Key('onboarding_continue_button')));
  await tester.pumpAndSettle();

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
    await _goThroughNameAndLevel(tester);

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
    await tester.tap(find.byKey(const Key('onboarding_interest_movies-series')));
    await tester.pumpAndSettle();
    final enabledButton = tester.widget<ElevatedButton>(
      find.byKey(const Key('onboarding_continue_button')),
    );
    expect(enabledButton.onPressed, isNotNull);
  });

  testWidgets('al terminar con un proveedor ya conectado, navega a /', (tester) async {
    final container = await _authenticatedContainer();
    addTearDown(container.dispose);
    await _pumpOnboarding(tester, container);
    await _goThroughNameAndLevel(tester);

    await tester.tap(find.byKey(const Key('onboarding_interest_travel')));
    await tester.tap(find.byKey(const Key('onboarding_interest_technology')));
    await tester.tap(find.byKey(const Key('onboarding_interest_movies-series')));
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('onboarding_continue_button')));
    await tester.pumpAndSettle();

    // FakeApi arranca con OpenRouter ya conectado (dato de ejemplo), así
    // que el onboarding no debería pasar por /providers.
    expect(find.text('HOME_SCREEN'), findsOneWidget);
    expect(find.text('PROVIDERS_SCREEN'), findsNothing);
  });
}

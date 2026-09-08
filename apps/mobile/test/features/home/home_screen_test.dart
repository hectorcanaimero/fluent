import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/home/presentation/home_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _pumpHome(WidgetTester tester, FakeApi api) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [fluentApiProvider.overrideWith((ref) => api)],
      child: const MaterialApp(
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: HomeScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('estado normal: botón de practicar habilitado, hay grupo y hechos pendientes', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    await _pumpHome(tester, api);

    final practiceButton = tester.widget<ElevatedButton>(
      find.byKey(const Key('home_practice_button')),
    );
    expect(practiceButton.onPressed, isNotNull);
    expect(find.byKey(const Key('home_pending_facts_card')), findsOneWidget);
    expect(find.byKey(const Key('home_no_provider_banner')), findsNothing);
  });

  testWidgets('sin proveedor conectado: banner bloqueante y CTA deshabilitado', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    await api.disconnectProvider('openrouter');
    await _pumpHome(tester, api);

    expect(find.byKey(const Key('home_no_provider_banner')), findsOneWidget);
    final practiceButton = tester.widget<ElevatedButton>(
      find.byKey(const Key('home_practice_button')),
    );
    expect(practiceButton.onPressed, isNull);
  });

  testWidgets('con boss pendiente, muestra el botón de Boss battle', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero)..bossPending = true;
    await _pumpHome(tester, api);

    expect(find.byKey(const Key('home_boss_button')), findsOneWidget);
    expect(find.byKey(const Key('home_practice_button')), findsNothing);
  });

  testWidgets('sin hechos pendientes, no muestra la tarjeta de memoria', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    await api.patchFact(factId: 'fact-1', status: 'confirmed');
    await api.patchFact(factId: 'fact-2', status: 'dismissed');
    await _pumpHome(tester, api);

    expect(find.byKey(const Key('home_pending_facts_card')), findsNothing);
  });
}

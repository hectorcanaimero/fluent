import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/providers/data/oauth_launcher.dart';
import 'package:fluent_mobile/features/providers/presentation/providers_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _pumpProvidersScreen(WidgetTester tester) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        fluentApiProvider.overrideWith(
          (ref) => FakeApi(artificialDelay: Duration.zero),
        ),
        oauthLauncherProvider.overrideWith((ref) => FakeOAuthLauncher()),
      ],
      child: const MaterialApp(
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: ProvidersScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('flujo completo de Gemini: pegar key conecta el proveedor', (tester) async {
    await _pumpProvidersScreen(tester);
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));

    // Gemini arranca sin conectar en los datos de ejemplo.
    expect(find.text(l10n.providersStatusNotConnected), findsOneWidget);

    await tester.tap(find.text(l10n.providersGeminiPasteKeyButton));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(const Key('gemini_key_field')),
      'a-valid-looking-key-123',
    );
    await tester.tap(find.byKey(const Key('gemini_key_confirm_button')));
    await tester.pumpAndSettle();

    expect(find.text(l10n.providersStatusConnected), findsNWidgets(2));
    expect(find.text(l10n.providersStatusNotConnected), findsNothing);
  });

  testWidgets('modelos de un proveedor no conectado aparecen deshabilitados', (tester) async {
    await _pumpProvidersScreen(tester);
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));

    await tester.tap(find.byKey(const Key('model_picker_chat')));
    await tester.pumpAndSettle();

    // El proveedor Gemini está más abajo en la hoja de selección.
    await tester.dragUntilVisible(
      find.byKey(const Key('model_option_gemini-1.5-flash')),
      find.byKey(const Key('model_picker_list')),
      const Offset(0, -200),
    );
    await tester.pumpAndSettle();

    // Gemini todavía no está conectado: su modelo gratis debe verse pero
    // deshabilitado.
    final geminiModelTile = tester.widget<ListTile>(
      find.byKey(const Key('model_option_gemini-1.5-flash')),
    );
    expect(geminiModelTile.enabled, isFalse);
    expect(geminiModelTile.onTap, isNull);
    expect(find.text(l10n.providersModelProviderDisabledHint), findsOneWidget);

    // OpenRouter sí está conectado en los datos de ejemplo.
    final openRouterModelTile = tester.widget<ListTile>(
      find.byKey(const Key('model_option_meta-llama/llama-3.1-8b-instruct:free')),
    );
    expect(openRouterModelTile.enabled, isTrue);
  });
}

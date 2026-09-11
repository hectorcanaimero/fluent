import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/fluent_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/providers/data/oauth_launcher.dart';
import 'package:fluent_mobile/features/providers/presentation/providers_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// FakeApi sin ningún proveedor activo, para probar que el CTA "Ir a
/// practicar" (MAL-11) no aparece cuando no hay nada conectado.
class _NoActiveProviderApi extends FakeApi {
  _NoActiveProviderApi() : super(artificialDelay: Duration.zero);

  @override
  Future<MeResponse> getMe() async {
    final me = await super.getMe();
    return me.copyWith(
      providers: [
        for (final p in me.providers) ProviderInfo(provider: p.provider, status: 'not_connected'),
      ],
    );
  }
}

/// ProvidersScreen siempre vive bajo un GoRouter en la app real
/// (`app/router.dart`): `context.canPop()`/`context.go()` (MAL-11) lo
/// exigen, así que los tests también la envuelven en uno.
Future<void> _pumpProvidersScreen(WidgetTester tester, {FluentApi? api}) async {
  final router = GoRouter(
    initialLocation: '/providers',
    routes: [
      GoRoute(path: '/', builder: (context, state) => const Text('HOME_SCREEN')),
      GoRoute(path: '/providers', builder: (context, state) => const ProvidersScreen()),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        fluentApiProvider.overrideWith((ref) => api ?? FakeApi(artificialDelay: Duration.zero)),
        oauthLauncherProvider.overrideWith((ref) => FakeOAuthLauncher()),
      ],
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

  testWidgets('con un proveedor activo muestra "Ir a practicar" y navega a Home', (tester) async {
    await _pumpProvidersScreen(tester);

    expect(find.byKey(const Key('providers_go_practice_button')), findsOneWidget);

    await tester.tap(find.byKey(const Key('providers_go_practice_button')));
    await tester.pumpAndSettle();

    expect(find.text('HOME_SCREEN'), findsOneWidget);
  });

  testWidgets('sin proveedores activos no muestra "Ir a practicar"', (tester) async {
    await _pumpProvidersScreen(tester, api: _NoActiveProviderApi());

    expect(find.byKey(const Key('providers_go_practice_button')), findsNothing);
  });
}

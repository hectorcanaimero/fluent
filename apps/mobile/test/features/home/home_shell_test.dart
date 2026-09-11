import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/home/presentation/home_shell.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// OpenRouter arranca sin conectar, para probar el gate de MAL-13 en la
/// pestaña Practicar.
class _NoActiveProviderApi extends FakeApi {
  _NoActiveProviderApi() : super(artificialDelay: Duration.zero);

  @override
  Future<MeResponse> getMe() async {
    final me = await super.getMe();
    return me.copyWith(
      providers: [
        for (final p in me.providers)
          ProviderInfo(provider: p.provider, status: 'not_connected'),
      ],
    );
  }
}

Future<void> _pumpShell(WidgetTester tester, {required FakeApi api}) async {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(
            path: '/',
            builder: (context, state) => const Text('HOME_CONTENT'),
          ),
        ],
      ),
      GoRoute(
        path: '/session/new',
        builder: (context, state) => const Text('NEW_SESSION_SCREEN'),
      ),
      GoRoute(
        path: '/providers',
        builder: (context, state) => const Text('PROVIDERS_SCREEN'),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [fluentApiProvider.overrideWith((ref) => api)],
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
  testWidgets(
    'MAL-13: con proveedor activo, "Practicar" abre el selector de sesión',
    (tester) async {
      await _pumpShell(tester, api: FakeApi(artificialDelay: Duration.zero));

      await tester.tap(find.byIcon(Icons.mic_none_outlined));
      await tester.pumpAndSettle();

      expect(find.text('NEW_SESSION_SCREEN'), findsOneWidget);
    },
  );

  testWidgets(
    'MAL-13: sin proveedor activo, "Practicar" manda a Proveedores en vez de fallar en frío',
    (tester) async {
      await _pumpShell(tester, api: _NoActiveProviderApi());

      // Se toca apenas montado el shell, antes de que resuelva el primer
      // `getMe()` de canPracticeProvider: sin el `await` del fix, el
      // fallback `?? true` dejaba pasar igual (fail-open).
      await tester.tap(find.byIcon(Icons.mic_none_outlined));
      await tester.pump();
      await tester.pumpAndSettle();

      expect(find.text('PROVIDERS_SCREEN'), findsOneWidget);
      expect(find.text('NEW_SESSION_SCREEN'), findsNothing);
    },
  );
}

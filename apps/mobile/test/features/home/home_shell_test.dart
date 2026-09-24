import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/home/presentation/home_shell.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

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
  testWidgets('"Practicar" abre el selector de sesión', (tester) async {
    await _pumpShell(tester, api: FakeApi(artificialDelay: Duration.zero));

    await tester.tap(find.byIcon(Icons.mic_none_outlined));
    await tester.pumpAndSettle();

    expect(find.text('NEW_SESSION_SCREEN'), findsOneWidget);
  });
}

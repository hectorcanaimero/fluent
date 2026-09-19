import 'package:fluent_mobile/core/errors/api_error_snack_bar.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

Future<void> _pumpAndShow(WidgetTester tester, ApiErrorCode code) async {
  final router = GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (context, _) => Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => ScaffoldMessenger.of(
                context,
              ).showSnackBar(apiErrorSnackBar(context, code)),
              child: const Text('fallar'),
            ),
          ),
        ),
      ),
      GoRoute(
        path: '/providers',
        builder: (context, _) => const Text('PROVIDERS_SCREEN'),
      ),
    ],
  );
  await tester.pumpWidget(
    MaterialApp.router(
      routerConfig: router,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    ),
  );
  await tester.tap(find.text('fallar'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('sin cuenta de IA el aviso lleva a conectarla', (tester) async {
    await _pumpAndShow(tester, ApiErrorCode.providerNotConnected);
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));

    expect(find.text(l10n.errorProviderNotConnected), findsOneWidget);
    await tester.tap(find.text(l10n.homeNoProviderAction));
    await tester.pumpAndSettle();
    expect(find.text('PROVIDERS_SCREEN'), findsOneWidget);
  });

  testWidgets('otros errores no llevan acción', (tester) async {
    await _pumpAndShow(tester, ApiErrorCode.rateLimited);
    expect(find.byType(SnackBarAction), findsNothing);
  });
}

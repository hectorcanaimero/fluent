import 'package:fluent_mobile/app/splash_screen.dart';
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// `getMe()` falla mientras `offline` sea true.
class _FlakyApi extends FakeApi {
  _FlakyApi() : super(artificialDelay: Duration.zero);

  bool offline = true;

  @override
  Future<MeResponse> getMe() {
    if (offline) {
      return Future.error(
        const ApiException(
          code: ApiErrorCode.unknown,
          message: 'network error',
          statusCode: null,
        ),
      );
    }
    return super.getMe();
  }
}

Future<void> _pumpSplash(WidgetTester tester, ProviderContainer container) {
  return tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: SplashScreen(),
      ),
    ),
  );
}

void main() {
  testWidgets('mientras resuelve muestra el spinner', (tester) async {
    final container = ProviderContainer(
      overrides: [
        tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
        fluentApiProvider.overrideWith((ref) => FakeApi(artificialDelay: Duration.zero)),
      ],
    );
    addTearDown(container.dispose);

    await _pumpSplash(tester, container);

    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('sin red ofrece reintentar en vez de mandar al login (MAL-03)', (tester) async {
    final api = _FlakyApi();
    final store = InMemoryTokenStore();
    await store.write(const AuthTokens(accessToken: 'a', refreshToken: 'r'));

    final container = ProviderContainer(
      overrides: [
        tokenStoreProvider.overrideWithValue(store),
        fluentApiProvider.overrideWith((ref) => api),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).bootstrap();
    await _pumpSplash(tester, container);
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.authOfflineTitle), findsOneWidget);
    expect(find.text(l10n.authOfflineBody), findsOneWidget);
    expect(find.byKey(const Key('splash_retry_button')), findsOneWidget);
    // Los tokens siguen guardados: no se cerró la sesión.
    expect(await store.read(), isNotNull);

    // Reintentar con red recupera la sesión. Sin `pumpAndSettle`: al volver a
    // `authenticated` el splash muestra el spinner, que nunca deja de animar.
    api.offline = false;
    await tester.tap(find.byKey(const Key('splash_retry_button')));
    await tester.pump();
    await tester.pump(Duration.zero);

    expect(container.read(authControllerProvider).status, AuthStatus.authenticated);
    expect(find.byKey(const Key('splash_retry_button')), findsNothing);
  });
}

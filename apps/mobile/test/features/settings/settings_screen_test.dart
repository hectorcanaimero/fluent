import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/settings/presentation/settings_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// Deja pasar la primera llamada a `getMe` (la que hace
/// `AuthController.bootstrap`) y falla solo la segunda (la que hace
/// `SettingsScreen` para cargar su propio perfil), para poder probar el
/// camino de error de la pantalla sin romper el bootstrap de auth.
class _ThrowingSecondGetMeApi extends FakeApi {
  _ThrowingSecondGetMeApi() : super(artificialDelay: Duration.zero);

  var _calls = 0;

  @override
  Future<MeResponse> getMe() {
    _calls += 1;
    if (_calls == 2) return Future.error(Exception('boom'));
    return super.getMe();
  }
}

void main() {
  testWidgets('muestra el perfil y cerrar sesión limpia el estado de auth', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final container = ProviderContainer(
      overrides: [
        tokenStoreProvider.overrideWithValue(
          InMemoryTokenStore()
            ..write(const AuthTokens(accessToken: 'a', refreshToken: 'r')),
        ),
        fluentApiProvider.overrideWith((ref) => api),
      ],
    );
    addTearDown(container.dispose);
    await container.read(authControllerProvider.notifier).bootstrap();

    await tester.pumpWidget(
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
          home: SettingsScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('María'), findsOneWidget);
    // El nivel se muestra por su nombre, no con el código de la API.
    expect(find.text('Intermedio'), findsOneWidget);
    expect(find.text('B1'), findsNothing);
    // Entradas fijas a la cuenta de IA y a la memoria del tutor.
    expect(find.byKey(const Key('settings_ai_account')), findsNothing);
    expect(find.byKey(const Key('settings_memory')), findsOneWidget);

    await tester.dragUntilVisible(
      find.byKey(const Key('settings_logout_button')),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.ensureVisible(find.byKey(const Key('settings_logout_button')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('settings_logout_button')));
    await tester.pumpAndSettle();

    expect(
      container.read(authControllerProvider).status,
      AuthStatus.unauthenticated,
    );
  });

  testWidgets(
    'si falla la carga del perfil muestra Reintentar y recupera al tocarlo',
    (tester) async {
      final api = _ThrowingSecondGetMeApi();
      final container = ProviderContainer(
        overrides: [
          tokenStoreProvider.overrideWithValue(
            InMemoryTokenStore()
              ..write(const AuthTokens(accessToken: 'a', refreshToken: 'r')),
          ),
          fluentApiProvider.overrideWith((ref) => api),
        ],
      );
      addTearDown(container.dispose);
      await container.read(authControllerProvider.notifier).bootstrap();

      await tester.pumpWidget(
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
            home: SettingsScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.commonLoadErrorTitle), findsOneWidget);

      await tester.tap(find.text(l10n.commonRetry));
      await tester.pumpAndSettle();

      expect(find.text(l10n.commonLoadErrorTitle), findsNothing);
      expect(find.text('María'), findsOneWidget);
    },
  );
}

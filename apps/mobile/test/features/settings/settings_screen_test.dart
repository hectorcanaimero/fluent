import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/settings/presentation/settings_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('muestra el perfil y cerrar sesión limpia el estado de auth', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final container = ProviderContainer(
      overrides: [
        tokenStoreProvider.overrideWithValue(
          InMemoryTokenStore()..write(const AuthTokens(accessToken: 'a', refreshToken: 'r')),
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

    await tester.dragUntilVisible(
      find.byKey(const Key('settings_logout_button')),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.tap(find.byKey(const Key('settings_logout_button')));
    await tester.pumpAndSettle();

    expect(container.read(authControllerProvider).status, AuthStatus.unauthenticated);
  });
}

import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/data/insforge_auth_client.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/auth/presentation/login_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

InsforgeAuthClient _clientReplyingWith(int status, Map<String, dynamic> body) {
  final dio = Dio(BaseOptions(baseUrl: 'https://insforge.local'));
  final adapter = DioAdapter(dio: dio);
  dio.httpClientAdapter = adapter;
  adapter.onPost(
    '/api/auth/sessions',
    (server) => server.reply(status, body),
    data: Matchers.any,
    queryParameters: {'client_type': 'mobile'},
  );
  return InsforgeAuthClient(dio: dio);
}

Future<void> _pumpLoginScreen(
  WidgetTester tester, {
  required InsforgeAuthClient insforgeAuthClient,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
        insforgeAuthClientProvider.overrideWithValue(insforgeAuthClient),
        fluentApiProvider.overrideWith(
          (ref) => FakeApi(artificialDelay: Duration.zero),
        ),
      ],
      child: const MaterialApp(
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: LoginScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _openFormAndSubmit(WidgetTester tester) async {
  await tester.tap(find.byKey(const Key('login_show_form_button')));
  await tester.pumpAndSettle();
  await tester.enterText(
    find.byKey(const Key('login_email_field')),
    'maria@example.com',
  );
  await tester.enterText(find.byKey(const Key('login_password_field')), 'secret123');
  await tester.ensureVisible(find.byKey(const Key('login_submit_button')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('login_submit_button')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('login ok autentica y carga /me', (tester) async {
    final client = _clientReplyingWith(200, {
      'accessToken': 'access-1',
      'refreshToken': 'refresh-1',
    });
    await _pumpLoginScreen(tester, insforgeAuthClient: client);

    await _openFormAndSubmit(tester);

    final container = ProviderScope.containerOf(
      tester.element(find.byType(LoginScreen)),
    );
    final authState = container.read(authControllerProvider);
    expect(authState.status, AuthStatus.authenticated);
    expect(authState.me?.profile.displayName, 'María');
  });

  testWidgets('contraseña incorrecta muestra error y no autentica', (tester) async {
    final client = _clientReplyingWith(401, {'error': 'invalid credentials'});
    await _pumpLoginScreen(tester, insforgeAuthClient: client);

    await _openFormAndSubmit(tester);

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.loginErrorInvalidCredentials), findsOneWidget);

    final container = ProviderScope.containerOf(
      tester.element(find.byType(LoginScreen)),
    );
    expect(
      container.read(authControllerProvider).status,
      isNot(AuthStatus.authenticated),
    );
  });

  testWidgets('MEJ-06: email inválido se marca sin ir al servidor y la contraseña se puede mostrar', (
    tester,
  ) async {
    // Si el validador deja pasar el email, este 401 haría visible otro error.
    final client = _clientReplyingWith(401, {'error': 'invalid credentials'});
    await _pumpLoginScreen(tester, insforgeAuthClient: client);
    await tester.tap(find.byKey(const Key('login_show_form_button')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('login_email_field')), 'maria@');
    await tester.enterText(find.byKey(const Key('login_password_field')), 'secret123');
    await tester.ensureVisible(find.byKey(const Key('login_submit_button')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('login_submit_button')));
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.loginEmailInvalid), findsOneWidget);

    final field = tester.widget<TextField>(
      find.descendant(
        of: find.byKey(const Key('login_password_field')),
        matching: find.byType(TextField),
      ),
    );
    expect(field.obscureText, isTrue);
    await tester.tap(find.byKey(const Key('login_toggle_password')));
    await tester.pump();
    final shown = tester.widget<TextField>(
      find.descendant(
        of: find.byKey(const Key('login_password_field')),
        matching: find.byType(TextField),
      ),
    );
    expect(shown.obscureText, isFalse);
  });
}

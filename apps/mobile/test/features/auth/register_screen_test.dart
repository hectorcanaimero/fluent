import 'package:dio/dio.dart';
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/data/insforge_auth_client.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/auth/presentation/register_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http_mock_adapter/http_mock_adapter.dart';

Future<void> _pumpRegisterScreen(
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
        home: RegisterScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

InsforgeAuthClient _successfulInsforgeClient() {
  final dio = Dio(BaseOptions(baseUrl: 'https://insforge.local'));
  final adapter = DioAdapter(dio: dio);
  dio.httpClientAdapter = adapter;
  adapter.onPost(
    '/api/auth/users',
    (server) => server.reply(200, {'id': 'user-1'}),
    data: Matchers.any,
    queryParameters: {'client_type': 'mobile'},
  );
  adapter.onPost(
    '/api/auth/sessions',
    (server) => server.reply(200, {
      'accessToken': 'access-1',
      'refreshToken': 'refresh-1',
    }),
    data: Matchers.any,
    queryParameters: {'client_type': 'mobile'},
  );
  return InsforgeAuthClient(dio: dio);
}

Future<void> _fillAccountForm(WidgetTester tester, {required String code}) async {
  await tester.enterText(find.byKey(const Key('register_name_field')), 'María');
  await tester.enterText(
    find.byKey(const Key('register_email_field')),
    'maria@example.com',
  );
  await tester.enterText(
    find.byKey(const Key('register_password_field')),
    'secret12345',
  );
  await tester.enterText(find.byKey(const Key('register_code_field')), code);
  await tester.ensureVisible(find.byKey(const Key('register_submit_button')));
  await tester.pumpAndSettle();
  await tester.tap(find.byKey(const Key('register_submit_button')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('código de invitación inválido mantiene la cuenta y pide reintentar', (
    tester,
  ) async {
    await _pumpRegisterScreen(tester, insforgeAuthClient: _successfulInsforgeClient());

    await _fillAccountForm(tester, code: 'INVALID');

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));

    // La cuenta ya se creó: la pantalla pasa a pedir el código de nuevo,
    // no muestra un error genérico ni se queda en el formulario inicial.
    expect(find.text(l10n.registerInvitationPendingTitle), findsOneWidget);
    expect(find.text(l10n.registerErrorInvitationInvalid), findsOneWidget);
    expect(find.byKey(const Key('register_retry_code_field')), findsOneWidget);
  });

  testWidgets('con código válido, termina el registro y autentica', (tester) async {
    await _pumpRegisterScreen(tester, insforgeAuthClient: _successfulInsforgeClient());

    await _fillAccountForm(tester, code: 'GOOD-CODE');

    final container = ProviderScope.containerOf(
      tester.element(find.byType(RegisterScreen)),
    );
    final authState = container.read(authControllerProvider);
    expect(authState.status, AuthStatus.authenticated);
    expect(authState.me?.group, isNotNull);
  });
}

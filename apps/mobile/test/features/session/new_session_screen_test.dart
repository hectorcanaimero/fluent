import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/session/presentation/new_session_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// MEJ-10: simula que ya hay una sesión abierta al tocar un tema.
class _SessionAlreadyActiveApi extends FakeApi {
  _SessionAlreadyActiveApi() : super(artificialDelay: Duration.zero);

  @override
  Future<CreateSessionResult> createSession({
    required String kind,
    String? topic,
    String? roleplayId,
    String? newsItemId,
    String? challengeFromUserId,
  }) {
    return Future.error(
      const ApiException(
        code: ApiErrorCode.sessionAlreadyActive,
        message: 'session already active',
        activeSessionId: 'existing-session-1',
      ),
    );
  }
}

class _ThrowingOnceApi extends FakeApi {
  _ThrowingOnceApi() : super(artificialDelay: Duration.zero);

  var _calls = 0;

  @override
  Future<SessionSuggestions> getSessionSuggestions() {
    _calls += 1;
    if (_calls == 1) return Future.error(Exception('boom'));
    return super.getSessionSuggestions();
  }
}

/// OpenRouter arranca sin conectar, para probar el resguardo de MAL-13.
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

void main() {
  testWidgets('si falla la carga muestra Reintentar y recupera al tocarlo', (
    tester,
  ) async {
    final api = _ThrowingOnceApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          micPrimerShownProvider.overrideWith((ref) => true),
        ],
        child: const MaterialApp(
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: NewSessionScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.commonLoadErrorTitle), findsOneWidget);

    await tester.tap(find.text(l10n.commonRetry));
    await tester.pumpAndSettle();

    expect(find.text(l10n.commonLoadErrorTitle), findsNothing);
    expect(
      find.byKey(const Key('session_new_surprise_me_button')),
      findsOneWidget,
    );
  });

  testWidgets(
    'MAL-13: sin proveedor activo, redirige a Proveedores aunque se llegue sin pasar por el gate de Home',
    (tester) async {
      final router = GoRouter(
        initialLocation: '/session/new',
        routes: [
          GoRoute(
            path: '/session/new',
            builder: (context, state) => const NewSessionScreen(),
          ),
          GoRoute(
            path: '/providers',
            builder: (context, state) => const Text('PROVIDERS_SCREEN'),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fluentApiProvider.overrideWith((ref) => _NoActiveProviderApi()),
            micPrimerShownProvider.overrideWith((ref) => true),
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

      expect(find.text('PROVIDERS_SCREEN'), findsOneWidget);
    },
  );

  testWidgets(
    'MEJ-10: SESSION_ALREADY_ACTIVE navega a la sesión existente en vez de mostrar un error',
    (tester) async {
      final router = GoRouter(
        initialLocation: '/session/new',
        routes: [
          GoRoute(
            path: '/session/new',
            builder: (context, state) => const NewSessionScreen(),
          ),
          GoRoute(
            path: '/session/:id',
            builder: (context, state) =>
                Text('SESSION_${state.pathParameters['id']}'),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fluentApiProvider.overrideWith((ref) => _SessionAlreadyActiveApi()),
            micPrimerShownProvider.overrideWith((ref) => true),
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

      await tester.tap(find.byKey(const Key('session_new_surprise_me_button')));
      await tester.pumpAndSettle();

      expect(find.text('SESSION_existing-session-1'), findsOneWidget);
    },
  );
}

import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/group/presentation/group_screen.dart';
import 'package:fluent_mobile/features/home/presentation/home_screen.dart';
import 'package:fluent_mobile/features/home/presentation/home_shell.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

class _CountingGetMeApi extends FakeApi {
  _CountingGetMeApi() : super(artificialDelay: Duration.zero);

  int getMeCalls = 0;

  @override
  Future<MeResponse> getMe() {
    getMeCalls++;
    return super.getMe();
  }
}

Future<void> _pumpHome(WidgetTester tester, FakeApi api) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [fluentApiProvider.overrideWith((ref) => api)],
      child: const MaterialApp(
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: HomeScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Igual que [_pumpHome], pero bajo un GoRouter (como en la app real, MAL-13):
/// necesario para probar el `context.push('/providers')` de los chips de
/// temas rápidos cuando no hay proveedor activo.
Future<GoRouter> _pumpHomeWithRouter(WidgetTester tester, FakeApi api) async {
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
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
  return router;
}

void main() {
  testWidgets(
    'estado normal: botón de practicar habilitado, hay grupo y hechos pendientes',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      await _pumpHome(tester, api);

      final practiceButton = tester.widget<ElevatedButton>(
        find.byKey(const Key('home_practice_button')),
      );
      expect(practiceButton.onPressed, isNotNull);
      expect(find.byKey(const Key('home_pending_facts_card')), findsOneWidget);
      expect(find.byKey(const Key('home_no_provider_banner')), findsNothing);
    },
  );

  testWidgets(
    'sin proveedor conectado: banner bloqueante y CTA deshabilitado',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      await api.disconnectProvider('openrouter');
      await _pumpHome(tester, api);

      expect(find.byKey(const Key('home_no_provider_banner')), findsOneWidget);
      final practiceButton = tester.widget<ElevatedButton>(
        find.byKey(const Key('home_practice_button')),
      );
      expect(practiceButton.onPressed, isNull);
    },
  );

  testWidgets(
    'MAL-27: sin `grace` en /progress (la API todavía no lo manda), no muestra nada',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      await _pumpHome(tester, api);

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.streakGraceAvailable), findsNothing);
      expect(find.text(l10n.streakGraceUsed), findsNothing);
    },
  );

  testWidgets('MAL-27: grace "available" muestra el aviso correspondiente', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero)..grace = 'available';
    await _pumpHome(tester, api);

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.streakGraceAvailable), findsOneWidget);
    expect(find.text(l10n.streakGraceUsed), findsNothing);
  });

  testWidgets('MAL-27: grace "used" muestra el aviso correspondiente', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero)..grace = 'used';
    await _pumpHome(tester, api);

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.streakGraceUsed), findsOneWidget);
    expect(find.text(l10n.streakGraceAvailable), findsNothing);
  });

  testWidgets('con boss pendiente, muestra el botón de Boss battle', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero)..bossPending = true;
    await _pumpHome(tester, api);

    expect(find.byKey(const Key('home_boss_button')), findsOneWidget);
    expect(find.byKey(const Key('home_practice_button')), findsNothing);
  });

  testWidgets('sin hechos pendientes, no muestra la tarjeta de memoria', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    await api.patchFact(factId: 'fact-1', status: 'confirmed');
    await api.patchFact(factId: 'fact-2', status: 'dismissed');
    await _pumpHome(tester, api);

    expect(find.byKey(const Key('home_pending_facts_card')), findsNothing);
  });

  testWidgets(
    'MAL-13: sin proveedor activo, un chip de tema rápido manda a Proveedores en vez de crear la sesión',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      await api.disconnectProvider('openrouter');
      await _pumpHomeWithRouter(tester, api);

      final suggestions = await api.getSessionSuggestions();
      final firstTopic = suggestions.topics.first;
      final sessionsBefore = (await api.getSessions()).items.length;

      await tester.drag(find.byType(ListView), const Offset(0, -600));
      await tester.pumpAndSettle();
      expect(find.text(firstTopic), findsOneWidget);
      await tester.tap(find.text(firstTopic));
      await tester.pumpAndSettle();

      expect(find.text('PROVIDERS_SCREEN'), findsOneWidget);
      final sessionsAfter = (await api.getSessions()).items.length;
      expect(sessionsAfter, sessionsBefore);
    },
  );

  testWidgets(
    'MAL-09: si falla la carga muestra Reintentar y recupera al tocarlo',
    (tester) async {
      final api = _ThrowingOnceGetProgressApi();
      await _pumpHome(tester, api);

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.commonLoadErrorTitle), findsOneWidget);

      await tester.tap(find.text(l10n.commonRetry));
      await tester.pumpAndSettle();

      expect(find.text(l10n.commonLoadErrorTitle), findsNothing);
      expect(find.byKey(const Key('home_practice_button')), findsOneWidget);
    },
  );

  testWidgets('MEJ-16: cambiar de pestaña y volver no vuelve a pedir /me', (
    tester,
  ) async {
    final api = _CountingGetMeApi();
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        ShellRoute(
          builder: (context, state, child) => HomeShell(child: child),
          routes: [
            GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
            GoRoute(
              path: '/group',
              builder: (context, state) => const GroupScreen(),
            ),
          ],
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
    expect(api.getMeCalls, 1);

    await tester.tap(find.byIcon(Icons.groups_outlined));
    await tester.pumpAndSettle();
    await tester.tap(find.byIcon(Icons.home_outlined));
    await tester.pumpAndSettle();

    expect(api.getMeCalls, 1);
  });
}

class _ThrowingOnceGetProgressApi extends FakeApi {
  _ThrowingOnceGetProgressApi() : super(artificialDelay: Duration.zero);

  var _calls = 0;

  @override
  Future<ProgressResult> getProgress() {
    _calls += 1;
    if (_calls == 1) return Future.error(Exception('boom'));
    return super.getProgress();
  }
}

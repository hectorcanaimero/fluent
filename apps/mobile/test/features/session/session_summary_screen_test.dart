import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/session/presentation/session_summary_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('muestra XP, streak, duración y el aviso de boss battle', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );
    const summary = SessionSummary(
      xpEarned: 85,
      streak: 13,
      isDoubleDay: true,
      correctionsCount: 1,
      durationSec: 9 * 60 + 40,
      nextIsBoss: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [fluentApiProvider.overrideWith((ref) => api)],
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text('+85'), findsOneWidget);
    expect(find.text('13'), findsOneWidget);
    expect(find.text('09:40'), findsOneWidget);
    expect(find.text(l10n.summaryNextIsBossBanner), findsOneWidget);
    expect(find.text(l10n.summaryDoubleDayBadge), findsOneWidget);
  });

  testWidgets('al abrirse limpia la sesión activa del estado (MAL-04)', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );
    const summary = SessionSummary(
      xpEarned: 10,
      streak: 1,
      isDoubleDay: false,
      correctionsCount: 0,
      durationSec: 60,
      nextIsBoss: false,
    );

    final container = ProviderContainer(
      overrides: [
        fluentApiProvider.overrideWith((ref) => api),
        tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
      ],
    );
    addTearDown(container.dispose);

    // Estado de partida: la app cree que esa sesión sigue activa, que es lo
    // que hace que `computeRedirect` empuje a `/session/:id`.
    final auth = container.read(authControllerProvider.notifier);
    auth.state = const AuthState(
      status: AuthStatus.authenticated,
      onboarded: true,
    ).copyWith(activeSessionId: created.session.id);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(container.read(authControllerProvider).activeSessionId, isNull);
  });

  testWidgets(
    'MEJ-20: sin `extra` (summary null) arma un resumen best-effort desde GET /sessions/:id',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      await api.endSession(sessionId: created.session.id, reason: 'user');

      await tester.pumpWidget(
        ProviderScope(
          overrides: [fluentApiProvider.overrideWith((ref) => api)],
          child: MaterialApp(
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SessionSummaryScreen(sessionId: created.session.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // `endSession` de FakeApi siempre paga 85 XP; sin `extra` no hay forma
      // de saber streak/isDoubleDay/nextIsBoss reales, así que no deben
      // aparecer los banners que dependerían de eso.
      expect(find.text('+85'), findsOneWidget);
      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.summaryNextIsBossBanner), findsNothing);
      expect(find.text(l10n.summaryDoubleDayBadge), findsNothing);
    },
  );

  testWidgets(
    'MAL-24: al terminar una sesión de cortesía, invita a conectar la cuenta',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      await api.disconnectProvider('openrouter');
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      expect(created.session.courtesy, isTrue);
      await api.endSession(sessionId: created.session.id, reason: 'user');

      final router = GoRouter(
        initialLocation: '/session/${created.session.id}/summary',
        routes: [
          GoRoute(
            path: '/session/:id/summary',
            builder: (context, state) =>
                SessionSummaryScreen(sessionId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/providers',
            builder: (context, state) => const Text('PROVIDERS_SCREEN'),
          ),
          GoRoute(path: '/', builder: (context, state) => const Text('HOME_SCREEN')),
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

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.summaryCourtesyBanner), findsOneWidget);

      await tester.tap(
        find.byKey(const Key('summary_connect_provider_button')),
      );
      await tester.pumpAndSettle();

      expect(find.text('PROVIDERS_SCREEN'), findsOneWidget);
    },
  );

  testWidgets(
    'una sesión normal (con proveedor) no muestra la invitación de cortesía',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      await api.endSession(sessionId: created.session.id, reason: 'user');

      await tester.pumpWidget(
        ProviderScope(
          overrides: [fluentApiProvider.overrideWith((ref) => api)],
          child: MaterialApp(
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SessionSummaryScreen(sessionId: created.session.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.summaryCourtesyBanner), findsNothing);
    },
  );
}

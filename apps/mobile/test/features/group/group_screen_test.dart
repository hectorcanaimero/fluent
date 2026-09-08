import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/share/share_service.dart';
import 'package:fluent_mobile/features/group/presentation/group_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

void main() {
  testWidgets('compartir invoca share_plus con el texto del resumen semanal', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final share = FakeShareService();

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          shareServiceProvider.overrideWith((ref) => share),
        ],
        child: const MaterialApp(
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: GroupScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final expectedSummary = await api.getWeeklySummary();

    await tester.dragUntilVisible(
      find.byKey(const Key('group_share_button')),
      find.byType(ListView),
      const Offset(0, -300),
      maxIteration: 30,
    );
    await tester.ensureVisible(find.byKey(const Key('group_share_button')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const Key('group_share_button')));
    await tester.pumpAndSettle();

    expect(share.shared, [expectedSummary!.text]);
  });

  testWidgets('muestra el leaderboard con medalla para el primer puesto', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
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
          home: GroupScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('leaderboard_row_0')), findsOneWidget);
    expect(find.byIcon(Icons.emoji_events), findsOneWidget);
  });

  testWidgets('aceptar un desafío crea una sesión con ese tema', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final router = GoRouter(
      initialLocation: '/group',
      routes: [
        GoRoute(path: '/group', builder: (context, state) => const GroupScreen()),
        GoRoute(
          path: '/session/:id',
          builder: (context, state) => const Text('CONVERSATION_SCREEN'),
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

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    await tester.tap(find.text(l10n.groupChallengeAccept).first);
    await tester.pumpAndSettle();

    final sessions = await api.getSessions();
    expect(sessions.items, isNotEmpty);
  });
}

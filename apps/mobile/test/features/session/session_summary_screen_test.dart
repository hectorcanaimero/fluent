import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/session/presentation/session_summary_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('muestra XP, streak, duración y el aviso de boss battle', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createSession(kind: 'free_topic', topic: 'Travel');
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
          home: SessionSummaryScreen(sessionId: created.session.id, summary: summary),
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
}

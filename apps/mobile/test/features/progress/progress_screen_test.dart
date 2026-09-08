import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/progress/presentation/progress_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('muestra XP, racha y tendencia de correcciones', (tester) async {
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
          home: ProgressScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final progress = await api.getProgress();
    expect(find.text('${progress.xp}'), findsOneWidget);
    expect(find.text(progress.level.name), findsOneWidget);
    expect(find.text(progress.correctionsTrend.first.category), findsOneWidget);
  });
}

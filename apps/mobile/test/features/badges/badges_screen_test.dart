import 'package:fluent_mobile/app/theme.dart';
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/badges/domain/badge_labels.dart';
import 'package:fluent_mobile/features/badges/presentation/badges_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _pumpBadges(WidgetTester tester) async {
  // Alto de sobra para que la lista construya todas las insignias.
  tester.view.physicalSize = const Size(390, 2600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        fluentApiProvider.overrideWith(
          (ref) => FakeApi(artificialDelay: Duration.zero),
        ),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: const BadgesScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('muestra las ganadas en color y las bloqueadas en gris', (
    tester,
  ) async {
    await _pumpBadges(tester);
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    final badges = await FakeApi(artificialDelay: Duration.zero).getBadges();
    final earned = badges.where((b) => b.earnedAt != null).length;

    expect(find.text(l10n.badgesEarnedCount(earned, badges.length)), findsOne);
    expect(
      find.byKey(const Key('badge_locked_filter')),
      findsNWidgets(badges.length - earned),
    );
    // Secciones por categoría.
    expect(find.text(l10n.badgesCategoryLevel), findsOneWidget);
    expect(find.text(l10n.badgesCategorySpecial), findsOneWidget);
    // Una bloqueada con meta muestra su avance.
    expect(find.text(l10n.badgesProgress(21, 30)), findsOneWidget);
    // Sin red, las imágenes caen al círculo neutro sin romper nada.
    expect(tester.takeException(), isNull);
  });

  testWidgets('tocar una insignia abre su detalle', (tester) async {
    await _pumpBadges(tester);
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));

    await tester.tap(find.byKey(const Key('badge_tile_streak_30')));
    await tester.pumpAndSettle();

    final sheet = find.byKey(const Key('badge_detail_sheet'));
    expect(sheet, findsOneWidget);
    expect(
      find.descendant(
        of: sheet,
        matching: find.text(badgeCondition(l10n, 'streak_30')),
      ),
      findsOneWidget,
    );
  });
}

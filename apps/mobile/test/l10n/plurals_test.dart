import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('los contadores usan singular con 1 (es)', () async {
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(l10n.homeStreakDays(1), '1 día de racha');
    expect(l10n.homeStreakDays(3), '3 días de racha');
    expect(l10n.homePendingFactsCard(1), startsWith('Tengo 1 cosa nueva'));
    expect(l10n.streakDangerBody(1), startsWith('Tu racha de 1 día vence'));
  });

  test('los contadores usan singular con 1 (pt)', () async {
    final l10n = await AppLocalizations.delegate.load(const Locale('pt'));
    expect(l10n.homeStreakDays(1), '1 dia de sequência');
    expect(l10n.groupStreak(1), '1 dia de sequência em grupo');
  });
}

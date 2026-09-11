import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/errors/l10n_for_api_error.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  late AppLocalizations l10n;

  setUpAll(() async {
    l10n = await AppLocalizations.delegate.load(const Locale('es'));
  });

  test('mapea cada ApiErrorCode a una clave distinta de errorGeneric', () {
    for (final code in ApiErrorCode.values) {
      if (code == ApiErrorCode.unknown) continue;
      final text = l10nForApiError(code, l10n);
      expect(text, isNotEmpty, reason: 'código $code');
      expect(
        text,
        isNot(l10n.errorGeneric),
        reason: '$code no debería caer en el mensaje genérico',
      );
    }
  });

  test('unknown cae en errorGeneric', () {
    expect(l10nForApiError(ApiErrorCode.unknown, l10n), l10n.errorGeneric);
  });

  test('MAL-23: turnsDailyCap tiene su propio texto', () {
    expect(
      l10nForApiError(ApiErrorCode.turnsDailyCap, l10n),
      l10n.errorTurnsDailyCap,
    );
  });

  test('P0 MAL-19: challengeNotAvailable tiene su propio texto', () {
    expect(
      l10nForApiError(ApiErrorCode.challengeNotAvailable, l10n),
      l10n.errorChallengeNotAvailable,
    );
  });
}

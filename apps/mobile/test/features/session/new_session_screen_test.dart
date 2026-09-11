import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/session/presentation/new_session_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

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

void main() {
  testWidgets('si falla la carga muestra Reintentar y recupera al tocarlo', (tester) async {
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
    expect(find.byKey(const Key('session_new_surprise_me_button')), findsOneWidget);
  });
}

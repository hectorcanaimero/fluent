import 'package:fluent_mobile/core/widgets/async_body.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    home: child,
  );
}

void main() {
  testWidgets('mientras carga muestra un spinner', (tester) async {
    await tester.pumpWidget(
      _wrap(
        AsyncBody<int>(
          snapshot: const AsyncSnapshot<int>.waiting(),
          builder: (data) => Text('$data'),
          onRetry: () {},
        ),
      ),
    );
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('con datos pinta el builder', (tester) async {
    await tester.pumpWidget(
      _wrap(
        AsyncBody<int>(
          snapshot: const AsyncSnapshot<int>.withData(ConnectionState.done, 7),
          builder: (data) => Text('valor: $data'),
          onRetry: () {},
        ),
      ),
    );
    expect(find.text('valor: 7'), findsOneWidget);
  });

  testWidgets('con error muestra el mensaje y Reintentar llama a onRetry', (
    tester,
  ) async {
    var retried = false;
    await tester.pumpWidget(
      _wrap(
        AsyncBody<int>(
          snapshot: AsyncSnapshot<int>.withError(
            ConnectionState.done,
            Exception('boom'),
          ),
          builder: (data) => Text('$data'),
          onRetry: () => retried = true,
        ),
      ),
    );
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.commonLoadErrorTitle), findsOneWidget);

    await tester.tap(find.text(l10n.commonRetry));
    expect(retried, isTrue);
  });
}

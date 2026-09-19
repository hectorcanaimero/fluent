import 'package:fluent_mobile/app/theme.dart';
import 'package:fluent_mobile/features/auth/presentation/social_login_buttons.dart';
import 'package:fluent_mobile/features/welcome/presentation/welcome_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> _pumpWelcome(
  WidgetTester tester, {
  bool disableAnimations = false,
  Locale locale = const Locale('es'),
  Size size = const Size(390, 844),
  double textScale = 1,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        locale: locale,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: disableAnimations,
            textScaler: TextScaler.linear(textScale),
          ),
          child: child!,
        ),
        home: const WelcomeScreen(),
      ),
    ),
  );
}

double _opacityOf(WidgetTester tester, Finder finder) {
  final fade = tester.widget<FadeTransition>(
    find.ancestor(of: finder, matching: find.byType(FadeTransition)).first,
  );
  return fade.opacity.value;
}

void main() {
  testWidgets('arranca desde el splash y termina con la primera slide y el '
      'lugar para el login social', (tester) async {
    await _pumpWelcome(tester);

    // Primer frame: el contenido todavía no entró (continúa el splash).
    expect(_opacityOf(tester, find.text('Un tutor que se acuerda de vos')), 0);

    await tester.pumpAndSettle();

    expect(_opacityOf(tester, find.text('Un tutor que se acuerda de vos')), 1);
    expect(find.byType(SocialLoginButtons), findsOneWidget);
    expect(find.textContaining('I went', findRichText: true), findsOneWidget);
    // Sin email/contraseña: solo login social.
    expect(find.byType(TextFormField), findsNothing);
  });

  testWidgets('con animaciones desactivadas todo aparece ya en su estado '
      'final', (tester) async {
    await _pumpWelcome(tester, disableAnimations: true);
    await tester.pump();

    expect(_opacityOf(tester, find.text('Un tutor que se acuerda de vos')), 1);
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('se puede deslizar entre las slides y saltar con los puntos', (
    tester,
  ) async {
    await _pumpWelcome(tester);
    await tester.pumpAndSettle();

    await tester.drag(
      find.byKey(const Key('welcome_pages')),
      const Offset(-300, 0),
    );
    await tester.pumpAndSettle();
    expect(find.text('Practicá con tus amigos'), findsOneWidget);
    expect(find.text('Vos'), findsOneWidget);

    await tester.tap(find.byKey(const Key('welcome_dot_2')));
    await tester.pumpAndSettle();
    expect(find.text('10 minutos, dos veces al día'), findsOneWidget);
    expect(find.text('12 días'), findsOneWidget);
    expect(find.bySemanticsLabel('Página 3 de 3'), findsOneWidget);
  });

  testWidgets('en portugués usa el copy localizado', (tester) async {
    await _pumpWelcome(tester, locale: const Locale('pt'));
    await tester.pumpAndSettle();

    expect(find.text('Um tutor que lembra de você'), findsOneWidget);
  });

  testWidgets('en una pantalla chica con texto del sistema al 200 % no '
      'desborda', (tester) async {
    await _pumpWelcome(tester, size: const Size(320, 568), textScale: 2);
    await tester.pumpAndSettle();
    for (final dot in [1, 2]) {
      await tester.tap(find.byKey(Key('welcome_dot_$dot')));
      await tester.pumpAndSettle();
    }
    // Un overflow de layout haría fallar el test con una excepción.
    expect(tester.takeException(), isNull);
  });
}

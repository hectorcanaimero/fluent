import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/widgets/skeleton.dart';
import 'package:fluent_mobile/features/progress/presentation/progress_screen.dart';
import 'package:fluent_mobile/features/session/domain/correction_labels.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _ThrowingOnceApi extends FakeApi {
  _ThrowingOnceApi() : super(artificialDelay: Duration.zero);

  var _calls = 0;

  @override
  Future<ProgressResult> getProgress() {
    _calls += 1;
    if (_calls == 1) return Future.error(Exception('boom'));
    return super.getProgress();
  }
}

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
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text('${progress.xp}'), findsOneWidget);
    expect(find.text(progress.level.name), findsOneWidget);
    expect(
      find.text(
        correctionCategoryLabel(l10n, progress.correctionsTrend.first.category),
      ),
      findsOneWidget,
    );
  });

  testWidgets('si falla la carga muestra Reintentar y recupera al tocarlo', (
    tester,
  ) async {
    final api = _ThrowingOnceApi();
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

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.commonLoadErrorTitle), findsOneWidget);

    await tester.tap(find.text(l10n.commonRetry));
    await tester.pumpAndSettle();

    expect(find.text(l10n.commonLoadErrorTitle), findsNothing);
    final progress = await api.getProgress();
    expect(find.text('${progress.xp}'), findsOneWidget);
  });

  Future<void> pumpProgress(
    WidgetTester tester, {
    required FakeApi api,
    Locale locale = const Locale('es'),
    double textScale = 1,
  }) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [fluentApiProvider.overrideWith((ref) => api)],
        child: MaterialApp(
          locale: locale,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: TextScaler.linear(textScale)),
            child: child!,
          ),
          home: const ProgressScreen(),
        ),
      ),
    );
  }

  for (final locale in const [Locale('es'), Locale('pt')]) {
    for (final scale in const [1.0, 2.0]) {
      testWidgets('las 4 estadísticas no desbordan a 390 dp '
          '(${locale.languageCode}, texto x$scale)', (tester) async {
        await pumpProgress(
          tester,
          api: FakeApi(artificialDelay: Duration.zero),
          locale: locale,
          textScale: scale,
        );
        await tester.pumpAndSettle();
        final l10n = await AppLocalizations.delegate.load(locale);
        expect(find.text(l10n.progressSessionsThisWeekLabel), findsOneWidget);
        // Un overflow de layout haría fallar el test con una excepción.
        expect(tester.takeException(), isNull);
      });
    }
  }

  testWidgets('el skeleton reserva las 4 estadísticas', (tester) async {
    await pumpProgress(
      tester,
      api: FakeApi(artificialDelay: const Duration(seconds: 1)),
    );
    await tester.pump();
    expect(
      find.byWidgetPredicate((w) => w is SkeletonBox && w.height == 76),
      findsNWidgets(4),
    );
    await tester.pumpAndSettle();
  });
}

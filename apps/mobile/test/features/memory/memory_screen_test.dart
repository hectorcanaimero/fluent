import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/memory/presentation/memory_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _ThrowingOnceApi extends FakeApi {
  _ThrowingOnceApi() : super(artificialDelay: Duration.zero);

  var _calls = 0;

  @override
  Future<MemoryResult> getMemory() {
    _calls += 1;
    if (_calls == 1) return Future.error(Exception('boom'));
    return super.getMemory();
  }
}

Future<void> _pumpMemory(WidgetTester tester, FakeApi api) async {
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
        home: MemoryScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('confirmar un hecho pendiente lo mueve a "Lo que recuerdo"', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    await _pumpMemory(tester, api);

    // fact-1 empieza pendiente.
    expect(find.byKey(const Key('pending_fact_fact-1')), findsOneWidget);

    await tester.tap(find.byKey(const Key('pending_fact_confirm_fact-1')));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('pending_fact_fact-1')), findsNothing);
    expect(find.byKey(const Key('confirmed_fact_fact-1')), findsOneWidget);

    // Y quedó confirmado del lado de la API real.
    final memory = await api.getMemory();
    expect(memory.facts.confirmed.map((f) => f.id), contains('fact-1'));
    expect(memory.facts.pending.map((f) => f.id), isNot(contains('fact-1')));
  });

  testWidgets(
    'descartar un hecho pendiente lo saca de la lista sin confirmarlo',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      await _pumpMemory(tester, api);

      await tester.tap(find.byKey(const Key('pending_fact_dismiss_fact-2')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('pending_fact_fact-2')), findsNothing);
      final memory = await api.getMemory();
      expect(
        memory.facts.confirmed
            .map((f) => f.id)
            .followedBy(memory.facts.pending.map((f) => f.id)),
        isNot(contains('fact-2')),
      );
    },
  );

  testWidgets('olvidar todo requiere dos confirmaciones', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    await _pumpMemory(tester, api);
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));

    await tester.dragUntilVisible(
      find.byKey(const Key('memory_forget_all_button')),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.tap(find.byKey(const Key('memory_forget_all_button')));
    await tester.pumpAndSettle();

    expect(find.text(l10n.memoryForgetAllConfirmTitle1), findsOneWidget);
    await tester.tap(find.text(l10n.memoryForgetAllConfirm));
    await tester.pumpAndSettle();

    // Todavía no se borró nada: falta la segunda confirmación.
    var memory = await api.getMemory();
    expect(memory.facts.confirmed, isNotEmpty);

    expect(find.text(l10n.memoryForgetAllConfirmTitle2), findsOneWidget);
    await tester.tap(find.text(l10n.memoryForgetAllConfirm));
    await tester.pumpAndSettle();

    memory = await api.getMemory();
    expect(memory.facts.confirmed, isEmpty);
    expect(memory.facts.pending, isEmpty);
  });

  testWidgets('cancelar la primera confirmación no borra nada', (tester) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    await _pumpMemory(tester, api);
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));

    await tester.dragUntilVisible(
      find.byKey(const Key('memory_forget_all_button')),
      find.byType(ListView),
      const Offset(0, -300),
    );
    await tester.tap(find.byKey(const Key('memory_forget_all_button')));
    await tester.pumpAndSettle();
    await tester.tap(find.text(l10n.memoryForgetAllCancel));
    await tester.pumpAndSettle();

    expect(find.text(l10n.memoryForgetAllConfirmTitle2), findsNothing);
    final memory = await api.getMemory();
    expect(memory.facts.confirmed, isNotEmpty);
  });

  testWidgets('si falla la carga muestra Reintentar y recupera al tocarlo', (
    tester,
  ) async {
    final api = _ThrowingOnceApi();
    await _pumpMemory(tester, api);

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.commonLoadErrorTitle), findsOneWidget);

    await tester.tap(find.text(l10n.commonRetry));
    await tester.pumpAndSettle();

    expect(find.text(l10n.commonLoadErrorTitle), findsNothing);
    expect(find.byKey(const Key('pending_fact_fact-1')), findsOneWidget);
  });
}

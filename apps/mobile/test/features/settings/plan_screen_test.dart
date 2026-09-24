import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/billing/billing_service.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/settings/presentation/plan_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

class _FakeBilling implements BillingService {
  _FakeBilling(this.api);
  final FakeApi api;
  bool bought = false;

  @override
  Future<void> logIn(String userId) async {}

  @override
  Future<String?> proPrice() async => 'US\$ 4,99';

  @override
  Future<void> buyPro() async {
    bought = true;
    api.setPlan('pro', expiresAt: DateTime.now().add(const Duration(days: 30)));
  }

  @override
  Future<void> restore() async {}
}

Future<void> _pump(
  WidgetTester tester,
  FakeApi api, {
  BillingService? billing,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        fluentApiProvider.overrideWith((ref) => api),
        billingServiceProvider.overrideWith((ref) => billing),
      ],
      child: const MaterialApp(
        locale: Locale('es'),
        localizationsDelegates: [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
        home: PlanScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  const button = Key('plan_upgrade_button');

  testWidgets('Free muestra el botón y abre «Disponible pronto»', (t) async {
    await _pump(t, FakeApi(artificialDelay: Duration.zero));
    expect(find.text('Plan Free'), findsOneWidget);
    await t.tap(find.byKey(button));
    await t.pumpAndSettle();
    expect(find.text('Disponible pronto'), findsOneWidget);
  });

  testWidgets('Pro vigente no muestra el botón', (t) async {
    final api = FakeApi(artificialDelay: Duration.zero)
      ..setPlan('pro', expiresAt: DateTime.now().add(const Duration(days: 30)));
    await _pump(t, api);
    expect(find.text('Plan Pro'), findsOneWidget);
    expect(find.byKey(button), findsNothing);
  });

  testWidgets('Pro vencido se trata como Free', (t) async {
    final api = FakeApi(artificialDelay: Duration.zero)
      ..setPlan(
        'pro',
        expiresAt: DateTime.now().subtract(const Duration(days: 1)),
      );
    await _pump(t, api);
    expect(find.text('Plan Free'), findsOneWidget);
    expect(find.byKey(button), findsOneWidget);
  });

  testWidgets('con billing: muestra el precio y compra Pro', (t) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final billing = _FakeBilling(api);
    await _pump(t, api, billing: billing);
    expect(find.text('Pasar a Pro · US\$ 4,99'), findsOneWidget);
    expect(find.text('Restaurar compras'), findsOneWidget);
    await t.tap(find.byKey(button));
    await t.pumpAndSettle();
    expect(billing.bought, isTrue);
    expect(find.text('Plan Pro'), findsOneWidget);
    expect(find.byKey(button), findsNothing);
  });
}

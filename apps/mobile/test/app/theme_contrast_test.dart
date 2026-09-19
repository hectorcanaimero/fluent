import 'package:fluent_mobile/app/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

double _contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  final (hi, lo) = la > lb ? (la, lb) : (lb, la);
  return (hi + 0.05) / (lo + 0.05);
}

void main() {
  test('los colores de texto nuevos llegan a AA (4.5:1)', () {
    expect(_contrast(AppColors.errorText, AppColors.bg), greaterThan(4.5));
    expect(_contrast(AppColors.errorText, AppColors.surface), greaterThan(4.5));
    expect(_contrast(Colors.white, AppColors.destructive), greaterThan(4.5));
    expect(_contrast(Colors.white, AppColors.accentText), greaterThan(4.5));
  });

  test('TextButton y la barra de navegación usan colores AA', () {
    final theme = AppTheme.light();
    final textFg = theme.textButtonTheme.style!.foregroundColor!.resolve({});
    expect(_contrast(textFg!, AppColors.bg), greaterThan(4.5));

    final nav = theme.navigationBarTheme.labelTextStyle!;
    for (final states in [
      <WidgetState>{},
      {WidgetState.selected},
    ]) {
      final style = nav.resolve(states)!;
      expect(_contrast(style.color!, AppColors.surface), greaterThan(4.5));
      expect(style.fontSize, greaterThanOrEqualTo(12));
    }
  });

  testWidgets('un ElevatedButton en las acciones de un diálogo no ocupa todo '
      'el ancho', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Builder(
          builder: (context) => AlertDialog(
            title: const Text('¿Borrar?'),
            actions: [
              TextButton(onPressed: () {}, child: const Text('No')),
              ElevatedButton(
                key: const Key('confirm'),
                onPressed: () {},
                child: const Text('Sí'),
              ),
            ],
          ),
        ),
      ),
    );
    final dialogWidth = tester.getSize(find.byType(AlertDialog)).width;
    expect(
      tester.getSize(find.byKey(const Key('confirm'))).width,
      lessThan(dialogWidth / 2),
    );
  });

  test('un ElevatedButton deshabilitado conserva un fondo visible para el '
      'spinner blanco', () {
    final style = AppTheme.light().elevatedButtonTheme.style!;
    final disabled = {WidgetState.disabled};
    expect(style.backgroundColor!.resolve(disabled)!.a, greaterThan(0.3));
    expect(style.foregroundColor!.resolve(disabled), Colors.white);
  });
}

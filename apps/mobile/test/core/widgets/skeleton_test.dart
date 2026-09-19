import 'package:fluent_mobile/core/widgets/skeleton.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('con reducir animaciones el skeleton queda quieto', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MediaQuery(
        data: MediaQueryData(disableAnimations: true),
        child: Directionality(
          textDirection: TextDirection.ltr,
          child: SkeletonBox(width: 40, height: 16),
        ),
      ),
    );
    // Si siguiera latiendo en bucle, pumpAndSettle no terminaría nunca.
    await tester.pumpAndSettle();
    expect(tester.widget<Opacity>(find.byType(Opacity)).opacity, 1);
  });
}

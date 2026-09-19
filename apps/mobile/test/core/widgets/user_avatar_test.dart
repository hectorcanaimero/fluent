import 'package:fluent_mobile/core/widgets/user_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget _wrap(Widget child) =>
    Directionality(textDirection: TextDirection.ltr, child: child);

void main() {
  testWidgets('sin foto muestra la inicial', (tester) async {
    await tester.pumpWidget(_wrap(const UserAvatar(name: 'maría')));
    expect(find.text('M'), findsOneWidget);
    expect(find.byType(Image), findsNothing);
  });

  testWidgets('si la foto no carga vuelve a la inicial', (tester) async {
    // En los tests toda petición de red falla, igual que una URL rota.
    await tester.pumpWidget(
      _wrap(
        const UserAvatar(
          name: 'Héctor',
          imageUrl: 'https://lh3.googleusercontent.com/a/rota',
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('H'), findsOneWidget);
  });
}

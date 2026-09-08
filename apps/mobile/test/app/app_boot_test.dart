import 'package:fluent_mobile/app/app.dart';
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/presentation/login_screen.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('sin token guardado, la app arranca en /login', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
          fluentApiProvider.overrideWith(
            (ref) => FakeApi(artificialDelay: Duration.zero),
          ),
        ],
        child: const FluentApp(),
      ),
    );

    await tester.pumpAndSettle();

    expect(find.byType(LoginScreen), findsOneWidget);
  });
}

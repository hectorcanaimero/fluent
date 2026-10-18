import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/entry/new_interview_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

Widget _wrap(FakeApi api) {
  return ProviderScope(
    overrides: [fluentApiProvider.overrideWith((ref) => api)],
    child: const MaterialApp(
      localizationsDelegates: [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: NewInterviewScreen(),
    ),
  );
}

const _offerField = Key('interview_entry_offer_field');
const _submitButton = Key('interview_entry_submit_button');

void main() {
  // `Clipboard.getData` no tiene mock por defecto en los widget tests:
  // sin esto, "Pegar" tira `MissingPluginException` en vez de devolver un
  // portapapeles vacío como pasaría en el dispositivo real.
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized()
        .defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'Clipboard.getData') return {'text': ''};
          return null;
        });
  });

  testWidgets(
    'FR-22: el borrador pegado se restaura al volver a la pantalla',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'interview_offer_draft': 'Senior Backend Engineer at Acme Corp',
      });
      await tester.pumpWidget(_wrap(FakeApi(artificialDelay: Duration.zero)));
      await tester.pumpAndSettle();

      expect(
        find.text('Senior Backend Engineer at Acme Corp'),
        findsOneWidget,
      );
    },
  );

  testWidgets(
    'IE-01d: con el tope diario alcanzado el CTA queda deshabilitado',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        'interview_offer_draft': 'Senior Backend Engineer',
      });
      final api = FakeApi(artificialDelay: Duration.zero)
        ..interviewsDailyLimit = 1;
      await api.createInterview(type: 'technical', offerText: 'primera oferta');

      await tester.pumpWidget(_wrap(api));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.interviewQuotaExhausted(1)), findsOneWidget);

      final button = tester.widget<ElevatedButton>(find.byKey(_submitButton));
      expect(button.onPressed, isNull);
    },
  );

  testWidgets(
    'IE-02: una URL de LinkedIn no legible muestra el panel sin tono de error',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(_wrap(FakeApi(artificialDelay: Duration.zero)));
      await tester.pumpAndSettle();

      await tester.enterText(
        find.byKey(_offerField),
        'https://www.linkedin.com/jobs/view/123',
      );
      await tester.pump();
      await tester.tap(find.byKey(_submitButton));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.interviewOfferUnreadableTitle), findsOneWidget);
      expect(
        find.byKey(const Key('interview_entry_unreadable_paste_button')),
        findsOneWidget,
      );
      expect(
        find.byKey(const Key('interview_entry_unreadable_linkedin_button')),
        findsOneWidget,
      );

      // "Pegar el texto de la oferta" vuelve al formulario en vez de dejar
      // a la persona encerrada en el panel.
      await tester.tap(
        find.byKey(const Key('interview_entry_unreadable_paste_button')),
      );
      await tester.pumpAndSettle();
      expect(find.byKey(_offerField), findsOneWidget);
    },
  );

  testWidgets('al crear la entrevista navega a /interviews/:id', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = FakeApi(artificialDelay: Duration.zero);
    final router = GoRouter(
      initialLocation: '/interviews/new',
      routes: [
        GoRoute(
          path: '/interviews/new',
          builder: (context, state) => const NewInterviewScreen(),
        ),
        GoRoute(
          path: '/interviews/:id',
          builder: (context, state) =>
              Text('INTERVIEW_${state.pathParameters['id']}'),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [fluentApiProvider.overrideWith((ref) => api)],
        child: MaterialApp.router(
          routerConfig: router,
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
        ),
      ),
    );
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(_offerField),
      'Senior Backend Engineer at Acme',
    );
    await tester.pump();
    await tester.tap(find.byKey(_submitButton));
    await tester.pumpAndSettle();

    expect(find.text('INTERVIEW_interview-1'), findsOneWidget);
  });
}

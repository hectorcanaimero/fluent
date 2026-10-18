import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/entry/new_interview_screen.dart';
import 'package:fluent_mobile/features/interviews/presentation/entry/starter_templates.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Registra cuántas veces se llamó a `createInterview`, sin crear nada de
/// verdad: tocar una tarjeta no debe terminar acá.
class _RecordingApi extends FakeApi {
  _RecordingApi() : super(artificialDelay: Duration.zero);

  int createCalls = 0;
  String? lastOfferText;

  @override
  Future<InterviewDetail> createInterview({
    required String type,
    String? offerText,
    String? offerUrl,
  }) {
    createCalls++;
    lastOfferText = offerText;
    return super.createInterview(type: type, offerText: offerText, offerUrl: offerUrl);
  }
}

const _offerField = Key('interview_entry_offer_field');
const _submitButton = Key('interview_entry_submit_button');
const _backendCard = Key('interview_entry_starter_card_backend');

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

void main() {
  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized().defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'Clipboard.getData') return {'text': ''};
          return null;
        });
  });

  testWidgets(
    'F14.1.T1: las tarjetas aparecen con el campo vacío y desaparecen al escribir',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      await tester.pumpWidget(_wrap(_RecordingApi()));
      await tester.pumpAndSettle();

      expect(find.byKey(_backendCard), findsOneWidget);

      await tester.enterText(find.byKey(_offerField), 'Backend en Acme');
      await tester.pump();

      expect(find.byKey(_backendCard), findsNothing);
    },
  );

  testWidgets(
    'F14.1.T1: tocar una tarjeta rellena el campo con su offerText sin crear la entrevista',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final api = _RecordingApi();
      await tester.pumpWidget(_wrap(api));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(_backendCard));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      final expectedText = starterTemplates
          .firstWhere((t) => t.id == 'backend')
          .offerText(l10n);

      final field = tester.widget<TextField>(find.byKey(_offerField));
      expect(field.controller!.text, expectedText);
      expect(api.createCalls, 0);
    },
  );

  testWidgets(
    'F14.1.T1: "Preparar entrevista" después de tocar una tarjeta manda su texto como offerText',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final api = _RecordingApi();
      await tester.pumpWidget(_wrap(api));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(_backendCard));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(_submitButton));
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      final expectedText = starterTemplates
          .firstWhere((t) => t.id == 'backend')
          .offerText(l10n);

      expect(api.createCalls, 1);
      expect(api.lastOfferText, expectedText);
    },
  );

  testWidgets(
    'F14.1.T1: con el tope diario agotado las tarjetas no responden al toque',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      final api = _RecordingApi()..interviewsDailyLimit = 1;
      await api.createInterview(type: 'technical', offerText: 'primera oferta');
      api.createCalls = 0;

      await tester.pumpWidget(_wrap(api));
      await tester.pumpAndSettle();

      final card = tester.widget<InkWell>(find.byKey(_backendCard));
      expect(card.onTap, isNull);

      await tester.tap(find.byKey(_backendCard));
      await tester.pumpAndSettle();

      final field = tester.widget<TextField>(find.byKey(_offerField));
      expect(field.controller!.text, isEmpty);
      expect(api.createCalls, 0);
    },
  );
}

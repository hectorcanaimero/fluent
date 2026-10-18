import 'dart:async';

import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/entry/new_interview_screen.dart';
import 'package:fluent_mobile/features/interviews/presentation/entry/offer_draft_prefs.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_platform_interface.dart';
import 'package:shared_preferences_platform_interface/types.dart';

/// Registra lo que se manda a `POST /interviews` y, si [unreadableUrls],
/// responde `OFFER_UNREADABLE` a cualquier URL (no solo LinkedIn).
class _RecordingApi extends FakeApi {
  _RecordingApi({this.unreadableUrls = false})
    : super(artificialDelay: Duration.zero);

  final bool unreadableUrls;
  String? lastOfferText;
  String? lastOfferUrl;

  @override
  Future<InterviewDetail> createInterview({
    required String type,
    String? offerText,
    String? offerUrl,
  }) {
    lastOfferText = offerText;
    lastOfferUrl = offerUrl;
    if (unreadableUrls && offerUrl != null) {
      throw const ApiException(
        code: ApiErrorCode.offerUnreadable,
        message: 'unreadable',
        statusCode: 422,
      );
    }
    return super.createInterview(
      type: type,
      offerText: offerText,
      offerUrl: offerUrl,
    );
  }
}

/// Store que no devuelve nada hasta que se abre [gate]: simula un disco
/// lento para que la persona escriba antes de que llegue el borrador.
class _SlowStore extends InMemorySharedPreferencesStore {
  _SlowStore(super.data) : super.withData();

  final gate = Completer<void>();

  @override
  Future<Map<String, Object>> getAllWithParameters(
    GetAllParameters parameters,
  ) async {
    await gate.future;
    return super.getAllWithParameters(parameters);
  }
}

String? _clipboard;

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
    _clipboard = null;
    TestWidgetsFlutterBinding.ensureInitialized().defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'Clipboard.getData') {
            return {'text': _clipboard ?? ''};
          }
          return null;
        });
  });

  testWidgets('FR-22: el borrador pegado se restaura al volver a la pantalla', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({
      offerDraftKey(null): 'Senior Backend Engineer at Acme Corp',
    });
    await tester.pumpWidget(_wrap(FakeApi(artificialDelay: Duration.zero)));
    await tester.pumpAndSettle();

    expect(find.text('Senior Backend Engineer at Acme Corp'), findsOneWidget);
  });

  testWidgets(
    'IE-01d: con el tope diario alcanzado el CTA queda deshabilitado',
    (tester) async {
      SharedPreferences.setMockInitialValues({
        offerDraftKey(null): 'Senior Backend Engineer',
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

  testWidgets('el borrador que llega tarde no pisa lo que ya se escribió', (
    tester,
  ) async {
    final store = _SlowStore({
      'flutter.${offerDraftKey(null)}': 'borrador viejo',
    });
    SharedPreferences.resetStatic();
    SharedPreferencesStorePlatform.instance = store;
    await tester.pumpWidget(_wrap(FakeApi(artificialDelay: Duration.zero)));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(_offerField), 'texto nuevo');
    store.gate.complete();
    await tester.pumpAndSettle();

    expect(find.text('texto nuevo'), findsOneWidget);
    expect(find.text('borrador viejo'), findsNothing);
  });

  test('looksLikeOfferUrl: solo un token http(s) con host es URL', () {
    expect(looksLikeOfferUrl('https://acme.com/jobs/1'), isTrue);
    expect(looksLikeOfferUrl('  https://acme.com/jobs/1\n'), isTrue);
    expect(
      looksLikeOfferUrl('https://acme.com/jobs/1\nSenior Backend Engineer'),
      isFalse,
    );
    expect(looksLikeOfferUrl('Senior Backend Engineer'), isFalse);
    expect(looksLikeOfferUrl('ftp://acme.com/x'), isFalse);
  });

  testWidgets('una oferta que empieza con un enlace se manda como texto', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    final api = _RecordingApi();
    await tester.pumpWidget(_wrap(api));
    await tester.pumpAndSettle();

    const offer = 'https://acme.com/jobs/1\nSenior Backend Engineer at Acme';
    await tester.enterText(find.byKey(_offerField), offer);
    await tester.pump();
    await tester.tap(find.byKey(_submitButton));
    await tester.pumpAndSettle();

    expect(api.lastOfferText, offer);
    expect(api.lastOfferUrl, isNull);
  });

  testWidgets('IE-02: "Abrir en LinkedIn" no aparece para otros dominios', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(_wrap(_RecordingApi(unreadableUrls: true)));
    await tester.pumpAndSettle();

    await tester.enterText(find.byKey(_offerField), 'https://acme.com/jobs/1');
    await tester.pump();
    await tester.tap(find.byKey(_submitButton));
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.interviewOfferUnreadableTitle), findsOneWidget);
    expect(
      find.byKey(const Key('interview_entry_unreadable_linkedin_button')),
      findsNothing,
    );
  });

  testWidgets('IE-02: si LinkedIn no se puede abrir, avisa con un snackbar', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('plugins.flutter.io/url_launcher'),
      (call) async {
        if (call.method == 'canLaunch') return true;
        throw PlatformException(code: 'ACTIVITY_NOT_FOUND');
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        const MethodChannel('plugins.flutter.io/url_launcher'),
        null,
      ),
    );
    await tester.pumpWidget(_wrap(FakeApi(artificialDelay: Duration.zero)));
    await tester.pumpAndSettle();

    await tester.enterText(
      find.byKey(_offerField),
      'https://www.linkedin.com/jobs/view/123',
    );
    await tester.pump();
    await tester.tap(find.byKey(_submitButton));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const Key('interview_entry_unreadable_linkedin_button')),
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.interviewOpenLinkError), findsOneWidget);
  });

  testWidgets(
    'IE-02: pegar la misma URL rechazada limpia el campo y pide el texto',
    (tester) async {
      SharedPreferences.setMockInitialValues({});
      const url = 'https://www.linkedin.com/jobs/view/123';
      _clipboard = url;
      await tester.pumpWidget(_wrap(FakeApi(artificialDelay: Duration.zero)));
      await tester.pumpAndSettle();

      await tester.enterText(find.byKey(_offerField), url);
      await tester.pump();
      await tester.tap(find.byKey(_submitButton));
      await tester.pumpAndSettle();
      await tester.tap(
        find.byKey(const Key('interview_entry_unreadable_paste_button')),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      final field = tester.widget<TextField>(find.byKey(_offerField));
      expect(field.controller!.text, isEmpty);
      expect(field.focusNode!.hasFocus, isTrue);
      expect(find.text(l10n.interviewOfferCopyTextHint), findsOneWidget);
    },
  );

  testWidgets('FR-22: el borrador es por cuenta y se borra al cerrar sesión', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    await saveOfferDraft('user-a', 'oferta de A');
    expect(await loadOfferDraft('user-b'), isNull);
    expect(await loadOfferDraft('user-a'), 'oferta de A');

    await saveOfferDraft(null, 'oferta sin id');
    await clearOfferDrafts();
    expect(await loadOfferDraft('user-a'), isNull);
    expect(await loadOfferDraft(null), isNull);
  });
}

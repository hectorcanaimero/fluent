import 'dart:async';

import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/session/presentation/new_session_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// MEJ-10: simula que ya hay una sesión abierta al tocar un tema.
class _SessionAlreadyActiveApi extends FakeApi {
  _SessionAlreadyActiveApi() : super(artificialDelay: Duration.zero);

  @override
  Future<CreateSessionResult> createSession({
    required String kind,
    String? topic,
    String? roleplayId,
    String? newsItemId,
    String? challengeFromUserId,
  }) {
    return Future.error(
      const ApiException(
        code: ApiErrorCode.sessionAlreadyActive,
        message: 'session already active',
        activeSessionId: 'existing-session-1',
      ),
    );
  }
}

class _ThrowingOnceApi extends FakeApi {
  _ThrowingOnceApi() : super(artificialDelay: Duration.zero);

  var _calls = 0;

  @override
  Future<SessionSuggestions> getSessionSuggestions() {
    _calls += 1;
    if (_calls == 1) return Future.error(Exception('boom'));
    return super.getSessionSuggestions();
  }
}

/// Una noticia con fuente de nombre largo, como las que llegan del RSS.
class _LongNewsSourceApi extends FakeApi {
  _LongNewsSourceApi() : super(artificialDelay: Duration.zero);

  @override
  Future<SessionSuggestions> getSessionSuggestions() async {
    final base = await super.getSessionSuggestions();
    return base.copyWith(
      news: const [
        NewsItem(
          id: 'long-source',
          title: 'Cities expand bike lanes',
          source: 'The International Journal of Very Long Newspaper Names',
          time: 'hace 2 h',
        ),
      ],
    );
  }
}

/// `createSession` queda pendiente hasta que el test lo libera.
class _SlowStartApi extends FakeApi {
  _SlowStartApi() : super(artificialDelay: Duration.zero);

  final pending = Completer<CreateSessionResult>();

  @override
  Future<CreateSessionResult> createSession({
    required String kind,
    String? topic,
    String? roleplayId,
    String? newsItemId,
    String? challengeFromUserId,
  }) => pending.future;
}

void main() {
  testWidgets('al empezar una sesión muestra que está arrancando', (
    tester,
  ) async {
    final api = _SlowStartApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          micPrimerShownProvider.overrideWith((ref) => true),
        ],
        child: const MaterialApp(
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: NewSessionScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    const indicator = Key('session_new_starting_indicator');
    expect(find.byKey(indicator), findsNothing);

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    await tester.tap(find.byKey(const Key('session_new_surprise_me_button')));
    await tester.pump();
    expect(find.byKey(indicator), findsOneWidget);
    expect(find.text(l10n.sessionNewTitle), findsOneWidget);
  });

  testWidgets('una fuente larga en la tarjeta de noticia no desborda', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(360 * 3, 740 * 3);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => _LongNewsSourceApi()),
          micPrimerShownProvider.overrideWith((ref) => true),
        ],
        child: const MaterialApp(
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: NewSessionScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    await tester.tap(find.text(l10n.sessionNewTabNews));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('news_long-source')), findsOneWidget);
    expect(find.text('hace 2 h'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('el botón del tema libre se habilita al escribir', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith(
            (ref) => FakeApi(artificialDelay: Duration.zero),
          ),
          micPrimerShownProvider.overrideWith((ref) => true),
        ],
        child: const MaterialApp(
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: NewSessionScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    ElevatedButton submit() => tester.widget<ElevatedButton>(
      find.byKey(const Key('session_new_free_topic_submit')),
    );
    final field = find.byKey(const Key('session_new_free_topic_field'));
    await tester.ensureVisible(field);
    expect(submit().onPressed, isNull);

    await tester.enterText(field, '  My new job  ');
    await tester.pump();
    expect(submit().onPressed, isNotNull);

    await tester.enterText(field, '   ');
    await tester.pump();
    expect(submit().onPressed, isNull);
  });

  testWidgets('si falla la carga muestra Reintentar y recupera al tocarlo', (
    tester,
  ) async {
    final api = _ThrowingOnceApi();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          micPrimerShownProvider.overrideWith((ref) => true),
        ],
        child: const MaterialApp(
          localizationsDelegates: [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: NewSessionScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text(l10n.commonLoadErrorTitle), findsOneWidget);

    await tester.tap(find.text(l10n.commonRetry));
    await tester.pumpAndSettle();

    expect(find.text(l10n.commonLoadErrorTitle), findsNothing);
    expect(
      find.byKey(const Key('session_new_surprise_me_button')),
      findsOneWidget,
    );
  });

  testWidgets(
    'MEJ-10: SESSION_ALREADY_ACTIVE navega a la sesión existente en vez de mostrar un error',
    (tester) async {
      final router = GoRouter(
        initialLocation: '/session/new',
        routes: [
          GoRoute(
            path: '/session/new',
            builder: (context, state) => const NewSessionScreen(),
          ),
          GoRoute(
            path: '/session/:id',
            builder: (context, state) =>
                Text('SESSION_${state.pathParameters['id']}'),
          ),
        ],
      );
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            fluentApiProvider.overrideWith((ref) => _SessionAlreadyActiveApi()),
            micPrimerShownProvider.overrideWith((ref) => true),
          ],
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

      await tester.tap(find.byKey(const Key('session_new_surprise_me_button')));
      await tester.pumpAndSettle();

      expect(find.text('SESSION_existing-session-1'), findsOneWidget);
    },
  );
}

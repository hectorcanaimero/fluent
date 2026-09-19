import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/fluent_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/badges/domain/badge_labels.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/session/presentation/session_summary_screen.dart';
import 'package:fluent_mobile/features/settings/data/reminder_service.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Falla la primera carga del detalle (p. ej. sin red al reabrir la app).
class _DetailFailsOnceApi extends FakeApi {
  _DetailFailsOnceApi() : super(artificialDelay: Duration.zero);

  var _calls = 0;

  @override
  Future<SessionDetailResult> getSession(String sessionId) {
    _calls += 1;
    if (_calls == 1) return Future.error(Exception('offline'));
    return super.getSession(sessionId);
  }
}

/// `GET /sessions/:id` tarda: para ver el estado de carga del resumen.
class _SlowDetailApi extends FakeApi {
  _SlowDetailApi() : super(artificialDelay: Duration.zero);

  @override
  Future<SessionDetailResult> getSession(String sessionId) async {
    await Future<void>.delayed(const Duration(seconds: 1));
    return super.getSession(sessionId);
  }
}

void main() {
  testWidgets(
    'sin extra, si falla la carga ofrece reintentar en vez de girar para siempre',
    (tester) async {
      final api = _DetailFailsOnceApi();
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      await api.endSession(sessionId: created.session.id, reason: 'user');

      await tester.pumpWidget(
        ProviderScope(
          overrides: [fluentApiProvider.overrideWith((ref) => api)],
          child: MaterialApp(
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SessionSummaryScreen(sessionId: created.session.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.commonLoadErrorTitle), findsOneWidget);

      await tester.tap(find.text(l10n.commonRetry));
      await tester.pumpAndSettle();

      expect(find.text(l10n.commonLoadErrorTitle), findsNothing);
      expect(find.text('+85'), findsOneWidget);
    },
  );

  testWidgets('muestra XP, streak, duración y el aviso de boss battle', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );
    const summary = SessionSummary(
      xpEarned: 85,
      streak: 13,
      isDoubleDay: true,
      correctionsCount: 1,
      durationSec: 9 * 60 + 40,
      nextIsBoss: true,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [fluentApiProvider.overrideWith((ref) => api)],
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    expect(find.text('+85'), findsOneWidget);
    expect(find.text('13'), findsOneWidget);
    expect(find.text('09:40'), findsOneWidget);
    expect(find.text(l10n.summaryNextIsBossBanner), findsOneWidget);
    expect(find.text(l10n.summaryDoubleDayBadge), findsOneWidget);
  });

  testWidgets('al abrirse limpia la sesión activa del estado (MAL-04)', (
    tester,
  ) async {
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );
    const summary = SessionSummary(
      xpEarned: 10,
      streak: 1,
      isDoubleDay: false,
      correctionsCount: 0,
      durationSec: 60,
      nextIsBoss: false,
    );

    final container = ProviderContainer(
      overrides: [
        fluentApiProvider.overrideWith((ref) => api),
        tokenStoreProvider.overrideWithValue(InMemoryTokenStore()),
      ],
    );
    addTearDown(container.dispose);

    // Estado de partida: la app cree que esa sesión sigue activa, que es lo
    // que hace que `computeRedirect` empuje a `/session/:id`.
    final auth = container.read(authControllerProvider.notifier);
    auth.state = const AuthState(
      status: AuthStatus.authenticated,
      onboarded: true,
    ).copyWith(activeSessionId: created.session.id);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(container.read(authControllerProvider).activeSessionId, isNull);
  });

  testWidgets(
    'MEJ-20: sin `extra` (summary null) arma un resumen best-effort desde GET /sessions/:id',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      await api.endSession(sessionId: created.session.id, reason: 'user');

      await tester.pumpWidget(
        ProviderScope(
          overrides: [fluentApiProvider.overrideWith((ref) => api)],
          child: MaterialApp(
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SessionSummaryScreen(sessionId: created.session.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // `endSession` de FakeApi siempre paga 85 XP; sin `extra` no hay forma
      // de saber streak/isDoubleDay/nextIsBoss reales, así que no deben
      // aparecer los banners que dependerían de eso.
      expect(find.text('+85'), findsOneWidget);
      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.summaryNextIsBossBanner), findsNothing);
      expect(find.text(l10n.summaryDoubleDayBadge), findsNothing);
    },
  );

  testWidgets(
    'MAL-24: al terminar una sesión de cortesía, invita a conectar la cuenta',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      await api.disconnectProvider('openrouter');
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      expect(created.session.courtesy, isTrue);
      await api.endSession(sessionId: created.session.id, reason: 'user');

      final router = GoRouter(
        initialLocation: '/session/${created.session.id}/summary',
        routes: [
          GoRoute(
            path: '/session/:id/summary',
            builder: (context, state) =>
                SessionSummaryScreen(sessionId: state.pathParameters['id']!),
          ),
          GoRoute(
            path: '/providers',
            builder: (context, state) => const Text('PROVIDERS_SCREEN'),
          ),
          GoRoute(
            path: '/',
            builder: (context, state) => const Text('HOME_SCREEN'),
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

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.summaryCourtesyBanner), findsOneWidget);

      await tester.tap(
        find.byKey(const Key('summary_connect_provider_button')),
      );
      await tester.pumpAndSettle();

      expect(find.text('PROVIDERS_SCREEN'), findsOneWidget);
    },
  );

  testWidgets(
    'una sesión normal (con proveedor) no muestra la invitación de cortesía',
    (tester) async {
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      await api.endSession(sessionId: created.session.id, reason: 'user');

      await tester.pumpWidget(
        ProviderScope(
          overrides: [fluentApiProvider.overrideWith((ref) => api)],
          child: MaterialApp(
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: AppLocalizations.supportedLocales,
            home: SessionSummaryScreen(sessionId: created.session.id),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.summaryCourtesyBanner), findsNothing);
    },
  );

  group('MEJ-38: opt-in de recordatorio tras la primera sesión válida', () {
    Widget wrap(
      Widget child, {
      required FluentApi api,
      required FakeReminderService reminder,
    }) {
      return ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          reminderServiceProvider.overrideWith((ref) => reminder),
        ],
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: child,
        ),
      );
    }

    testWidgets('primera sesión válida muestra el diálogo opt-in', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final reminder = FakeReminderService();
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      const summary = SessionSummary(
        xpEarned: 10,
        streak: 1,
        correctionsCount: 0,
        durationSec: 60,
      );
      await tester.pumpWidget(
        wrap(
          SessionSummaryScreen(sessionId: created.session.id, summary: summary),
          api: api,
          reminder: reminder,
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.firstSessionReminderDialogTitle), findsOneWidget);
    });

    testWidgets('aceptar programa el recordatorio y no vuelve a preguntar', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final reminder = FakeReminderService();
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      const summary = SessionSummary(
        xpEarned: 10,
        streak: 1,
        correctionsCount: 0,
        durationSec: 60,
      );
      final now = TimeOfDay.now();
      await tester.pumpWidget(
        wrap(
          SessionSummaryScreen(sessionId: created.session.id, summary: summary),
          api: api,
          reminder: reminder,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(
        find.byKey(const Key('first_session_reminder_accept_button')),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(reminder.lastOptInHour?.hour, now.hour);
      expect(reminder.lastOptInHour?.minute, now.minute);
      expect(reminder.lastOptInTitle, l10n.settingsReminderNotificationTitle);
      expect(reminder.lastOptInBody, l10n.settingsReminderNotificationBody);

      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('first_session_reminder_asked'), isTrue);
    });

    testWidgets('rechazar no programa nada pero persiste que ya se preguntó', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({});
      final reminder = FakeReminderService();
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      const summary = SessionSummary(
        xpEarned: 10,
        streak: 1,
        correctionsCount: 0,
        durationSec: 60,
      );
      await tester.pumpWidget(
        wrap(
          SessionSummaryScreen(sessionId: created.session.id, summary: summary),
          api: api,
          reminder: reminder,
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(
        find.byKey(const Key('first_session_reminder_decline_button')),
      );
      await tester.pumpAndSettle();

      expect(reminder.lastOptInHour, isNull);
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('first_session_reminder_asked'), isTrue);
    });

    testWidgets('si ya se preguntó antes, no vuelve a mostrar el diálogo', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        'first_session_reminder_asked': true,
      });
      final reminder = FakeReminderService();
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      const summary = SessionSummary(
        xpEarned: 10,
        streak: 1,
        correctionsCount: 0,
        durationSec: 60,
      );
      await tester.pumpWidget(
        wrap(
          SessionSummaryScreen(sessionId: created.session.id, summary: summary),
          api: api,
          reminder: reminder,
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(find.text(l10n.firstSessionReminderDialogTitle), findsNothing);
    });
  });

  group('MEJ-39: notificación de racha en riesgo', () {
    Widget wrap(
      Widget child, {
      required FakeReminderService reminder,
      required FluentApi api,
    }) {
      return ProviderScope(
        overrides: [
          fluentApiProvider.overrideWith((ref) => api),
          reminderServiceProvider.overrideWith((ref) => reminder),
        ],
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: child,
        ),
      );
    }

    testWidgets('al cerrar una sesión válida programa el aviso de mañana', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        'first_session_reminder_asked': true,
      });
      final reminder = FakeReminderService();
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      const summary = SessionSummary(
        xpEarned: 30,
        streak: 12,
        correctionsCount: 0,
        durationSec: 200,
      );
      await tester.pumpWidget(
        wrap(
          SessionSummaryScreen(sessionId: created.session.id, summary: summary),
          reminder: reminder,
          api: api,
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      final tomorrow = DateTime.now().add(const Duration(days: 1));
      expect(reminder.lastStreakDangerFireAt?.year, tomorrow.year);
      expect(reminder.lastStreakDangerFireAt?.month, tomorrow.month);
      expect(reminder.lastStreakDangerFireAt?.day, tomorrow.day);
      expect(reminder.lastStreakDangerFireAt?.hour, 20);
      expect(reminder.lastStreakDangerFireAt?.minute, 30);
      expect(reminder.lastStreakDangerBody, l10n.streakDangerBody(12));
      expect(reminder.streakDangerCancelled, isFalse);
    });

    testWidgets('con día de gracia disponible usa el texto de gracia', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        'first_session_reminder_asked': true,
      });
      final reminder = FakeReminderService();
      final api = FakeApi(artificialDelay: Duration.zero, grace: 'available');
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      const summary = SessionSummary(
        xpEarned: 30,
        streak: 12,
        correctionsCount: 0,
        durationSec: 200,
      );
      await tester.pumpWidget(
        wrap(
          SessionSummaryScreen(sessionId: created.session.id, summary: summary),
          reminder: reminder,
          api: api,
        ),
      );
      await tester.pumpAndSettle();

      final l10n = await AppLocalizations.delegate.load(const Locale('es'));
      expect(reminder.lastStreakDangerBody, l10n.streakDangerGraceBody);
    });

    testWidgets('con la alerta de racha apagada no programa nada', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        'first_session_reminder_asked': true,
        'streak_alert_enabled': false,
      });
      final reminder = FakeReminderService();
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      const summary = SessionSummary(
        xpEarned: 30,
        streak: 12,
        correctionsCount: 0,
        durationSec: 200,
      );
      await tester.pumpWidget(
        wrap(
          SessionSummaryScreen(sessionId: created.session.id, summary: summary),
          reminder: reminder,
          api: api,
        ),
      );
      await tester.pumpAndSettle();

      expect(reminder.lastStreakDangerFireAt, isNull);
    });

    testWidgets('una sesión demasiado corta no programa el aviso', (
      tester,
    ) async {
      SharedPreferences.setMockInitialValues({
        'first_session_reminder_asked': true,
      });
      final reminder = FakeReminderService();
      final api = FakeApi(artificialDelay: Duration.zero);
      final created = await api.createSession(
        kind: 'free_topic',
        topic: 'Travel',
      );
      const summary = SessionSummary(
        xpEarned: 0,
        streak: 0,
        correctionsCount: 0,
        durationSec: 20,
      );
      await tester.pumpWidget(
        wrap(
          SessionSummaryScreen(sessionId: created.session.id, summary: summary),
          reminder: reminder,
          api: api,
        ),
      );
      await tester.pumpAndSettle();

      expect(reminder.lastStreakDangerFireAt, isNull);
    });
  });

  testWidgets('sin extra, mientras recupera la sesión muestra un skeleton', (
    tester,
  ) async {
    final api = _SlowDetailApi();
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );
    await api.endSession(sessionId: created.session.id, reason: 'user');
    await tester.pumpWidget(
      ProviderScope(
        overrides: [fluentApiProvider.overrideWith((ref) => api)],
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          home: SessionSummaryScreen(sessionId: created.session.id),
        ),
      ),
    );
    await tester.pump();

    expect(find.byKey(const Key('summary_skeleton')), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsNothing);
    await tester.pumpAndSettle();
  });

  Future<List<String>> pumpSummaryCountingHaptics(
    WidgetTester tester,
    SessionSummary summary, {
    bool disableAnimations = false,
  }) async {
    final haptics = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'HapticFeedback.vibrate') {
          haptics.add('${call.arguments}');
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    final api = FakeApi(artificialDelay: Duration.zero);
    final created = await api.createSession(
      kind: 'free_topic',
      topic: 'Travel',
    );
    await tester.pumpWidget(
      ProviderScope(
        overrides: [fluentApiProvider.overrideWith((ref) => api)],
        child: MaterialApp(
          localizationsDelegates: const [
            AppLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
            GlobalCupertinoLocalizations.delegate,
          ],
          supportedLocales: AppLocalizations.supportedLocales,
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(disableAnimations: disableAnimations),
            child: child!,
          ),
          home: SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
        ),
      ),
    );
    return haptics;
  }

  testWidgets('la vibración llega con el XP, no al abrir la pantalla', (
    tester,
  ) async {
    final haptics = await pumpSummaryCountingHaptics(
      tester,
      const SessionSummary(
        xpEarned: 85,
        streak: 13,
        correctionsCount: 2,
        durationSec: 600,
      ),
    );
    await tester.pump(const Duration(milliseconds: 200));
    expect(haptics, isEmpty);
    // El XP todavía está contando.
    expect(find.text('+85'), findsNothing);

    await tester.pumpAndSettle();
    expect(haptics, hasLength(1));
    expect(find.text('+85'), findsOneWidget);
    expect(find.text('13'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
  });

  testWidgets('una sesión demasiado corta no se celebra ni vibra', (
    tester,
  ) async {
    final haptics = await pumpSummaryCountingHaptics(
      tester,
      const SessionSummary(
        xpEarned: 0,
        streak: 0,
        correctionsCount: 0,
        durationSec: 40,
      ),
    );
    await tester.pump();
    // Todo en su estado final desde el primer cuadro.
    expect(find.text('+0'), findsOneWidget);
    await tester.pumpAndSettle();
    expect(haptics, isEmpty);
  });

  testWidgets('con "reducir movimiento" el resumen aparece ya en su estado '
      'final', (tester) async {
    await pumpSummaryCountingHaptics(
      tester,
      const SessionSummary(
        xpEarned: 85,
        streak: 13,
        correctionsCount: 2,
        durationSec: 600,
      ),
      disableAnimations: true,
    );
    await tester.pump();
    expect(find.text('+85'), findsOneWidget);
    expect(find.text('13'), findsOneWidget);
    await tester.pumpAndSettle();
  });

  testWidgets('las insignias nuevas se celebran al final del resumen', (
    tester,
  ) async {
    final haptics = await pumpSummaryCountingHaptics(
      tester,
      const SessionSummary(
        xpEarned: 85,
        streak: 3,
        correctionsCount: 0,
        durationSec: 600,
        newBadges: ['no_corrections', 'streak_3'],
      ),
    );
    await tester.pumpAndSettle();
    final l10n = await AppLocalizations.delegate.load(const Locale('es'));
    final badges = find.byKey(const Key('summary_new_badges'));
    expect(badges, findsOneWidget);
    expect(
      find.descendant(of: badges, matching: find.text(l10n.badgesNewUnlocked)),
      findsOneWidget,
    );
    for (final id in ['no_corrections', 'streak_3']) {
      expect(
        find.descendant(of: badges, matching: find.text(badgeName(l10n, id))),
        findsOneWidget,
      );
    }
    // Una sola vibración aunque haya insignias.
    expect(haptics, hasLength(1));
  });

  testWidgets('sin insignias nuevas no hay sección de insignias', (
    tester,
  ) async {
    await pumpSummaryCountingHaptics(
      tester,
      const SessionSummary(
        xpEarned: 85,
        streak: 3,
        correctionsCount: 0,
        durationSec: 600,
      ),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('summary_new_badges')), findsNothing);
  });

  testWidgets('con "reducir movimiento" las insignias nuevas se ven desde el '
      'primer cuadro', (tester) async {
    await pumpSummaryCountingHaptics(
      tester,
      const SessionSummary(
        xpEarned: 85,
        streak: 3,
        correctionsCount: 0,
        durationSec: 600,
        newBadges: ['no_corrections'],
      ),
      disableAnimations: true,
    );
    await tester.pump();
    final scale = tester.widget<ScaleTransition>(
      find.descendant(
        of: find.byKey(const Key('summary_new_badges')),
        matching: find.byType(ScaleTransition),
      ),
    );
    expect(scale.scale.value, 1);
    await tester.pumpAndSettle();
  });
}

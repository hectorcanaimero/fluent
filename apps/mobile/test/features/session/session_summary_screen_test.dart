import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/fluent_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/core/storage/token_store.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:fluent_mobile/features/session/presentation/session_summary_screen.dart';
import 'package:fluent_mobile/features/settings/data/reminder_service.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
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
          GoRoute(path: '/', builder: (context, state) => const Text('HOME_SCREEN')),
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
          SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
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
          SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
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
          SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
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
          SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
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
          SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
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
          SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
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
          SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
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
          SessionSummaryScreen(
            sessionId: created.session.id,
            summary: summary,
          ),
          reminder: reminder,
          api: api,
        ),
      );
      await tester.pumpAndSettle();

      expect(reminder.lastStreakDangerFireAt, isNull);
    });
  });
}

import 'package:flutter/material.dart' show TimeOfDay;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

/// Recordatorios locales sin backend (SPEC-06 §8): dos notificaciones
/// diarias configurables, sin sincronizar con la API.
///
/// MAL-10: `title`/`body` los resuelve quien llama (`AppLocalizations` no
/// está disponible acá, un `ReminderService` no tiene `BuildContext`), así
/// que viajan como parámetro en vez de vivir hardcodeados en español.
abstract class ReminderService {
  Future<void> scheduleDaily({
    required TimeOfDay morning,
    required TimeOfDay evening,
    required String title,
    required String body,
  });

  /// MAL-10: al cerrar la 2ª sesión válida del día, los recordatorios de
  /// HOY ya no tienen sentido — pero mañana sí deben sonar de nuevo. Cancela
  /// las notificaciones ya programadas y reprograma forzando la próxima
  /// ocurrencia a partir de mañana (`scheduleDaily` podría reprogramar para
  /// hoy mismo si la hora todavía no pasó).
  Future<void> skipToday({
    required TimeOfDay morning,
    required TimeOfDay evening,
    required String title,
    required String body,
  });

  Future<void> cancelAll();

  /// MEJ-38: recordatorio diario recurrente a una hora arbitraria (la de la
  /// primera sesión válida), con id propio para no pisar los dos horarios
  /// configurables en Ajustes (`scheduleDaily`/`skipToday` de arriba).
  Future<void> scheduleAtHour({
    required TimeOfDay time,
    required String title,
    required String body,
  });

  /// MEJ-39: notificación puntual de "racha en riesgo". No es recurrente
  /// (`matchDateTimeComponents`) porque el streak y la gracia cambian cada
  /// día — se reprograma con contenido nuevo cada vez que se cierra una
  /// sesión válida.
  Future<void> scheduleStreakDanger({
    required DateTime fireAt,
    required String title,
    required String body,
  });

  Future<void> cancelStreakDanger();
}

class FlutterLocalNotificationsReminderService implements ReminderService {
  FlutterLocalNotificationsReminderService() {
    tz_data.initializeTimeZones();
  }

  static const _morningId = 1001;
  static const _eveningId = 1002;
  static const _firstSessionOptInId = 1003;
  static const _streakDangerId = 1004;

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _initialized = false;

  Future<void> _ensureInitialized() async {
    if (_initialized) return;
    await _plugin.initialize(
      const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
    _initialized = true;
  }

  tz.TZDateTime _nextInstanceOf(TimeOfDay time, {bool skipToday = false}) {
    final now = tz.TZDateTime.now(tz.local);
    var scheduled = tz.TZDateTime(
      tz.local,
      now.year,
      now.month,
      now.day,
      time.hour,
      time.minute,
    );
    if (scheduled.isBefore(now) || skipToday) {
      scheduled = scheduled.add(const Duration(days: 1));
    }
    return scheduled;
  }

  Future<void> _scheduleBoth({
    required TimeOfDay morning,
    required TimeOfDay evening,
    required String title,
    required String body,
    required bool skipToday,
  }) async {
    await _ensureInitialized();
    const details = NotificationDetails(
      android: AndroidNotificationDetails('fluent_reminders', 'Recordatorios de práctica'),
      iOS: DarwinNotificationDetails(),
    );
    await _plugin.zonedSchedule(
      _morningId,
      title,
      body,
      _nextInstanceOf(morning, skipToday: skipToday),
      details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.wallClockTime,
    );
    await _plugin.zonedSchedule(
      _eveningId,
      title,
      body,
      _nextInstanceOf(evening, skipToday: skipToday),
      details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.wallClockTime,
    );
  }

  @override
  Future<void> scheduleDaily({
    required TimeOfDay morning,
    required TimeOfDay evening,
    required String title,
    required String body,
  }) => _scheduleBoth(
    morning: morning,
    evening: evening,
    title: title,
    body: body,
    skipToday: false,
  );

  @override
  Future<void> skipToday({
    required TimeOfDay morning,
    required TimeOfDay evening,
    required String title,
    required String body,
  }) async {
    await _ensureInitialized();
    await _plugin.cancel(_morningId);
    await _plugin.cancel(_eveningId);
    await _scheduleBoth(
      morning: morning,
      evening: evening,
      title: title,
      body: body,
      skipToday: true,
    );
  }

  @override
  Future<void> cancelAll() async {
    await _ensureInitialized();
    await _plugin.cancel(_morningId);
    await _plugin.cancel(_eveningId);
  }

  @override
  Future<void> scheduleAtHour({
    required TimeOfDay time,
    required String title,
    required String body,
  }) async {
    await _ensureInitialized();
    await _plugin.zonedSchedule(
      _firstSessionOptInId,
      title,
      body,
      _nextInstanceOf(time),
      const NotificationDetails(
        android: AndroidNotificationDetails('fluent_reminders', 'Recordatorios de práctica'),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.wallClockTime,
    );
  }

  @override
  Future<void> scheduleStreakDanger({
    required DateTime fireAt,
    required String title,
    required String body,
  }) async {
    await _ensureInitialized();
    await _plugin.zonedSchedule(
      _streakDangerId,
      title,
      body,
      tz.TZDateTime.from(fireAt, tz.local),
      const NotificationDetails(
        android: AndroidNotificationDetails('fluent_reminders', 'Recordatorios de práctica'),
        iOS: DarwinNotificationDetails(),
      ),
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.wallClockTime,
    );
  }

  @override
  Future<void> cancelStreakDanger() async {
    await _ensureInitialized();
    await _plugin.cancel(_streakDangerId);
  }
}

class FakeReminderService implements ReminderService {
  TimeOfDay? lastMorning;
  TimeOfDay? lastEvening;
  String? lastTitle;
  String? lastBody;
  bool cancelled = false;
  bool skippedToday = false;

  @override
  Future<void> scheduleDaily({
    required TimeOfDay morning,
    required TimeOfDay evening,
    required String title,
    required String body,
  }) async {
    lastMorning = morning;
    lastEvening = evening;
    lastTitle = title;
    lastBody = body;
    cancelled = false;
    skippedToday = false;
  }

  @override
  Future<void> skipToday({
    required TimeOfDay morning,
    required TimeOfDay evening,
    required String title,
    required String body,
  }) async {
    lastMorning = morning;
    lastEvening = evening;
    lastTitle = title;
    lastBody = body;
    skippedToday = true;
  }

  @override
  Future<void> cancelAll() async {
    cancelled = true;
  }

  TimeOfDay? lastOptInHour;
  String? lastOptInTitle;
  String? lastOptInBody;

  @override
  Future<void> scheduleAtHour({
    required TimeOfDay time,
    required String title,
    required String body,
  }) async {
    lastOptInHour = time;
    lastOptInTitle = title;
    lastOptInBody = body;
  }

  DateTime? lastStreakDangerFireAt;
  String? lastStreakDangerTitle;
  String? lastStreakDangerBody;
  bool streakDangerCancelled = false;

  @override
  Future<void> scheduleStreakDanger({
    required DateTime fireAt,
    required String title,
    required String body,
  }) async {
    lastStreakDangerFireAt = fireAt;
    lastStreakDangerTitle = title;
    lastStreakDangerBody = body;
    streakDangerCancelled = false;
  }

  @override
  Future<void> cancelStreakDanger() async {
    streakDangerCancelled = true;
  }
}

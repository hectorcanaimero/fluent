import 'package:flutter/material.dart' show TimeOfDay;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:timezone/data/latest.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

/// Recordatorios locales sin backend (SPEC-06 §8): dos notificaciones
/// diarias configurables, sin sincronizar con la API.
abstract class ReminderService {
  Future<void> scheduleDaily({required TimeOfDay morning, required TimeOfDay evening});
  Future<void> cancelAll();
}

class FlutterLocalNotificationsReminderService implements ReminderService {
  FlutterLocalNotificationsReminderService() {
    tz_data.initializeTimeZones();
  }

  static const _morningId = 1001;
  static const _eveningId = 1002;

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

  tz.TZDateTime _nextInstanceOf(TimeOfDay time) {
    final now = tz.TZDateTime.now(tz.local);
    var scheduled = tz.TZDateTime(
      tz.local,
      now.year,
      now.month,
      now.day,
      time.hour,
      time.minute,
    );
    if (scheduled.isBefore(now)) {
      scheduled = scheduled.add(const Duration(days: 1));
    }
    return scheduled;
  }

  @override
  Future<void> scheduleDaily({required TimeOfDay morning, required TimeOfDay evening}) async {
    await _ensureInitialized();
    const details = NotificationDetails(
      android: AndroidNotificationDetails('fluent_reminders', 'Recordatorios de práctica'),
      iOS: DarwinNotificationDetails(),
    );
    await _plugin.zonedSchedule(
      _morningId,
      'Fluent',
      'Es hora de tu práctica de inglés de 10 minutos.',
      _nextInstanceOf(morning),
      details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.wallClockTime,
    );
    await _plugin.zonedSchedule(
      _eveningId,
      'Fluent',
      'Es hora de tu práctica de inglés de 10 minutos.',
      _nextInstanceOf(evening),
      details,
      androidScheduleMode: AndroidScheduleMode.inexactAllowWhileIdle,
      matchDateTimeComponents: DateTimeComponents.time,
      uiLocalNotificationDateInterpretation: UILocalNotificationDateInterpretation.wallClockTime,
    );
  }

  @override
  Future<void> cancelAll() async {
    await _ensureInitialized();
    await _plugin.cancel(_morningId);
    await _plugin.cancel(_eveningId);
  }
}

class FakeReminderService implements ReminderService {
  TimeOfDay? lastMorning;
  TimeOfDay? lastEvening;
  bool cancelled = false;

  @override
  Future<void> scheduleDaily({required TimeOfDay morning, required TimeOfDay evening}) async {
    lastMorning = morning;
    lastEvening = evening;
    cancelled = false;
  }

  @override
  Future<void> cancelAll() async {
    cancelled = true;
  }
}

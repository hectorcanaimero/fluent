import 'package:flutter/material.dart' show TimeOfDay;
import 'package:shared_preferences/shared_preferences.dart';

/// MAL-10: horarios de recordatorios persistidos en `SharedPreferences` —
/// compartido entre `SettingsScreen` (los edita) y `SessionSummaryScreen`
/// (los necesita para saltear el recordatorio de hoy tras la 2ª sesión
/// válida) para no duplicar las claves ni los valores por defecto.
const kReminderMorningDefault = TimeOfDay(hour: 8, minute: 30);
const kReminderEveningDefault = TimeOfDay(hour: 20, minute: 30);

const _prefsMorningHour = 'reminder_morning_hour';
const _prefsMorningMinute = 'reminder_morning_minute';
const _prefsEveningHour = 'reminder_evening_hour';
const _prefsEveningMinute = 'reminder_evening_minute';

Future<void> saveReminderTimes({
  required TimeOfDay morning,
  required TimeOfDay evening,
}) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setInt(_prefsMorningHour, morning.hour);
  await prefs.setInt(_prefsMorningMinute, morning.minute);
  await prefs.setInt(_prefsEveningHour, evening.hour);
  await prefs.setInt(_prefsEveningMinute, evening.minute);
}

Future<(TimeOfDay morning, TimeOfDay evening)> loadReminderTimes() async {
  final prefs = await SharedPreferences.getInstance();
  final morningHour = prefs.getInt(_prefsMorningHour);
  final morningMinute = prefs.getInt(_prefsMorningMinute);
  final eveningHour = prefs.getInt(_prefsEveningHour);
  final eveningMinute = prefs.getInt(_prefsEveningMinute);
  final morning = (morningHour != null && morningMinute != null)
      ? TimeOfDay(hour: morningHour, minute: morningMinute)
      : kReminderMorningDefault;
  final evening = (eveningHour != null && eveningMinute != null)
      ? TimeOfDay(hour: eveningHour, minute: eveningMinute)
      : kReminderEveningDefault;
  return (morning, evening);
}

import 'package:fluent_mobile/features/settings/data/reminder_prefs.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('MEJ-38: sin nada guardado, todavía no se preguntó', () async {
    SharedPreferences.setMockInitialValues({});
    expect(await hasAskedFirstSessionReminder(), isFalse);
  });

  test('MEJ-38: marcar como preguntado persiste', () async {
    SharedPreferences.setMockInitialValues({});
    await markFirstSessionReminderAsked();
    expect(await hasAskedFirstSessionReminder(), isTrue);
  });

  test('MEJ-39: "Alerta de racha" está encendida por defecto', () async {
    SharedPreferences.setMockInitialValues({});
    expect(await loadStreakAlertEnabled(), isTrue);
  });

  test('MEJ-39: apagar la alerta de racha persiste', () async {
    SharedPreferences.setMockInitialValues({});
    await saveStreakAlertEnabled(false);
    expect(await loadStreakAlertEnabled(), isFalse);
  });
}

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// MAL-28 / MEJ-14: clave de `SharedPreferences` compartida — la setea
/// `SessionSummaryScreen` la primera vez que una sesión suma XP y la lee
/// el checklist de arranque de Home (`_OnboardingChecklist`) para saber si
/// ya se completó "primera sesión de 3 min".
const kFirstValidSessionPrefsKey = 'first_valid_session_done';

/// Se lee una vez y queda en caché: crear el Future dentro de `build()`
/// hacía que el checklist de Home apareciera y desapareciera en cada
/// redibujo. El resumen lo invalida al marcar la primera sesión válida.
final firstValidSessionDoneProvider = FutureProvider<bool>((ref) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getBool(kFirstValidSessionPrefsKey) ?? false;
});

import 'package:shared_preferences/shared_preferences.dart';

/// FR-22: el texto de la oferta pegado en IE-01 sobrevive un error de
/// `POST /interviews` (IE-01c) o si el usuario sale de la pantalla antes de
/// enviarla, y se borra recién cuando la entrevista se crea.
///
/// La clave lleva el id de la cuenta para que otra cuenta en el mismo
/// teléfono no vea el borrador ajeno; además [clearOfferDrafts] los borra
/// todos al cerrar sesión (cubre también `userId == null`, mientras
/// `GET /me` no lo mande).
const _prefsOfferDraftPrefix = 'interview_offer_draft.';

String offerDraftKey(String? userId) =>
    '$_prefsOfferDraftPrefix${userId ?? 'anon'}';

Future<String?> loadOfferDraft(String? userId) async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(offerDraftKey(userId));
}

Future<void> saveOfferDraft(String? userId, String text) async {
  final prefs = await SharedPreferences.getInstance();
  if (text.isEmpty) {
    await prefs.remove(offerDraftKey(userId));
  } else {
    await prefs.setString(offerDraftKey(userId), text);
  }
}

/// Se llama al cerrar sesión (`beforeLogout` en `authControllerProvider`).
Future<void> clearOfferDrafts() async {
  final prefs = await SharedPreferences.getInstance();
  for (final key in prefs.getKeys().toList()) {
    if (key.startsWith(_prefsOfferDraftPrefix)) await prefs.remove(key);
  }
}

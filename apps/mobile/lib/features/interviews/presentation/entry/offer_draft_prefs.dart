import 'package:shared_preferences/shared_preferences.dart';

/// FR-22: el texto de la oferta pegado en IE-01 sobrevive un error de
/// `POST /interviews` (IE-01c) o si el usuario sale de la pantalla antes de
/// enviarla, y se borra recién cuando la entrevista se crea.
const _prefsOfferDraft = 'interview_offer_draft';

Future<String?> loadOfferDraft() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString(_prefsOfferDraft);
}

Future<void> saveOfferDraft(String text) async {
  final prefs = await SharedPreferences.getInstance();
  if (text.isEmpty) {
    await prefs.remove(_prefsOfferDraft);
  } else {
    await prefs.setString(_prefsOfferDraft, text);
  }
}

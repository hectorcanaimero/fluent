/// MAL-28 / MEJ-14: clave de `SharedPreferences` compartida — la setea
/// `SessionSummaryScreen` la primera vez que una sesión suma XP y la lee
/// el checklist de arranque de Home (`_OnboardingChecklist`) para saber si
/// ya se completó "primera sesión de 3 min".
const kFirstValidSessionPrefsKey = 'first_valid_session_done';

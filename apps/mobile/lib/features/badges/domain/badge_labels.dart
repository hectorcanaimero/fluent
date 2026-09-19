import '../../../l10n/gen/app_localizations.dart';

/// Nombre visible de una insignia. Un id desconocido (la API agregó una
/// nueva antes de que la app la conozca) muestra el id tal cual.
String badgeName(AppLocalizations l10n, String id) => switch (id) {
  'level_newcomer' => l10n.badgeLevelNewcomerName,
  'level_chatterbox' => l10n.badgeLevelChatterboxName,
  'level_storyteller' => l10n.badgeLevelStorytellerName,
  'level_debater' => l10n.badgeLevelDebaterName,
  'level_native_ish' => l10n.badgeLevelNativeIshName,
  'streak_3' => l10n.badgeStreak3Name,
  'streak_7' => l10n.badgeStreak7Name,
  'streak_30' => l10n.badgeStreak30Name,
  'streak_100' => l10n.badgeStreak100Name,
  'first_session' => l10n.badgeFirstSessionName,
  'sessions_10' => l10n.badgeSessions10Name,
  'sessions_50' => l10n.badgeSessions50Name,
  'sessions_100' => l10n.badgeSessions100Name,
  'boss_won' => l10n.badgeBossWonName,
  'no_corrections' => l10n.badgeNoCorrectionsName,
  'double_day' => l10n.badgeDoubleDayName,
  _ => id,
};

/// Qué hay que hacer para ganarla (bloqueada) o qué significa (ganada).
String badgeCondition(AppLocalizations l10n, String id) => switch (id) {
  'level_newcomer' => l10n.badgeLevelNewcomerCondition,
  'level_chatterbox' => l10n.badgeLevelChatterboxCondition,
  'level_storyteller' => l10n.badgeLevelStorytellerCondition,
  'level_debater' => l10n.badgeLevelDebaterCondition,
  'level_native_ish' => l10n.badgeLevelNativeIshCondition,
  'streak_3' => l10n.badgeStreak3Condition,
  'streak_7' => l10n.badgeStreak7Condition,
  'streak_30' => l10n.badgeStreak30Condition,
  'streak_100' => l10n.badgeStreak100Condition,
  'first_session' => l10n.badgeFirstSessionCondition,
  'sessions_10' => l10n.badgeSessions10Condition,
  'sessions_50' => l10n.badgeSessions50Condition,
  'sessions_100' => l10n.badgeSessions100Condition,
  'boss_won' => l10n.badgeBossWonCondition,
  'no_corrections' => l10n.badgeNoCorrectionsCondition,
  'double_day' => l10n.badgeDoubleDayCondition,
  _ => '',
};

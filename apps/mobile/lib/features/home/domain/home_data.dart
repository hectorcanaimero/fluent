import '../../../core/api/models.dart';

/// Snapshot agregado que consume Home (SPEC-06 §4.1). Se arma con varias
/// llamadas en paralelo porque la API no tiene un único endpoint de
/// "resumen de inicio".
class HomeData {
  const HomeData({
    required this.me,
    required this.progress,
    required this.group,
    required this.suggestions,
    required this.pendingFactsCount,
    required this.sessionsToday,
  });

  final MeResponse me;
  final ProgressResult progress;

  /// `null` si el usuario todavía no tiene grupo (por ejemplo, si el
  /// código de invitación falló en el registro, ver T2).
  final GroupResponse? group;
  final SessionSuggestions suggestions;
  final int pendingFactsCount;

  /// Sesiones completadas hoy (máx. 2 cuentan para el bonus de RF-5.1).
  /// El diseño de Pen muestra franjas fijas de mañana/tarde; el PRD las
  /// adopta como dos huecos sin franja obligatoria (docs/design/README.md),
  /// así que acá solo se cuenta el total del día.
  final int sessionsToday;

  bool get hasActiveProvider => me.providers.any((p) => p.status == 'active');

  /// `pendingActions` de `GET /me` (SPEC-02 §4.1) solo llega poblado al
  /// owner del grupo (la API la calcula por `userId` de quien pide `/me`,
  /// docs/specs/pendientes/PR-02.md PEND-76), así que no hace falta que la
  /// app verifique el rol: si la lista no está vacía, es para vos.
  static const _weeklySummaryCredentialAction = 'WEEKLY_SUMMARY_NEEDS_CREDENTIAL';

  bool get hasWeeklySummaryCredentialPending =>
      me.pendingActions.contains(_weeklySummaryCredentialAction);

  String get displayName => me.profile.displayName;

  int? get yourGroupPosition {
    final g = group;
    if (g == null) return null;
    final sorted = [...g.members]..sort((a, b) => b.xp.compareTo(a.xp));
    final idx = sorted.indexWhere((m) => m.displayName == displayName);
    return idx == -1 ? null : idx + 1;
  }
}

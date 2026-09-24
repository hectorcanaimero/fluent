import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/models.dart';
import '../../../core/providers.dart';

/// Snapshot agregado que consume Home (SPEC-06 §4.1). Se arma con varias
/// llamadas en paralelo porque la API no tiene un único endpoint de
/// "resumen de inicio".
class HomeData {
  const HomeData({
    required this.me,
    required this.progress,
    required this.group,
    required this.leaderboard,
    required this.suggestions,
    required this.pendingFactsCount,
    required this.sessionsToday,
  });

  final MeResponse me;
  final ProgressResult progress;

  /// `null` si el usuario todavía no tiene grupo (por ejemplo, si el
  /// código de invitación falló en el registro, ver T2).
  final GroupResponse? group;

  /// MAL-29: `_GroupCard` mostraba el XP total (`GroupMember.xp`) en vez del
  /// XP semanal del leaderboard — dos números que no coinciden y confunden
  /// contra lo que se ve en Grupo. `null` junto con [group].
  final LeaderboardResult? leaderboard;
  final SessionSuggestions suggestions;
  final int pendingFactsCount;

  /// Sesiones completadas hoy (máx. 2 cuentan para el bonus de RF-5.1).
  /// El diseño de Pen muestra franjas fijas de mañana/tarde; el PRD las
  /// adopta como dos huecos sin franja obligatoria (docs/design/README.md),
  /// así que acá solo se cuenta el total del día.
  final int sessionsToday;

  String get displayName => me.profile.displayName;
  String? get avatarUrl => me.profile.avatarUrl;

  int? get yourGroupPosition {
    // MAL-29: la posición se calcula sobre el mismo leaderboard semanal que
    // pinta `_GroupCard`, no sobre el XP total de `GroupInfo.members` — antes
    // podían no coincidir (por ejemplo, alguien con mucho XP viejo pero
    // inactivo esta semana).
    final rows = leaderboard?.rows;
    if (rows == null) return null;
    // MEJ-20: comparar por userId evita confundir a dos miembros con el
    // mismo nombre visible; se cae a displayName mientras `GET /me` no
    // mande `userId` (ver Profile.userId).
    final myUserId = me.profile.userId;
    final idx = myUserId != null
        ? rows.indexWhere((r) => r.userId == myUserId)
        : rows.indexWhere((r) => r.displayName == displayName);
    return idx == -1 ? null : idx + 1;
  }
}

/// MEJ-16: `HomeScreen` vive dentro del `ShellRoute` de `HomeShell`, así que
/// `context.go` entre pestañas la desmonta y remonta — con un `Future` en
/// `initState` eso pedía `/me` + 5 requests en cada cambio de pestaña.
/// `autoDispose` + `ref.keepAlive()` cachea el resultado mientras nadie lo
/// invalida explícitamente (logout, editar memoria) en vez de mientras el widget esté montado.
final homeDataProvider = FutureProvider.autoDispose<HomeData>((ref) async {
  ref.keepAlive();
  final api = ref.watch(fluentApiProvider);
  final me = await api.getMe();
  final results = await Future.wait([
    api.getProgress(),
    api.getSessionSuggestions(),
    api.getMemory(),
    api.getSessions(limit: 20),
    if (me.group != null) api.getGroup(),
    if (me.group != null) api.getLeaderboard(),
  ]);
  final progress = results[0] as ProgressResult;
  final suggestions = results[1] as SessionSuggestions;
  final memory = results[2] as MemoryResult;
  final sessions = results[3] as SessionListResult;
  final group = me.group != null ? results[4] as GroupResponse : null;
  final leaderboard = me.group != null ? results[5] as LeaderboardResult : null;

  final today = DateTime.now();
  final sessionsToday = sessions.items.where((s) {
    final started = DateTime.tryParse(s.startedAt);
    return started != null &&
        started.year == today.year &&
        started.month == today.month &&
        started.day == today.day;
  }).length;

  return HomeData(
    me: me,
    progress: progress,
    group: group,
    leaderboard: leaderboard,
    suggestions: suggestions,
    pendingFactsCount: memory.facts.pending.length,
    sessionsToday: sessionsToday,
  );
});

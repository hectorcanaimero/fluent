import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/features/home/domain/home_data.dart';
import 'package:flutter_test/flutter_test.dart';

const _profileBase = Profile(
  displayName: 'María',
  level: 'B1',
  interests: [],
  timezone: 'UTC',
  locale: 'es',
  xp: 0,
  streak: 0,
);

HomeData _homeData({
  required Profile profile,
  required List<GroupMember> members,
}) {
  return HomeData(
    me: MeResponse(
      profile: profile,
      onboarded: true,
      group: const GroupInfo(id: 'g1', name: 'Grupo'),
    ),
    progress: const ProgressResult(
      xp: 0,
      streak: 0,
      longestStreak: 0,
      sessionsThisWeek: 0,
      level: LevelInfo(name: 'B1', min: 0),
      correctionsTrend: [],
    ),
    group: GroupResponse(
      group: const GroupInfo(id: 'g1', name: 'Grupo'),
      members: members,
    ),
    // MAL-29: yourGroupPosition ahora se calcula sobre el leaderboard
    // semanal, no sobre `GroupInfo.members` — se arma con el mismo orden
    // (por xp) para no cambiar la intención de estos tests.
    leaderboard: LeaderboardResult(
      weekStart: '2026-09-07',
      rows:
          members
              .map(
                (m) => LeaderboardRow(
                  userId: m.userId,
                  displayName: m.displayName,
                  xpWeek: m.xp,
                  sessionsWeek: 0,
                  streak: m.streak,
                ),
              )
              .toList()
            ..sort((a, b) => b.xpWeek.compareTo(a.xpWeek)),
    ),
    suggestions: const SessionSuggestions(topics: [], roleplays: [], news: []),
    pendingFactsCount: 0,
    sessionsToday: 0,
  );
}

void main() {
  // MEJ-20: dos miembros con el mismo displayName no deben confundirse.
  test('yourGroupPosition compara por userId cuando está disponible', () {
    final data = _homeData(
      profile: _profileBase.copyWith(userId: 'user-2'),
      members: const [
        GroupMember(
          userId: 'user-1',
          displayName: 'María',
          level: 'B1',
          xp: 900,
          streak: 0,
        ),
        GroupMember(
          userId: 'user-2',
          displayName: 'María',
          level: 'B1',
          xp: 500,
          streak: 0,
        ),
      ],
    );

    // Por XP, user-1 (María homónima) queda primera y "yo" (user-2) segunda:
    // comparar por displayName confundiría a las dos.
    expect(data.yourGroupPosition, 2);
  });

  test('yourGroupPosition cae a displayName si el perfil no trae userId', () {
    final data = _homeData(
      profile: _profileBase,
      members: const [
        GroupMember(
          userId: 'user-1',
          displayName: 'Ana',
          level: 'B1',
          xp: 900,
          streak: 0,
        ),
        GroupMember(
          userId: 'user-2',
          displayName: 'María',
          level: 'B1',
          xp: 500,
          streak: 0,
        ),
      ],
    );

    expect(data.yourGroupPosition, 2);
  });
}

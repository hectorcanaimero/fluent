import '../../../core/api/models.dart';

class GroupScreenData {
  const GroupScreenData({
    required this.leaderboard,
    required this.challenges,
    required this.weeklySummary,
  });

  final LeaderboardResult leaderboard;
  final List<ChallengeItem> challenges;
  final WeeklySummaryResult? weeklySummary;
}

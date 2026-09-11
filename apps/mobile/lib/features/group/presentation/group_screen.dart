import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/errors/l10n_for_api_error.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/group_data.dart';

/// Grupo (SPEC-06 §4.7): leaderboard semanal, desafíos y resumen semanal
/// compartible.
class GroupScreen extends ConsumerStatefulWidget {
  const GroupScreen({super.key});

  @override
  ConsumerState<GroupScreen> createState() => _GroupScreenState();
}

class _GroupScreenState extends ConsumerState<GroupScreen> {
  late Future<GroupScreenData> _future;
  bool _startingChallenge = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<GroupScreenData> _load() async {
    final api = ref.read(fluentApiProvider);
    final results = await Future.wait([
      api.getLeaderboard(),
      api.getChallenges(),
    ]);
    WeeklySummaryResult? weeklySummary;
    try {
      weeklySummary = await api.getWeeklySummary();
    } catch (_) {
      weeklySummary = null;
    }
    return GroupScreenData(
      leaderboard: results[0] as LeaderboardResult,
      challenges: results[1] as List<ChallengeItem>,
      weeklySummary: weeklySummary,
    );
  }

  /// SPEC-07 §7: al aceptar, la app abre `POST /sessions` con
  /// `challengeFromUserId` (para el bono de XP al cerrarla). Siempre como
  /// `free_topic` con el `topic` legible del desafío (PEND-11 de
  /// `docs/specs/pendientes/PR-04.md`) y no con el `challenge.kind`
  /// original: `GET /challenges` no expone `roleplayId` ni `newsItemId`, así
  /// que un desafío de `roleplay`/`news` no se puede reabrir con su `kind`
  /// real sin esos ids. Ver PEND de `docs/specs/pendientes/PR-06.md`.
  Future<void> _acceptChallenge(ChallengeItem challenge) async {
    if (_startingChallenge) return;
    setState(() => _startingChallenge = true);
    try {
      final result = await ref
          .read(fluentApiProvider)
          .createSession(
            kind: 'free_topic',
            topic: challenge.topic,
            challengeFromUserId: challenge.fromUserId,
          );
      if (!mounted) return;
      context.push('/session/${result.session.id}');
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == ApiErrorCode.sessionAlreadyActive &&
          e.activeSessionId != null) {
        context.push('/session/${e.activeSessionId}');
        return;
      }
      final l10n = AppLocalizations.of(context);
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10nForApiError(e.code, l10n))));
    } finally {
      if (mounted) setState(() => _startingChallenge = false);
    }
  }

  Future<void> _shareWeeklySummary(String text) async {
    await ref.read(shareServiceProvider).shareText(text);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.groupTitle)),
      body: SafeArea(
        child: FutureBuilder<GroupScreenData>(
          future: _future,
          builder: (context, snapshot) {
            return AsyncBody<GroupScreenData>(
              snapshot: snapshot,
              skeleton: (context) => const _GroupSkeleton(),
              onRetry: () => setState(() {
                _future = _load();
              }),
              builder: (data) => ListView(
                padding: const EdgeInsets.all(AppSpacing.screenPad),
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          l10n.groupLeaderboardTitle,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      Row(
                        children: [
                          const Icon(
                            Icons.local_fire_department,
                            color: AppColors.accent,
                            size: 18,
                          ),
                          const SizedBox(width: 4),
                          Text(l10n.groupStreak(data.leaderboard.groupStreak)),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (var i = 0; i < data.leaderboard.rows.length; i++)
                    _LeaderboardRowTile(
                      key: Key('leaderboard_row_$i'),
                      rank: i + 1,
                      row: data.leaderboard.rows[i],
                    ),
                  const SizedBox(height: AppSpacing.xl),
                  if (data.challenges.isNotEmpty) ...[
                    Text(
                      l10n.groupChallengesTitle,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    for (final challenge in data.challenges)
                      Container(
                        key: Key('challenge_${challenge.sessionId}'),
                        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                l10n.groupChallengeText(
                                  challenge.displayName,
                                  challenge.topic,
                                ),
                              ),
                            ),
                            TextButton(
                              onPressed: _startingChallenge
                                  ? null
                                  : () => _acceptChallenge(challenge),
                              child: Text(l10n.groupChallengeAccept),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                  if (data.weeklySummary != null) ...[
                    Text(
                      l10n.groupWeeklySummaryTitle,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Container(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                        border: Border.all(color: AppColors.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(data.weeklySummary!.text),
                          const SizedBox(height: AppSpacing.md),
                          ElevatedButton.icon(
                            key: const Key('group_share_button'),
                            onPressed: () =>
                                _shareWeeklySummary(data.weeklySummary!.text),
                            icon: const Icon(Icons.share),
                            label: Text(l10n.groupShareButton),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// MEJ-02: forma aproximada del leaderboard (título + filas) mientras carga.
class _GroupSkeleton extends StatelessWidget {
  const _GroupSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: const [
        SkeletonBox(width: 160, height: 24),
        SizedBox(height: AppSpacing.md),
        SkeletonListTile(),
        SkeletonListTile(),
        SkeletonListTile(),
        SkeletonListTile(),
        SkeletonListTile(),
      ],
    );
  }
}

class _LeaderboardRowTile extends StatelessWidget {
  const _LeaderboardRowTile({super.key, required this.rank, required this.row});

  final int rank;
  final LeaderboardRow row;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          SizedBox(
            width: 28,
            child: rank == 1
                ? const Icon(
                    Icons.emoji_events,
                    color: AppColors.gold,
                    size: 20,
                  )
                : Text('$rank', textAlign: TextAlign.center),
          ),
          Expanded(child: Text(row.displayName)),
          Text(l10n.commonXpAmount(row.xpWeek)),
        ],
      ),
    );
  }
}

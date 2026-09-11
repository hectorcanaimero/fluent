import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../features/session/domain/correction_labels.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Progreso (SPEC-06 §9 del diseño): XP, nivel, streaks y tendencia de
/// correcciones.
class ProgressScreen extends ConsumerStatefulWidget {
  const ProgressScreen({super.key});

  @override
  ConsumerState<ProgressScreen> createState() => _ProgressScreenState();
}

class _ProgressScreenState extends ConsumerState<ProgressScreen> {
  late Future<ProgressResult> _future;

  @override
  void initState() {
    super.initState();
    _loadProgress();
  }

  void _loadProgress() {
    _future = ref.read(fluentApiProvider).getProgress();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: FutureBuilder<ProgressResult>(
          future: _future,
          builder: (context, snapshot) {
            return AsyncBody<ProgressResult>(
              snapshot: snapshot,
              onRetry: () => setState(_loadProgress),
              skeleton: (context) => const _ProgressSkeleton(),
              builder: (progress) => ListView(
                padding: const EdgeInsets.all(AppSpacing.screenPad),
                children: [
                  Text(
                    l10n.progressTitle,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _Stat(
                        label: l10n.progressXpLabel,
                        value: '${progress.xp}',
                      ),
                      _Stat(
                        label: l10n.progressStreakLabel,
                        value: '${progress.streak}',
                      ),
                      _Stat(
                        label: l10n.progressLongestStreakLabel,
                        value: '${progress.longestStreak}',
                      ),
                      _Stat(
                        label: l10n.progressSessionsThisWeekLabel,
                        value: '${progress.sessionsThisWeek}',
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    progress.level.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    l10n.progressCorrectionsTrendTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (progress.correctionsTrend.isEmpty)
                    Text(
                      l10n.progressCorrectionsTrendEmpty,
                      style: Theme.of(context).textTheme.bodySmall,
                    )
                  else
                    for (final item in progress.correctionsTrend)
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.xs,
                        ),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                correctionCategoryLabel(l10n, item.category),
                              ),
                            ),
                            Text(
                              l10n.progressCorrectionsTrendCounts(
                                item.count7d,
                                item.count30d,
                              ),
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ),
                      ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// MEJ-02: forma aproximada (título + fila de 3 stats + tendencia).
class _ProgressSkeleton extends StatelessWidget {
  const _ProgressSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: const [
        SkeletonBox(width: 140, height: 28),
        SizedBox(height: AppSpacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            SkeletonBox(width: 64, height: 48),
            SkeletonBox(width: 64, height: 48),
            SkeletonBox(width: 64, height: 48),
          ],
        ),
        SizedBox(height: AppSpacing.xl),
        SkeletonBox(width: 180, height: 20),
        SizedBox(height: AppSpacing.md),
        SkeletonListTile(),
        SkeletonListTile(),
        SkeletonListTile(),
      ],
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: Theme.of(context).textTheme.headlineMedium
              ?.copyWith(color: AppColors.primary),
        ),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

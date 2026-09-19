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
                  _StatGrid(
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

/// MEJ-02: forma aproximada (título + grilla de 4 stats + tendencia).
class _ProgressSkeleton extends StatelessWidget {
  const _ProgressSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: const [
        SkeletonBox(width: 140, height: 28),
        SizedBox(height: AppSpacing.lg),
        _StatGrid(
          children: [
            SkeletonBox(height: 76, borderRadius: AppRadius.lg),
            SkeletonBox(height: 76, borderRadius: AppRadius.lg),
            SkeletonBox(height: 76, borderRadius: AppRadius.lg),
            SkeletonBox(height: 76, borderRadius: AppRadius.lg),
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

/// Grilla de 2×2: en una sola fila las 4 etiquetas no entran a 390 dp en
/// es/pt ni con el texto del sistema agrandado. Cada fila toma el alto de
/// su celda más alta.
class _StatGrid extends StatelessWidget {
  const _StatGrid({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (var i = 0; i < children.length; i += 2) ...[
          if (i > 0) const SizedBox(height: AppSpacing.md),
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: children[i]),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: i + 1 < children.length
                      ? children[i + 1]
                      : const SizedBox.shrink(),
                ),
              ],
            ),
          ),
        ],
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
    final theme = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Números grandes (XP) se achican en vez de desbordar la celda.
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              value,
              style: theme.headlineMedium?.copyWith(
                color: AppColors.primaryDark,
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(label, style: theme.bodySmall),
        ],
      ),
    );
  }
}

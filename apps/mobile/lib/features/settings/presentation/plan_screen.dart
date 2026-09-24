import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Plan actual (`/settings/plan`): Free o Pro, qué incluye Pro y, para Free,
/// el botón «Pasar a Pro» (todavía sin cobro: abre «Disponible pronto»).
class PlanScreen extends ConsumerStatefulWidget {
  const PlanScreen({super.key});

  @override
  ConsumerState<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends ConsumerState<PlanScreen> {
  late Future<MeResponse> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  void _load() => _future = ref.read(fluentApiProvider).getMe();

  Future<void> _showComingSoon() {
    final l10n = AppLocalizations.of(context);
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.planComingSoonTitle),
        content: Text(l10n.planComingSoonBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.planComingSoonClose),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsPlanTitle)),
      body: SafeArea(
        child: FutureBuilder<MeResponse>(
          future: _future,
          builder: (context, snapshot) => AsyncBody<MeResponse>(
            snapshot: snapshot,
            onRetry: () => setState(_load),
            skeleton: (_) => ListView(
              padding: const EdgeInsets.all(AppSpacing.screenPad),
              children: const [
                SkeletonBox(width: 140, height: 28),
                SizedBox(height: AppSpacing.xl),
                SkeletonListTile(),
                SkeletonListTile(),
                SkeletonListTile(),
              ],
            ),
            builder: (me) {
              final expires = me.planExpiresAt;
              return ListView(
                padding: const EdgeInsets.all(AppSpacing.screenPad),
                children: [
                  Text(
                    me.isPro ? l10n.planCurrentPro : l10n.planCurrentFree,
                    key: const Key('plan_current'),
                    style: theme.textTheme.headlineMedium,
                  ),
                  if (me.isPro && expires != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.planProUntil(
                        DateFormat.yMMMd(
                          Localizations.localeOf(context).toString(),
                        ).format(expires.toLocal()),
                      ),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    l10n.planProIncludesTitle,
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (final text in [
                    l10n.planProFeatureModels,
                    l10n.planProFeatureDailyCap,
                    l10n.planProFeatureBrief,
                  ])
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(
                        Icons.check_circle_outline,
                        color: AppColors.primary,
                      ),
                      title: Text(text),
                    ),
                  if (!me.isPro) ...[
                    const SizedBox(height: AppSpacing.xl),
                    ElevatedButton(
                      key: const Key('plan_upgrade_button'),
                      onPressed: _showComingSoon,
                      child: Text(l10n.planUpgradeButton),
                    ),
                  ],
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

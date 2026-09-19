import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/badge_labels.dart';
import 'badge_image.dart';

/// Categorías en el orden en que las devuelve la API (catálogo).
const _categories = ['level', 'streak', 'sessions', 'special'];

String _categoryTitle(AppLocalizations l10n, String category) =>
    switch (category) {
      'level' => l10n.badgesCategoryLevel,
      'streak' => l10n.badgesCategoryStreak,
      'sessions' => l10n.badgesCategorySessions,
      'special' => l10n.badgesCategorySpecial,
      _ => category,
    };

/// "Ganada el 12 sept 2026", con el formato corto del idioma de la app.
String badgeEarnedOn(BuildContext context, String earnedAt) {
  final l10n = AppLocalizations.of(context);
  final date = DateTime.tryParse(earnedAt)?.toLocal();
  if (date == null) return l10n.badgesEarnedOn(earnedAt);
  final locale = Localizations.localeOf(context).toLanguageTag();
  return l10n.badgesEarnedOn(DateFormat.yMMMd(locale).format(date));
}

/// Logros (`/badges`): todas las insignias por categoría, ganadas en color y
/// bloqueadas en gris con lo que falta para ganarlas.
class BadgesScreen extends ConsumerStatefulWidget {
  const BadgesScreen({super.key});

  @override
  ConsumerState<BadgesScreen> createState() => _BadgesScreenState();
}

class _BadgesScreenState extends ConsumerState<BadgesScreen> {
  late Future<List<BadgeItem>> _future = _load();

  Future<List<BadgeItem>> _load() => ref.read(fluentApiProvider).getBadges();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.badgesTitle)),
      body: FutureBuilder<List<BadgeItem>>(
        future: _future,
        builder: (context, snapshot) => AsyncBody<List<BadgeItem>>(
          snapshot: snapshot,
          onRetry: () => setState(() => _future = _load()),
          skeleton: (context) => const _BadgesSkeleton(),
          builder: (badges) {
            final earned = badges.where((b) => b.isEarned).length;
            return ListView(
              padding: const EdgeInsets.all(AppSpacing.screenPad),
              children: [
                Text(
                  l10n.badgesEarnedCount(earned, badges.length),
                  key: const Key('badges_earned_count'),
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  child: LinearProgressIndicator(
                    value: badges.isEmpty ? 0 : earned / badges.length,
                    minHeight: 6,
                    color: AppColors.gold,
                    backgroundColor: AppColors.locked,
                  ),
                ),
                for (final category in _categories)
                  if (badges.any((b) => b.category == category)) ...[
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                      _categoryTitle(l10n, category),
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _BadgeGrid(
                      badges: [
                        for (final b in badges)
                          if (b.category == category) b,
                      ],
                    ),
                  ],
              ],
            );
          },
        ),
      ),
    );
  }
}

/// Grilla de 3 columnas con `Wrap`: cada celda toma el alto de su texto
/// (con texto grande no se corta como en un `GridView` de aspecto fijo).
class _BadgeGrid extends StatelessWidget {
  const _BadgeGrid({required this.badges});

  final List<BadgeItem> badges;

  static const _columns = 3;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width =
            (constraints.maxWidth - AppSpacing.md * (_columns - 1)) / _columns;
        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.lg,
          children: [
            for (final badge in badges)
              SizedBox(
                width: width,
                child: _BadgeTile(badge: badge),
              ),
          ],
        );
      },
    );
  }
}

class _BadgeTile extends StatelessWidget {
  const _BadgeTile({required this.badge});

  final BadgeItem badge;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final name = badgeName(l10n, badge.id);
    final earnedAt = badge.earnedAt;
    final status = earnedAt != null
        ? badgeEarnedOn(context, earnedAt)
        : l10n.badgesLocked;
    return Semantics(
      button: true,
      label: '$name. $status',
      excludeSemantics: true,
      child: InkWell(
        key: Key('badge_tile_${badge.id}'),
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: () => showBadgeDetail(context, badge),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
          child: Column(
            children: [
              BadgeImage(url: badge.imageUrl, size: 72, earned: badge.isEarned),
              const SizedBox(height: AppSpacing.sm),
              Text(
                name,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: theme.labelLarge?.copyWith(
                  color: badge.isEarned
                      ? AppColors.textPrimary
                      : AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              if (earnedAt != null)
                Text(
                  badgeEarnedOn(context, earnedAt),
                  textAlign: TextAlign.center,
                  style: theme.bodySmall,
                )
              else if (badge.progressTarget case final target?)
                _ProgressLine(
                  current: badge.progressCurrent ?? 0,
                  target: target,
                )
              else
                Text(
                  l10n.badgesLocked,
                  textAlign: TextAlign.center,
                  style: theme.bodySmall,
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Barra fina de avance hacia una insignia bloqueada, con "8 de 10".
class _ProgressLine extends StatelessWidget {
  const _ProgressLine({required this.current, required this.target});

  final int current;
  final int target;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final shown = current.clamp(0, target);
    return Column(
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          child: LinearProgressIndicator(
            value: target == 0 ? 1 : shown / target,
            minHeight: 4,
            color: AppColors.primary,
            backgroundColor: AppColors.locked,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l10n.badgesProgress(shown, target),
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

/// Detalle de una insignia: imagen grande, nombre, condición y la fecha o
/// el avance.
Future<void> showBadgeDetail(BuildContext context, BadgeItem badge) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) {
      final l10n = AppLocalizations.of(context);
      final theme = Theme.of(context).textTheme;
      final earnedAt = badge.earnedAt;
      return SafeArea(
        child: SingleChildScrollView(
          key: const Key('badge_detail_sheet'),
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.screenPad,
            0,
            AppSpacing.screenPad,
            AppSpacing.xl,
          ),
          child: Column(
            // Ancho completo: sin esto la hoja se ajusta al contenido.
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: BadgeImage(
                  url: badge.imageUrl,
                  size: 160,
                  earned: badge.isEarned,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              Text(
                badgeName(l10n, badge.id),
                textAlign: TextAlign.center,
                style: theme.headlineSmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                badgeCondition(l10n, badge.id),
                textAlign: TextAlign.center,
                style: theme.bodyLarge?.copyWith(
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              if (earnedAt != null)
                Text(
                  badgeEarnedOn(context, earnedAt),
                  textAlign: TextAlign.center,
                  style: theme.labelLarge?.copyWith(
                    color: AppColors.primaryDark,
                  ),
                )
              else if (badge.progressTarget case final target?)
                Center(
                  child: SizedBox(
                    width: 200,
                    child: _ProgressLine(
                      current: badge.progressCurrent ?? 0,
                      target: target,
                    ),
                  ),
                )
              else
                Text(
                  l10n.badgesLocked,
                  textAlign: TextAlign.center,
                  style: theme.labelLarge,
                ),
            ],
          ),
        ),
      );
    },
  );
}

class _BadgesSkeleton extends StatelessWidget {
  const _BadgesSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        const SkeletonBox(width: 120, height: 28),
        const SizedBox(height: AppSpacing.xl),
        const SkeletonBox(width: 100, height: 20),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.lg,
          runSpacing: AppSpacing.lg,
          children: [
            for (var i = 0; i < 6; i++)
              const SkeletonBox(
                width: 72,
                height: 72,
                borderRadius: AppRadius.pill,
              ),
          ],
        ),
      ],
    );
  }
}

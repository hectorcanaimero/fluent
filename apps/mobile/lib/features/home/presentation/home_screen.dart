import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/home_data.dart';

/// Home (SPEC-06 §4.1). El perfil y los ajustes se abren desde el avatar
/// de la cabecera (docs/design/README.md, decisión del 2026-09-08).
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  late Future<HomeData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<HomeData> _load() async {
    final api = ref.read(fluentApiProvider);
    final me = await api.getMe();
    final results = await Future.wait([
      api.getProgress(),
      api.getSessionSuggestions(),
      api.getMemory(),
      api.getSessions(limit: 20),
      if (me.group != null) api.getGroup(),
    ]);
    final progress = results[0] as ProgressResult;
    final suggestions = results[1] as SessionSuggestions;
    final memory = results[2] as MemoryResult;
    final sessions = results[3] as SessionListResult;
    final group = me.group != null ? results[4] as GroupResponse : null;

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
      suggestions: suggestions,
      pendingFactsCount: memory.facts.pending.length,
      sessionsToday: sessionsToday,
    );
  }

  void _reload() {
    ref.invalidate(canPracticeProvider);
    setState(() {
      _future = _load();
    });
  }

  /// [kind] es siempre el `kind` real de `POST /sessions` (SPEC-04 §3.2):
  /// `'boss'` para el botón de reto y `'free_topic'` (con [topic]) para un
  /// tema rápido de la Home.
  ///
  /// MAL-13: si no hay proveedor activo, manda a conectar uno en vez de
  /// intentar crear la sesión (que siempre fallaría con un snackbar
  /// genérico). El CTA principal ya se deshabilita en ese caso, pero los
  /// chips de temas rápidos pasan por acá también.
  Future<void> _startSession({required String kind, String? topic}) async {
    final l10n = AppLocalizations.of(context);
    final data = await _future;
    if (!mounted) return;
    if (!data.canPractice) {
      context.push('/providers');
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.homeNeedProviderHint)));
      return;
    }
    try {
      final result = await ref
          .read(fluentApiProvider)
          .createSession(kind: kind, topic: topic);
      if (!mounted) return;
      context.push('/session/${result.session.id}');
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.homeLoadError)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: FutureBuilder<HomeData>(
          future: _future,
          builder: (context, snapshot) {
            return AsyncBody<HomeData>(
              snapshot: snapshot,
              onRetry: _reload,
              builder: (data) => RefreshIndicator(
                onRefresh: () async {
                  _reload();
                  await _future;
                },
                child: ListView(
                  padding: const EdgeInsets.all(AppSpacing.screenPad),
                  children: [
                    _HeaderRow(data: data),
                    const SizedBox(height: AppSpacing.lg),
                    _StreakCard(data: data),
                    const SizedBox(height: AppSpacing.lg),
                    _LevelCard(data: data),
                    const SizedBox(height: AppSpacing.xl),
                    if (!data.hasActiveProvider) ...[
                      _NoProviderBanner(),
                      const SizedBox(height: AppSpacing.lg),
                    ],
                    if (data.hasWeeklySummaryCredentialPending) ...[
                      _PendingActionBanner(),
                      const SizedBox(height: AppSpacing.lg),
                    ],
                    _PrimaryCta(
                      data: data,
                      onPractice: () => context.push('/session/new'),
                      onBoss: () => _startSession(kind: 'boss'),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      l10n.homeSessionsTodayStatus(data.sessionsToday),
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    if (data.pendingFactsCount > 0) ...[
                      const SizedBox(height: AppSpacing.lg),
                      _PendingFactsCard(count: data.pendingFactsCount),
                    ],
                    if (data.group != null) ...[
                      const SizedBox(height: AppSpacing.lg),
                      _GroupCard(data: data),
                    ],
                    const SizedBox(height: AppSpacing.xl),
                    _QuickTopics(
                      data: data,
                      onTopic: (topic) =>
                          _startSession(kind: 'free_topic', topic: topic),
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _HeaderRow extends StatelessWidget {
  const _HeaderRow({required this.data});

  final HomeData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? l10n.homeGreetingMorning(data.displayName)
        : hour < 19
        ? l10n.homeGreetingAfternoon(data.displayName)
        : l10n.homeGreetingEvening(data.displayName);

    return Row(
      children: [
        Expanded(
          child: Text(
            greeting,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
        ),
        InkWell(
          key: const Key('home_avatar_button'),
          onTap: () => context.push('/settings'),
          borderRadius: BorderRadius.circular(999),
          child: CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.primarySoft,
            child: Text(
              data.displayName.isNotEmpty
                  ? data.displayName[0].toUpperCase()
                  : '?',
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.primaryDark,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _StreakCard extends StatelessWidget {
  const _StreakCard({required this.data});

  final HomeData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final streak = data.progress.streak;
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.accentSoft,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.local_fire_department,
            color: AppColors.accent,
            size: 32,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.homeStreakDays(streak),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (streak > 0)
                  Text(
                    l10n.homeGraceDayAvailable,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _LevelCard extends StatelessWidget {
  const _LevelCard({required this.data});

  final HomeData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final level = data.progress.level;
    final min = level.min;
    final next = level.next ?? (min + 1);
    final progressValue = next > min
        ? ((data.progress.xp - min) / (next - min)).clamp(0.0, 1.0)
        : 1.0;
    final remaining = (next - data.progress.xp).clamp(0, next);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(level.name, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.pill),
            child: LinearProgressIndicator(
              value: progressValue,
              minHeight: 8,
              backgroundColor: AppColors.locked,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.homeXpToNextLevel(remaining),
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _NoProviderBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      key: const Key('home_no_provider_banner'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.goldSoft,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded, color: AppColors.gold),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              l10n.homeNoProviderBanner,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          TextButton(
            onPressed: () => context.push('/providers'),
            child: Text(l10n.homeNoProviderAction),
          ),
        ],
      ),
    );
  }
}

class _PendingActionBanner extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      key: const Key('home_pending_action_banner'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.goldSoft,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.gold),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              l10n.homePendingActionWeeklySummaryCredential,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ),
          TextButton(
            onPressed: () => context.push('/providers'),
            child: Text(l10n.homePendingActionAction),
          ),
        ],
      ),
    );
  }
}

class _PrimaryCta extends StatelessWidget {
  const _PrimaryCta({
    required this.data,
    required this.onPractice,
    required this.onBoss,
  });

  final HomeData data;
  final VoidCallback onPractice;
  final VoidCallback onBoss;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final blocked = !data.canPractice;
    if (data.suggestions.bossPending) {
      return Column(
        children: [
          ElevatedButton(
            key: const Key('home_boss_button'),
            onPressed: blocked ? null : onBoss,
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.accent),
            child: Text(l10n.homeBossButton),
          ),
          TextButton(onPressed: onPractice, child: Text(l10n.homeBossSkip)),
        ],
      );
    }
    return ElevatedButton(
      key: const Key('home_practice_button'),
      onPressed: blocked ? null : onPractice,
      child: Text(l10n.homePracticeButton),
    );
  }
}

class _PendingFactsCard extends StatelessWidget {
  const _PendingFactsCard({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return InkWell(
      key: const Key('home_pending_facts_card'),
      onTap: () => context.push('/memory'),
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.primarySoft,
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Row(
          children: [
            const Icon(Icons.psychology_outlined, color: AppColors.primaryDark),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Text(l10n.homePendingFactsCard(count))),
          ],
        ),
      ),
    );
  }
}

class _GroupCard extends StatelessWidget {
  const _GroupCard({required this.data});

  final HomeData data;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final members = [...data.group!.members]
      ..sort((a, b) => b.xp.compareTo(a.xp));
    final top3 = members.take(3).toList();

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  l10n.homeGroupCardTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              TextButton(
                onPressed: () => context.push('/group'),
                child: Text(l10n.homeGroupSeeAll),
              ),
            ],
          ),
          for (final m in top3)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  Expanded(child: Text(m.displayName)),
                  Text('${m.xp} XP'),
                ],
              ),
            ),
          if (data.yourGroupPosition != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: Text(
                l10n.homeGroupYourPosition(data.yourGroupPosition!),
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
        ],
      ),
    );
  }
}

class _QuickTopics extends StatelessWidget {
  const _QuickTopics({required this.data, required this.onTopic});

  final HomeData data;
  final ValueChanged<String> onTopic;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final topics = data.suggestions.topics.take(4).toList();
    if (topics.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                l10n.homeQuickTopicsTitle,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            TextButton(
              onPressed: () => context.push('/session/new'),
              child: Text(l10n.homeQuickTopicsSeeAll),
            ),
          ],
        ),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final topic in topics)
              ActionChip(
                label: Text(topic),
                backgroundColor: AppColors.primarySoft,
                onPressed: () => onTopic(topic),
              ),
          ],
        ),
      ],
    );
  }
}

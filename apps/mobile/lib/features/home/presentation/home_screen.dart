import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/errors/l10n_for_api_error.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/button_spinner.dart';
import '../../../core/widgets/user_avatar.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../features/session/domain/session_prefs.dart';
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
  /// MEJ-20: sin esto, dos toques rápidos en el boss o en un chip de tema
  /// (sin el guard que ya tiene `new_session_screen._start`) creaban dos
  /// sesiones seguidas.
  bool _starting = false;

  void _reload() {
    ref.invalidate(canPracticeProvider);
    ref.invalidate(homeDataProvider);
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
    if (_starting) return;
    final l10n = AppLocalizations.of(context);
    final data = await ref.read(homeDataProvider.future);
    if (!mounted) return;
    if (!data.canPractice) {
      context.push('/providers');
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.homeNeedProviderHint)));
      return;
    }
    setState(() => _starting = true);
    try {
      final result = await ref
          .read(fluentApiProvider)
          .createSession(kind: kind, topic: topic);
      if (!mounted) return;
      context.push('/session/${result.session.id}');
    } on ApiException catch (e) {
      if (!mounted) return;
      // MEJ-10: ya hay una sesión abierta (por ejemplo, en otra pestaña o
      // dispositivo) — vamos directo a ella en vez de mostrar un error.
      if (e.code == ApiErrorCode.sessionAlreadyActive &&
          e.activeSessionId != null) {
        context.push('/session/${e.activeSessionId}');
        return;
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10nForApiError(e.code, l10n))));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.homeLoadError)));
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final asyncData = ref.watch(homeDataProvider);
    final snapshot = asyncData.when(
      data: (d) => AsyncSnapshot<HomeData>.withData(ConnectionState.done, d),
      error: (e, st) =>
          AsyncSnapshot<HomeData>.withError(ConnectionState.done, e, st),
      loading: () => const AsyncSnapshot<HomeData>.waiting(),
    );
    return Scaffold(
      body: SafeArea(
        child: AsyncBody<HomeData>(
          snapshot: snapshot,
          onRetry: _reload,
          skeleton: (context) => const _HomeSkeleton(),
          builder: (data) => RefreshIndicator(
            onRefresh: () async {
              _reload();
              await ref.read(homeDataProvider.future);
            },
            child: ListView(
              padding: const EdgeInsets.all(AppSpacing.screenPad),
              children: [
                _HeaderRow(data: data),
                const SizedBox(height: AppSpacing.lg),
                _OnboardingChecklist(data: data),
                _StreakCard(data: data),
                const SizedBox(height: AppSpacing.lg),
                _LevelCard(data: data),
                const SizedBox(height: AppSpacing.xl),
                // MAL-24: con la sesión de cortesía disponible, el banner de
                // "conectá un proveedor" no aplica — la promesa es
                // justamente que se puede practicar sin conectar nada.
                if (!data.hasActiveProvider && !data.hasCourtesySession) ...[
                  _NoProviderBanner(),
                  const SizedBox(height: AppSpacing.lg),
                ],
                if (data.hasWeeklySummaryCredentialPending) ...[
                  _PendingActionBanner(),
                  const SizedBox(height: AppSpacing.lg),
                ],
                _PrimaryCta(
                  data: data,
                  starting: _starting,
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
                  starting: _starting,
                  onTopic: (topic) =>
                      _startSession(kind: 'free_topic', topic: topic),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// MEJ-02: forma aproximada de la pantalla (saludo + racha + nivel +
/// temas rápidos) mientras `homeDataProvider` resuelve sus ~5 llamadas en
/// paralelo, en vez de un spinner sin relación con lo que va a aparecer.
class _HomeSkeleton extends StatelessWidget {
  const _HomeSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: const [
        Row(
          children: [
            Expanded(child: SkeletonBox(height: 28)),
            SizedBox(width: AppSpacing.md),
            SkeletonBox(width: 44, height: 44, borderRadius: 999),
          ],
        ),
        SizedBox(height: AppSpacing.lg),
        SkeletonBox(height: 88, borderRadius: AppRadius.lg),
        SizedBox(height: AppSpacing.md),
        SkeletonBox(height: 96, borderRadius: AppRadius.lg),
        SizedBox(height: AppSpacing.xl),
        SkeletonBox(width: 160, height: 20),
        SizedBox(height: AppSpacing.md),
        SkeletonListTile(),
        SkeletonListTile(),
        SkeletonListTile(),
      ],
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
        Semantics(
          button: true,
          label: l10n.settingsTitle,
          // 48 dp de área táctil y el fondo en el Material: sobre un
          // CircleAvatar opaco el ripple quedaba tapado.
          child: Material(
            color: AppColors.primarySoft,
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: const Key('home_avatar_button'),
              onTap: () => context.push('/settings'),
              // Foto del login social, o la inicial si no hay.
              child: UserAvatar(
                name: data.displayName,
                imageUrl: data.avatarUrl,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// MEJ-14: checklist de arranque (perfil, proveedor, primera sesión) —
/// desaparece en cuanto los 3 están listos, no se queda ocupando lugar para
/// siempre. "Primera sesión de 3 min" reusa el mismo flag de
/// `SharedPreferences` que MAL-28 usa para "primera sesión válida".
class _OnboardingChecklist extends ConsumerWidget {
  const _OnboardingChecklist({required this.data});

  final HomeData data;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Mientras se lee la preferencia no se muestra nada: mostrarlo y
    // esconderlo un instante después era justamente el parpadeo.
    return ref.watch(firstValidSessionDoneProvider).when(
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
      data: (firstSessionDone) {
        final providerConnected = data.hasActiveProvider;
        if (providerConnected && firstSessionDone) {
          return const SizedBox.shrink();
        }
        final l10n = AppLocalizations.of(context);
        return Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.lg),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.homeChecklistTitle,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                _ChecklistItem(label: l10n.homeChecklistProfile, done: true),
                _ChecklistItem(
                  label: l10n.homeChecklistProvider,
                  done: providerConnected,
                ),
                _ChecklistItem(
                  label: l10n.homeChecklistFirstSession,
                  done: firstSessionDone,
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _ChecklistItem extends StatelessWidget {
  const _ChecklistItem({required this.label, required this.done});

  final String label;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Icon(
            done ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 18,
            color: done ? AppColors.primary : AppColors.textMuted,
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            label,
            style: TextStyle(
              color: done ? AppColors.textPrimary : AppColors.textMuted,
              decoration: done ? TextDecoration.lineThrough : null,
            ),
          ),
        ],
      ),
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
    // MAL-27: antes se mostraba "día de gracia disponible" solo por tener
    // racha > 0, sin importar si la gracia ya se había usado esta semana.
    // Mientras la API no mande `grace` (campo ausente), no se muestra nada
    // en vez de inventar un estado.
    final graceText = switch (data.progress.grace) {
      'available' => l10n.streakGraceAvailable,
      'used' => l10n.streakGraceUsed,
      _ => null,
    };
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
            color: AppColors.accentText,
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
                if (graceText != null)
                  Text(
                    graceText,
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
          const Icon(Icons.warning_amber_rounded, color: AppColors.goldText),
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
          const Icon(Icons.info_outline, color: AppColors.goldText),
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
    required this.starting,
    required this.onPractice,
    required this.onBoss,
  });

  final HomeData data;
  final bool starting;
  final VoidCallback onPractice;
  final VoidCallback onBoss;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final blocked = !data.canPractice || starting;
    if (data.suggestions.bossPending) {
      return Column(
        // stretch: el ElevatedButton ya no ocupa todo el ancho por tema.
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ElevatedButton(
            key: const Key('home_boss_button'),
            onPressed: blocked ? null : onBoss,
            // accentText de fondo: el blanco sobre `accent` daba 2,66:1.
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.accentText,
            ),
            child: starting ? const ButtonSpinner() : Text(l10n.homeBossButton),
          ),
          TextButton(
            onPressed: starting ? null : onPractice,
            child: Text(l10n.homeBossSkip),
          ),
        ],
      );
    }
    // MAL-24: sin proveedor propio pero con cortesía disponible, el botón
    // adelanta la promesa ("no hace falta conectar nada") en vez de mostrar
    // el texto genérico de siempre.
    final label = (!data.hasActiveProvider && data.hasCourtesySession)
        ? l10n.homeCourtesyPracticeButton
        : l10n.homePracticeButton;
    return ElevatedButton(
      key: const Key('home_practice_button'),
      onPressed: blocked ? null : onPractice,
      // Al tocar solo se deshabilitaba: ahora muestra que está arrancando.
      child: starting ? const ButtonSpinner() : Text(label),
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
      // Ink y no Container: el fondo opaco tapaba el ripple.
      child: Ink(
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
    // MAL-29: XP semanal del leaderboard, no el XP total de
    // `GroupInfo.members` — son números distintos y mostrar el total acá
    // no coincide con lo que se ve al entrar a Grupo.
    final rows = data.leaderboard?.rows ?? const [];
    final top3 = rows.take(3).toList();

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
          for (final row in top3)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  UserAvatar(
                    name: row.displayName,
                    imageUrl: row.avatarUrl,
                    size: 28,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(child: Text(row.displayName)),
                  Text(l10n.commonXpAmount(row.xpWeek)),
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
  const _QuickTopics({
    required this.data,
    required this.starting,
    required this.onTopic,
  });

  final HomeData data;
  final bool starting;
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
              Semantics(
                button: true,
                label: topic,
                child: ActionChip(
                  label: Text(topic),
                  backgroundColor: AppColors.primarySoft,
                  onPressed: starting ? null : () => onTopic(topic),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

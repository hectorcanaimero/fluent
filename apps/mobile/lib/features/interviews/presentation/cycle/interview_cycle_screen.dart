import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/errors/api_error_snack_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/widgets/async_body.dart';
import '../../../../core/widgets/button_spinner.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../data/interviews_repository.dart';

/// `/interviews/:id/cycle` (IE-07, FR-17 a FR-19, FR-29, FR-30): el ciclo de
/// 5 sesiones de estudio armado desde el parecer. `POST /interviews/:id/cycle`
/// es idempotente (devuelve el ciclo ya creado), así que abrir esta pantalla
/// es lo que la crea o la retoma, sin que el botón del parecer necesite
/// llamarla primero.
class InterviewCycleScreen extends ConsumerStatefulWidget {
  const InterviewCycleScreen({super.key, required this.interviewId});

  final String interviewId;

  @override
  ConsumerState<InterviewCycleScreen> createState() =>
      _InterviewCycleScreenState();
}

class _InterviewCycleScreenState extends ConsumerState<InterviewCycleScreen> {
  late Future<StudyCycle> _future = _load();

  /// `idx` de la sesión cuyo `start` está en vuelo (deshabilita las demás
  /// filas para no disparar dos `POST` a la vez).
  int? _startingIdx;

  Future<StudyCycle> _load() =>
      ref.read(interviewsRepositoryProvider).createCycle(widget.interviewId);

  Future<void> _startSession(int idx) async {
    if (_startingIdx != null) return;
    setState(() => _startingIdx = idx);
    try {
      final start = await ref
          .read(interviewsRepositoryProvider)
          .startCycleSession(interviewId: widget.interviewId, idx: idx);
      if (!mounted) return;
      context.push('/session/${start.sessionId}');
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(apiErrorSnackBar(context, e.code));
      setState(() => _future = _load());
    } finally {
      if (mounted) setState(() => _startingIdx = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final competencyNames = {
      for (final c
          in ref
                  .watch(interviewProvider(widget.interviewId))
                  .valueOrNull
                  ?.competencies ??
              const <InterviewCompetency>[])
        c.id: c.name,
    };
    final companyName =
        ref
            .watch(interviewProvider(widget.interviewId))
            .valueOrNull
            ?.company
            ?.name ??
        l10n.interviewHistoryCompanyFallback;
    return Scaffold(
      appBar: AppBar(title: Text(l10n.interviewCycleTitle)),
      body: SafeArea(
        child: FutureBuilder<StudyCycle>(
          future: _future,
          builder: (context, snapshot) => AsyncBody<StudyCycle>(
            snapshot: snapshot,
            onRetry: () => setState(() => _future = _load()),
            builder: (cycle) => _CycleBody(
              cycle: cycle,
              companyName: companyName,
              competencyNames: competencyNames,
              startingIdx: _startingIdx,
              onStart: _startSession,
            ),
          ),
        ),
      ),
    );
  }
}

class _CycleBody extends StatelessWidget {
  const _CycleBody({
    required this.cycle,
    required this.companyName,
    required this.competencyNames,
    required this.startingIdx,
    required this.onStart,
  });

  final StudyCycle cycle;
  final String companyName;
  final Map<String, String> competencyNames;
  final int? startingIdx;
  final void Function(int idx) onStart;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final doneCount = cycle.sessions.where((s) => s.status == 'done').length;
    final totalMin = cycle.sessions.fold<int>(0, (sum, s) => sum + s.estMin);
    final completed = cycle.status == 'completed';
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        Text(
          l10n.interviewCycleSubtitle(companyName),
          key: const Key('interview_cycle_subtitle'),
          style: theme.bodyMedium?.copyWith(color: AppColors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              l10n.interviewCycleProgress(doneCount),
              key: const Key('interview_cycle_progress'),
              style: theme.titleMedium,
            ),
            Text(
              l10n.interviewCycleTotalDuration(totalMin),
              style: theme.bodyMedium?.copyWith(color: AppColors.textSecondary),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadius.pill),
          child: LinearProgressIndicator(
            value: doneCount / cycle.sessions.length,
            minHeight: 6,
            color: AppColors.primary,
            backgroundColor: AppColors.locked,
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        for (final session in cycle.sessions)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: _CycleSessionRow(
              session: session,
              focusLabel: _focusLabel(session.focus, competencyNames, l10n),
              busy: startingIdx == session.idx,
              disabled: startingIdx != null && startingIdx != session.idx,
              onStart: () => onStart(session.idx),
            ),
          ),
        const SizedBox(height: AppSpacing.lg),
        _ReinterviewCard(completed: completed),
      ],
    );
  }
}

String _focusLabel(
  String focus,
  Map<String, String> competencyNames,
  AppLocalizations l10n,
) => focus == 'english'
    ? l10n.interviewCycleFocusEnglish
    : (competencyNames[focus] ?? focus);

String _formatLabel(String format, AppLocalizations l10n) => switch (format) {
  'roleplay' => l10n.interviewCycleFormatRoleplay,
  _ => l10n.interviewCycleFormatGuided,
};

/// Una fila por sesión (IE-07): foco, título, duración y formato, con el
/// estado resuelto por la API (`done | available | locked`, FR-29). Una fila
/// `locked` no tiene botón ni `onTap`: no hay forma de tocarla para
/// adelantarse en el orden.
class _CycleSessionRow extends StatelessWidget {
  const _CycleSessionRow({
    required this.session,
    required this.focusLabel,
    required this.busy,
    required this.disabled,
    required this.onStart,
  });

  final StudyCycleSession session;
  final String focusLabel;
  final bool busy;
  final bool disabled;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final locked = session.status == 'locked';
    final done = session.status == 'done';
    return Container(
      key: Key('interview_cycle_session_${session.idx}'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: locked ? AppColors.locked : AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Icon(
            done
                ? Icons.check_circle
                : locked
                ? Icons.lock_outline
                : Icons.play_circle_outline,
            color: done
                ? AppColors.success
                : locked
                ? AppColors.textMuted
                : AppColors.primary,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  focusLabel,
                  style: theme.labelSmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
                Text(session.title, style: theme.titleSmall),
                Text(
                  '${l10n.interviewCycleSessionDuration(session.estMin)} · '
                  '${_formatLabel(session.format, l10n)}',
                  style: theme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          if (done)
            Text(l10n.interviewCycleSessionDoneLabel, style: theme.labelSmall)
          else if (locked)
            Text(
              l10n.interviewCycleSessionLockedLabel,
              style: theme.labelSmall?.copyWith(color: AppColors.textMuted),
            )
          else
            ElevatedButton(
              key: Key('interview_cycle_session_${session.idx}_start'),
              onPressed: disabled || busy ? null : onStart,
              child: busy
                  ? const ButtonSpinner()
                  : Text(l10n.interviewCycleSessionStartCta),
            ),
        ],
      ),
    );
  }
}

/// La re-entrevista (IE-08) se queda bloqueada hasta completar las 5
/// sesiones (FR-30); llamar `POST /interviews/:id/reinterview` y navegar a
/// la preparación de la hija es F13.2.T2.
class _ReinterviewCard extends StatelessWidget {
  const _ReinterviewCard({required this.completed});

  final bool completed;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    return Container(
      key: const Key('interview_cycle_reinterview_card'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: completed ? AppColors.primarySoft : AppColors.locked,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Icon(
            completed ? Icons.replay : Icons.lock_outline,
            color: completed ? AppColors.primaryDark : AppColors.textMuted,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  l10n.interviewCycleReinterviewTitle,
                  style: theme.titleSmall,
                ),
                Text(
                  completed
                      ? l10n.interviewCycleReinterviewReady
                      : l10n.interviewCycleReinterviewLocked,
                  style: theme.bodySmall?.copyWith(
                    color: AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

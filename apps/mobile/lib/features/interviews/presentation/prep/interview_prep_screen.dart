import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/errors/api_error_snack_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/widgets/async_body.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../data/interviews_repository.dart';

const _prepSteps = ['reading', 'researching', 'designing'];

/// `/interviews/:id`: IE-03 (preparando, con 03a poca info del lado de la
/// empresa y 03b fallo) e IE-04 (resumen del plan), FR-6, FR-7, FR-23,
/// FR-33. El polling mientras `preparing` ya vive en `interviewProvider`
/// (cada 3 s); esta pantalla solo lo observa.
class InterviewPrepScreen extends ConsumerWidget {
  const InterviewPrepScreen({super.key, required this.interviewId});

  final String interviewId;

  Future<void> _retry(BuildContext context, WidgetRef ref) async {
    final l10n = AppLocalizations.of(context);
    try {
      await ref.read(interviewsRepositoryProvider).retry(interviewId);
      ref.invalidate(interviewProvider(interviewId));
    } on ApiException catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(apiErrorSnackBar(context, e.code));
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.errorGeneric)));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final asyncDetail = ref.watch(interviewProvider(interviewId));
    final snapshot = asyncDetail.when(
      data: (d) =>
          AsyncSnapshot<InterviewDetail>.withData(ConnectionState.done, d),
      error: (e, st) =>
          AsyncSnapshot<InterviewDetail>.withError(ConnectionState.done, e, st),
      loading: () => const AsyncSnapshot<InterviewDetail>.waiting(),
    );
    return Scaffold(
      appBar: AppBar(title: Text(l10n.interviewDetailAppBarTitle)),
      body: SafeArea(
        child: AsyncBody<InterviewDetail>(
          snapshot: snapshot,
          onRetry: () => ref.invalidate(interviewProvider(interviewId)),
          builder: (detail) => switch (detail.status) {
            'preparing' => _PreparingView(detail: detail),
            'prep_failed' => _PrepFailedView(
              onRetry: () => _retry(context, ref),
            ),
            'ready' => _PlanSummaryView(
              detail: detail,
              onStart: () => context.push('/interviews/$interviewId/session'),
              onRetry: () => _retry(context, ref),
            ),
            // Otros estados (in_progress, feedback_*, too_short) los cubren
            // otras tareas (F12, F13); acá no hay nada que mostrar todavía.
            _ => const SizedBox.shrink(),
          },
        ),
      ),
    );
  }
}

/// IE-03: los tres pasos de preparación según `prepStep`.
class _PreparingView extends StatelessWidget {
  const _PreparingView({required this.detail});

  final InterviewDetail detail;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final stepLabels = {
      'reading': l10n.interviewPrepStepReading,
      'researching': l10n.interviewPrepStepResearching,
      'designing': l10n.interviewPrepStepDesigning,
    };
    final currentIdx = _prepSteps.indexOf(detail.prepStep ?? 'reading');
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < _prepSteps.length; i++)
              Padding(
                padding: const EdgeInsets.symmetric(
                  vertical: AppSpacing.sm,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (i < currentIdx)
                      const Icon(Icons.check_circle, color: AppColors.success)
                    else if (i == currentIdx)
                      const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else
                      const Icon(
                        Icons.circle_outlined,
                        color: AppColors.textMuted,
                      ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      stepLabels[_prepSteps[i]]!,
                      key: Key('interview_prep_step_${_prepSteps[i]}'),
                      style: i == currentIdx
                          ? Theme.of(context).textTheme.titleSmall
                          : Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: AppColors.textMuted,
                            ),
                    ),
                  ],
                ),
              ),
            const SizedBox(height: AppSpacing.xl),
            Text(
              l10n.interviewPrepEtaHint,
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.interviewPrepExitHint,
              style: Theme.of(context).textTheme.bodySmall,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}

/// IE-03b: preparación fallida, con "Reintentar" (`POST
/// /interviews/:id/retry`).
class _PrepFailedView extends StatelessWidget {
  const _PrepFailedView({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, size: 48, color: AppColors.error),
            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.interviewPrepFailedTitle,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.interviewPrepFailedBody,
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            ElevatedButton(
              key: const Key('interview_prep_retry_button'),
              onPressed: onRetry,
              child: Text(l10n.commonRetry),
            ),
          ],
        ),
      ),
    );
  }
}

/// IE-04: resumen del plan, sin exponer nunca las preguntas (FR-7).
class _PlanSummaryView extends StatelessWidget {
  const _PlanSummaryView({
    required this.detail,
    required this.onStart,
    required this.onRetry,
  });

  final InterviewDetail detail;
  final VoidCallback onStart;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final company = detail.company;
    // IE-03a: la investigación no encontró casi nada de la empresa (NFR-6).
    final lowInfo =
        company == null ||
        (company.industry == null &&
            company.city == null &&
            company.workMode == null);
    final companyLine = [company?.industry, company?.city, company?.workMode]
        .whereType<String>()
        .join(' · ');

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        if (company?.name != null)
          Text(
            company!.name,
            style: Theme.of(context).textTheme.headlineSmall,
          ),
        if (companyLine.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(companyLine, style: Theme.of(context).textTheme.bodyMedium),
        ],
        if (lowInfo) ...[
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerLeft,
            child: Chip(
              key: const Key('interview_plan_low_info_badge'),
              label: Text(l10n.interviewLowInfoBadge),
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        if (detail.role != null)
          _InfoRow(label: l10n.interviewPlanRoleLabel, value: detail.role!),
        if (detail.area != null)
          _InfoRow(label: l10n.interviewPlanAreaLabel, value: detail.area!),
        if (detail.seniority != null)
          _InfoRow(
            label: l10n.interviewPlanSeniorityLabel,
            value: _seniorityLabel(detail.seniority!, l10n),
          ),
        _InfoRow(
          label: l10n.interviewPlanTypeLabel,
          value: _typeLabel(detail.type, l10n),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (detail.questionCount != null && detail.estimatedMin != null)
          Text(
            l10n.interviewPlanQuestionsSummary(
              detail.questionCount!,
              detail.estimatedMin!,
            ),
            style: Theme.of(context).textTheme.titleSmall,
          ),
        if (detail.competencies.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.lg),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final competency in detail.competencies)
                Chip(label: Text(competency)),
            ],
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        Text(
          l10n.interviewFreeNotice,
          style: Theme.of(
            context,
          ).textTheme.bodySmall?.copyWith(color: AppColors.textMuted),
        ),
        const SizedBox(height: AppSpacing.lg),
        ElevatedButton(
          key: const Key('interview_plan_start_button'),
          onPressed: onStart,
          child: Text(l10n.interviewPlanStartCta),
        ),
        const SizedBox(height: AppSpacing.sm),
        TextButton(
          key: const Key('interview_plan_retry_button'),
          onPressed: onRetry,
          child: Text(l10n.commonRetry),
        ),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Text(label, style: Theme.of(context).textTheme.labelSmall),
          const SizedBox(width: AppSpacing.sm),
          Text(value, style: Theme.of(context).textTheme.bodyMedium),
        ],
      ),
    );
  }
}

String _typeLabel(String type, AppLocalizations l10n) => switch (type) {
  'mixed' => l10n.interviewTypeMixed,
  _ => l10n.interviewTypeTechnical,
};

String _seniorityLabel(String code, AppLocalizations l10n) => switch (code) {
  'junior' => l10n.interviewSeniorityJunior,
  'semi_senior' => l10n.interviewSenioritySemiSenior,
  'senior' => l10n.interviewSenioritySenior,
  'staff_lead' => l10n.interviewSeniorityStaffLead,
  _ => code,
};

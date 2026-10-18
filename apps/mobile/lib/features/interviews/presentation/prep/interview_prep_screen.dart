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
import '../interview_widgets.dart';

const _prepSteps = ['reading', 'researching', 'designing'];

/// `/interviews/:id`: IE-03 (preparando, con 03a poca info del lado de la
/// empresa y 03b fallo) e IE-04 (resumen del plan), FR-6, FR-7, FR-23,
/// FR-33. El polling mientras `preparing` ya vive en `interviewProvider`
/// (cada 3 s); esta pantalla solo lo observa.
class InterviewPrepScreen extends ConsumerStatefulWidget {
  const InterviewPrepScreen({super.key, required this.interviewId});

  final String interviewId;

  @override
  ConsumerState<InterviewPrepScreen> createState() =>
      _InterviewPrepScreenState();
}

class _InterviewPrepScreenState extends ConsumerState<InterviewPrepScreen> {
  bool _retrying = false;

  String get interviewId => widget.interviewId;

  Future<void> _retry() async {
    if (_retrying) return;
    final l10n = AppLocalizations.of(context);
    setState(() => _retrying = true);
    try {
      await ref.read(interviewsRepositoryProvider).retry(interviewId);
      ref.invalidate(interviewProvider(interviewId));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(apiErrorSnackBar(context, e.code));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.errorGeneric)));
    } finally {
      if (mounted) setState(() => _retrying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
              onRetry: _retrying ? null : _retry,
            ),
            'ready' => _PlanSummaryView(
              detail: detail,
              onStart: () => context.push('/interviews/$interviewId/session'),
            ),
            'in_progress' || 'too_short'
                when detail.status == 'in_progress' || detail.resumable =>
              _StatusCard(
                title: l10n.interviewInProgressTitle,
                cta: l10n.interviewContinueCta,
                buttonKey: const Key('interview_continue_button'),
                onPressed: () =>
                    context.push('/interviews/$interviewId/session'),
              ),
            // too_short sin retomar, feedback_* y cualquier estado nuevo: el
            // parecer (o por qué no lo hay) vive en `/feedback`.
            _ => _StatusCard(
              title: l10n.interviewFinishedTitle,
              cta: l10n.interviewViewFeedbackCta,
              buttonKey: const Key('interview_view_feedback_button'),
              onPressed: () =>
                  context.push('/interviews/$interviewId/feedback'),
            ),
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
    // `done` llega un instante antes de `ready`: todo tildado salvo el
    // último, que sigue girando mientras `status` sea `preparing`.
    final currentIdx = switch (detail.prepStep) {
      'researching' => 1,
      'designing' || 'done' => 2,
      _ => 0,
    };
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // IE-03a: la investigación ya terminó y no trajo nada de la empresa.
            if (currentIdx == 2 && _isLowInfo(detail.company)) ...[
              const _LowInfoBadge(),
              const SizedBox(height: AppSpacing.lg),
            ],
            for (var i = 0; i < _prepSteps.length; i++)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
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
                          : Theme.of(context).textTheme.bodyMedium
                                ?.copyWith(color: AppColors.textMuted),
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

  /// `null` mientras el reintento está en vuelo (botón deshabilitado).
  final VoidCallback? onRetry;

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
  const _PlanSummaryView({required this.detail, required this.onStart});

  final InterviewDetail detail;
  final VoidCallback onStart;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final company = detail.company;
    final companyLine = [
      company?.industry,
      company?.city,
      if (company?.workMode != null) _workModeLabel(company!.workMode!, l10n),
    ].whereType<String>().join(' · ');

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        if (company?.name != null)
          Text(company!.name, style: Theme.of(context).textTheme.headlineSmall),
        if (companyLine.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(companyLine, style: Theme.of(context).textTheme.bodyMedium),
        ],
        if (_isLowInfo(company)) ...[
          const SizedBox(height: AppSpacing.sm),
          const Align(alignment: Alignment.centerLeft, child: _LowInfoBadge()),
        ],
        const SizedBox(height: AppSpacing.lg),
        if (detail.role != null)
          _InfoRow(label: l10n.interviewPlanRoleLabel, value: detail.role!),
        if (detail.area != null)
          _InfoRow(label: l10n.interviewPlanAreaLabel, value: detail.area!),
        if (detail.seniority != null)
          _InfoRow(
            label: l10n.interviewPlanSeniorityLabel,
            value: seniorityLabel(detail.seniority!, l10n),
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
                Chip(label: Text(competency.name)),
            ],
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        Text(
          l10n.interviewFreeNotice,
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(color: AppColors.textMuted),
        ),
        const SizedBox(height: AppSpacing.lg),
        ElevatedButton(
          key: const Key('interview_plan_start_button'),
          onPressed: onStart,
          child: Text(l10n.interviewPlanStartCta),
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
          Expanded(
            child: Text(
              value,
              style: Theme.of(context).textTheme.bodyMedium,
              maxLines: 2,
              softWrap: true,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

/// Estados fuera de la preparación (F12/F13 los desarrollan): una tarjeta
/// con a dónde seguir, nunca una pantalla en blanco.
class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.title,
    required this.cta,
    required this.buttonKey,
    required this.onPressed,
  });

  final String title;
  final String cta;
  final Key buttonKey;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.lg),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.lg),
                ElevatedButton(
                  key: buttonKey,
                  onPressed: onPressed,
                  child: Text(cta),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LowInfoBadge extends StatelessWidget {
  const _LowInfoBadge();

  @override
  Widget build(BuildContext context) => Chip(
    key: const Key('interview_plan_low_info_badge'),
    label: Text(AppLocalizations.of(context).interviewLowInfoBadge),
  );
}

/// IE-03a (NFR-6). ponytail: la API no expone `researchFound`; se infiere de
/// la ficha vacía. Usar el flag si el DTO lo agrega.
bool _isLowInfo(CompanyInfo? company) =>
    company == null ||
    (company.industry == null &&
        company.city == null &&
        company.workMode == null);

String _workModeLabel(String code, AppLocalizations l10n) => switch (code) {
  'remote' => l10n.interviewWorkModeRemote,
  'hybrid' => l10n.interviewWorkModeHybrid,
  'onsite' => l10n.interviewWorkModeOnsite,
  _ => code,
};

String _typeLabel(String type, AppLocalizations l10n) => switch (type) {
  'mixed' => l10n.interviewTypeMixed,
  _ => l10n.interviewTypeTechnical,
};

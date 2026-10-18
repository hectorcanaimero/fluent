import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/widgets/async_body.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../data/interviews_repository.dart';

/// `/interviews/:id/compare` (IE-08, FR-19, FR-30): "Así cambiaste", el
/// parecer de una re-entrevista contra el anterior. Solo lee
/// `GET /interviews/:id/feedback` (el mismo parecer que ya trae
/// `comparison` cuando la entrevista es una re-entrevista); sin botón de
/// compartir (FR-28).
class InterviewCompareScreen extends ConsumerStatefulWidget {
  const InterviewCompareScreen({super.key, required this.interviewId});

  final String interviewId;

  @override
  ConsumerState<InterviewCompareScreen> createState() =>
      _InterviewCompareScreenState();
}

class _InterviewCompareScreenState
    extends ConsumerState<InterviewCompareScreen> {
  late Future<InterviewFeedback> _future = _load();

  Future<InterviewFeedback> _load() =>
      ref.read(interviewsRepositoryProvider).feedback(widget.interviewId);

  void _reload() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final detail = ref.watch(interviewProvider(widget.interviewId)).valueOrNull;
    final competencyNames = {
      for (final c in detail?.competencies ?? const <InterviewCompetency>[])
        c.id: c.name,
    };
    return Scaffold(
      appBar: AppBar(title: Text(l10n.interviewCompareTitle)),
      body: SafeArea(
        child: FutureBuilder<InterviewFeedback>(
          future: _future,
          builder: (context, snapshot) => AsyncBody<InterviewFeedback>(
            snapshot: snapshot,
            onRetry: _reload,
            builder: (feedback) => _CompareBody(
              feedback: feedback,
              competencyNames: competencyNames,
              interviewId: widget.interviewId,
            ),
          ),
        ),
      ),
    );
  }
}

class _CompareBody extends StatelessWidget {
  const _CompareBody({
    required this.feedback,
    required this.competencyNames,
    required this.interviewId,
  });

  final InterviewFeedback feedback;
  final Map<String, String> competencyNames;
  final String interviewId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final comparison = feedback.comparison ?? const <CompetencyComparison>[];
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        Text(
          l10n.interviewCompareHeadline,
          key: const Key('interview_compare_headline'),
          style: theme.headlineSmall,
        ),
        const SizedBox(height: AppSpacing.lg),
        for (final item in comparison)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: _ComparisonRow(
              item: item,
              name: competencyNames[item.competencyId] ?? item.competencyId,
            ),
          ),
        const SizedBox(height: AppSpacing.sm),
        _EnglishComparisonSection(errors: feedback.english.errors),
        const SizedBox(height: AppSpacing.xl),
        _DisclaimerBanner(text: l10n.interviewCompareDisclaimer),
        const SizedBox(height: AppSpacing.lg),
        OutlinedButton(
          key: const Key('interview_compare_view_feedback_button'),
          onPressed: () => context.push('/interviews/$interviewId/feedback'),
          child: Text(l10n.interviewCompareViewFeedbackCta),
        ),
      ],
    );
  }
}

/// Una fila por competencia: nivel anterior → nuevo y el estado (Avanzó /
/// Igual / Retrocedió, FR-30) que ya resuelve la API en `trend`.
class _ComparisonRow extends StatelessWidget {
  const _ComparisonRow({required this.item, required this.name});

  final CompetencyComparison item;
  final String name;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    return Container(
      key: Key('interview_compare_competency_${item.competencyId}'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(name, style: theme.titleSmall)),
              _TrendLabel(trend: item.trend),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _LabeledText(
                  label: l10n.interviewCompareBeforeLabel,
                  text: _seniorityLabel(item.before, l10n),
                ),
              ),
              const Icon(
                Icons.arrow_forward,
                size: 16,
                color: AppColors.textMuted,
              ),
              Expanded(
                child: _LabeledText(
                  label: l10n.interviewCompareAfterLabel,
                  text: _seniorityLabel(item.after, l10n),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TrendLabel extends StatelessWidget {
  const _TrendLabel({required this.trend});

  final String trend;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final (label, color) = switch (trend) {
      'up' => (l10n.interviewCompareTrendUp, AppColors.success),
      'down' => (l10n.interviewCompareTrendDown, AppColors.error),
      _ => (l10n.interviewCompareTrendSame, AppColors.textMuted),
    };
    return Text(
      label,
      style: theme.labelSmall?.copyWith(
        color: color,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

class _LabeledText extends StatelessWidget {
  const _LabeledText({required this.label, required this.text});

  final String label;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: theme.labelSmall),
        Text(text, style: theme.bodyMedium),
      ],
    );
  }
}

/// La fila de inglés (FR-30): los errores que siguen repitiéndose en el
/// parecer de la re-entrevista, cada uno con el texto equivocado y su
/// corrección (antes → después).
class _EnglishComparisonSection extends StatelessWidget {
  const _EnglishComparisonSection({required this.errors});

  final List<EnglishErrorItem> errors;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    return Container(
      key: const Key('interview_compare_english'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(l10n.interviewCompareEnglishTitle, style: theme.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          if (errors.isEmpty)
            Text(
              l10n.interviewCompareEnglishEmpty,
              key: const Key('interview_compare_english_empty'),
              style: theme.bodyMedium,
            )
          else
            for (var i = 0; i < errors.length; i++)
              Padding(
                key: Key('interview_compare_english_error_$i'),
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      '${errors[i].original} → ${errors[i].corrected}',
                      style: theme.bodyMedium,
                    ),
                    Text(
                      errors[i].explanation,
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

/// FR-14/FR-30: aviso fijo de que la comparación es orientativa, no una
/// evaluación oficial.
class _DisclaimerBanner extends StatelessWidget {
  const _DisclaimerBanner({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('interview_compare_disclaimer'),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.goldSoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Text(
        text,
        style: Theme.of(context).textTheme.bodySmall
            ?.copyWith(color: AppColors.goldText),
        textAlign: TextAlign.center,
      ),
    );
  }
}

String _seniorityLabel(String code, AppLocalizations l10n) => switch (code) {
  'junior' => l10n.interviewSeniorityJunior,
  'semi_senior' => l10n.interviewSenioritySemiSenior,
  'senior' => l10n.interviewSenioritySenior,
  'staff_lead' => l10n.interviewSeniorityStaffLead,
  _ => code,
};

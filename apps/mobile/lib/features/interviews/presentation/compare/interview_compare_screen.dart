import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/widgets/async_body.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../data/interviews_repository.dart';
import '../interview_widgets.dart';

/// `/interviews/:id/compare` (IE-08, FR-19, FR-30): "Así cambiaste", el
/// parecer de una re-entrevista contra el de la entrevista anterior
/// (`parentInterviewId`). El parecer propio llega en [initialFeedback] desde
/// la pantalla del parecer o se pide con [interviewFeedbackProvider] (la
/// misma carga protegida que el parecer); el de la padre, siempre con ese
/// provider. Sin botón de compartir (FR-28).
class InterviewCompareScreen extends ConsumerWidget {
  const InterviewCompareScreen({
    super.key,
    required this.interviewId,
    this.initialFeedback,
  });

  final String interviewId;

  /// Presente solo si se llegó desde el parecer: "Ver el parecer completo"
  /// vuelve con `pop` en vez de apilar otro.
  final InterviewFeedback? initialFeedback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final AsyncValue<InterviewFeedback?> asyncFeedback = initialFeedback != null
        ? AsyncData(initialFeedback)
        : ref.watch(interviewFeedbackProvider(interviewId));
    void openFeedback() {
      if (initialFeedback != null && context.canPop()) {
        context.pop();
      } else {
        context.pushReplacement('/interviews/$interviewId/feedback');
      }
    }

    return Scaffold(
      appBar: AppBar(title: Text(l10n.interviewCompareTitle)),
      body: SafeArea(
        child: switch (asyncFeedback) {
          AsyncError(error: ApiException(code: ApiErrorCode.notReady)) =>
            InterviewNotFinishedView(interviewId: interviewId),
          AsyncError(:final error, :final stackTrace) => AsyncBody<void>(
            snapshot: AsyncSnapshot.withError(
              ConnectionState.done,
              error,
              stackTrace,
            ),
            onRetry: () =>
                ref.invalidate(interviewFeedbackProvider(interviewId)),
            builder: (_) => const SizedBox.shrink(),
          ),
          AsyncData(value: final feedback?) when feedback.comparison == null =>
            _NoComparisonView(onOpenFeedback: openFeedback),
          AsyncData(value: final feedback?) => _CompareBody(
            interviewId: interviewId,
            feedback: feedback,
            onOpenFeedback: openFeedback,
          ),
          // Cargando o `feedback_pending` (lo repolla `interviewProvider`).
          _ => const Center(child: CircularProgressIndicator()),
        },
      ),
    );
  }
}

/// No es una re-entrevista (o se entró con un link directo): sin titular
/// engañoso, solo el aviso y el camino al parecer.
class _NoComparisonView extends StatelessWidget {
  const _NoComparisonView({required this.onOpenFeedback});

  final VoidCallback onOpenFeedback;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.compare_arrows,
              size: 48,
              color: AppColors.textMuted,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.interviewCompareNoComparison,
              key: const Key('interview_compare_empty'),
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            ElevatedButton(
              key: const Key('interview_compare_view_feedback_button'),
              onPressed: onOpenFeedback,
              child: Text(l10n.interviewCompareViewFeedbackCta),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompareBody extends ConsumerWidget {
  const _CompareBody({
    required this.interviewId,
    required this.feedback,
    required this.onOpenFeedback,
  });

  final String interviewId;
  final InterviewFeedback feedback;
  final VoidCallback onOpenFeedback;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final asyncDetail = ref.watch(interviewProvider(interviewId));
    final parentId = asyncDetail.valueOrNull?.parentInterviewId;
    final asyncParentDetail = parentId == null
        ? null
        : ref.watch(interviewProvider(parentId));
    final asyncParentFeedback = parentId == null
        ? null
        : ref.watch(interviewFeedbackProvider(parentId));
    final parentFeedback = asyncParentFeedback?.valueOrNull;

    // De menor a mayor prioridad: la ficha de la padre, los nombres de los
    // pareceres y la ficha propia.
    final names = <String, String>{
      for (final c
          in asyncParentDetail?.valueOrNull?.competencies ??
              const <InterviewCompetency>[])
        c.id: c.name,
      for (final c in [
        ...?parentFeedback?.competencies,
        ...feedback.competencies,
      ])
        if (c.name != null) c.competencyId: c.name!,
      for (final c
          in asyncDetail.valueOrNull?.competencies ??
              const <InterviewCompetency>[])
        c.id: c.name,
    };
    // El id crudo solo como último recurso, cuando ya no queda nada cargando.
    final namesLoading =
        asyncDetail.isLoading || (asyncParentDetail?.isLoading ?? false);
    // Sin padre o con su parecer fallido no hay "antes": se muestra "–".
    final englishLoading =
        asyncDetail.isLoading ||
        (asyncParentFeedback != null &&
            !asyncParentFeedback.hasError &&
            parentFeedback == null);

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        Text(
          l10n.interviewCompareHeadline,
          key: const Key('interview_compare_headline'),
          style: theme.headlineSmall,
        ),
        const SizedBox(height: AppSpacing.lg),
        for (final item in feedback.comparison!)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: _ComparisonRow(
              item: item,
              name:
                  names[item.competencyId] ??
                  (namesLoading ? null : item.competencyId),
            ),
          ),
        const SizedBox(height: AppSpacing.sm),
        _EnglishComparisonSection(
          before: parentFeedback?.english.errors,
          after: feedback.english.errors,
          loading: englishLoading,
        ),
        const SizedBox(height: AppSpacing.xl),
        InterviewDisclaimerBanner(
          key: const Key('interview_compare_disclaimer'),
          text: l10n.interviewCompareDisclaimer,
        ),
        const SizedBox(height: AppSpacing.lg),
        OutlinedButton(
          key: const Key('interview_compare_view_feedback_button'),
          onPressed: onOpenFeedback,
          child: Text(l10n.interviewCompareViewFeedbackCta),
        ),
      ],
    );
  }
}

/// Una fila por competencia: nivel anterior → nuevo y el estado (Avanzó /
/// Igual / Retrocedió, FR-30) que ya resuelve la API en `trend`. Sin
/// [name] todavía (cargando), un hueco en vez del id crudo.
class _ComparisonRow extends StatelessWidget {
  const _ComparisonRow({required this.item, required this.name});

  final CompetencyComparison item;
  final String? name;

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
              Expanded(
                child: name != null
                    ? Text(name!, style: theme.titleSmall)
                    : Align(
                        alignment: Alignment.centerLeft,
                        child: Container(
                          key: const Key('interview_compare_name_placeholder'),
                          width: 120,
                          height: 14,
                          decoration: BoxDecoration(
                            color: AppColors.border,
                            borderRadius: BorderRadius.circular(AppRadius.md),
                          ),
                        ),
                      ),
              ),
              _TrendLabel(trend: item.trend),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _LabeledText(
                  label: l10n.interviewCompareBeforeLabel,
                  text: seniorityLabel(item.before, l10n),
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
                  text: seniorityLabel(item.after, l10n),
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

/// Texto corregido comparable entre pareceres: sin mayúsculas, espacios de
/// más ni puntuación final.
String _normalizeCorrection(String text) => text
    .toLowerCase()
    .replaceAll(RegExp(r'\s+'), ' ')
    .trim()
    .replaceAll(RegExp(r'[.!?,;:]+$'), '');

/// La fila de inglés (FR-30): cuántos errores había antes → después y cuáles
/// de [after] se repitieron (misma corrección normalizada que en [before]).
/// Sin el parecer anterior ([before] `null`), "–" como antes y sin lista.
class _EnglishComparisonSection extends StatelessWidget {
  const _EnglishComparisonSection({
    required this.before,
    required this.after,
    required this.loading,
  });

  final List<EnglishErrorItem>? before;
  final List<EnglishErrorItem> after;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final previous = before;
    final seen = {
      for (final e in previous ?? const <EnglishErrorItem>[])
        _normalizeCorrection(e.corrected),
    };
    final repeated = [
      for (final e in after)
        if (seen.contains(_normalizeCorrection(e.corrected))) e,
    ];
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
          if (loading)
            const LinearProgressIndicator(
              key: Key('interview_compare_english_loading'),
            )
          else ...[
            Text(
              l10n.interviewCompareEnglishCount(
                previous == null ? '–' : '${previous.length}',
                '${after.length}',
              ),
              key: const Key('interview_compare_english_count'),
              style: theme.bodyMedium,
            ),
            if (previous != null) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                l10n.interviewCompareEnglishRepeatedTitle,
                style: theme.labelSmall,
              ),
              if (repeated.isEmpty)
                Text(
                  l10n.interviewCompareEnglishEmpty,
                  key: const Key('interview_compare_english_empty'),
                  style: theme.bodyMedium,
                )
              else
                for (var i = 0; i < repeated.length; i++)
                  Padding(
                    key: Key('interview_compare_english_error_$i'),
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.xs,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${repeated[i].original} → ${repeated[i].corrected}',
                          style: theme.bodyMedium,
                        ),
                        Text(
                          repeated[i].explanation,
                          style: theme.bodySmall?.copyWith(
                            color: AppColors.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
            ],
          ],
        ],
      ),
    );
  }
}

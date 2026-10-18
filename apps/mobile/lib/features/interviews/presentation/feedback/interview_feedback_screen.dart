import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/errors/api_error_snack_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/providers.dart';
import '../../../../core/widgets/button_spinner.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../data/interviews_repository.dart';
import '../interview_widgets.dart';

bool _isFeedbackFailed(Object? error) =>
    error is ApiException && error.code == ApiErrorCode.llmUnavailable;

/// `/interviews/:id/feedback`: IE-06a (resumen y competencias), IE-06b
/// (inglés), IE-06c (carga), IE-06d (`too_short`) e IE-06e (`feedback_failed`
/// o red). FR-12 a FR-15, FR-26, FR-27. Sin botón de compartir.
class InterviewFeedbackScreen extends ConsumerStatefulWidget {
  const InterviewFeedbackScreen({super.key, required this.interviewId});

  final String interviewId;

  @override
  ConsumerState<InterviewFeedbackScreen> createState() =>
      _InterviewFeedbackScreenState();
}

class _InterviewFeedbackScreenState
    extends ConsumerState<InterviewFeedbackScreen> {
  bool _retrying = false;

  String get interviewId => widget.interviewId;

  /// IE-06e "Reintentar": solo re-encola (`POST /interviews/:id/retry`) si
  /// el parecer falló (`feedback_failed` → `LLM_UNAVAILABLE`); ante un error
  /// de red solo vuelve a pedir. Siempre invalida al terminar. `false` si el
  /// re-encolado falló.
  Future<bool> _retry() async {
    if (_retrying) return false;
    final l10n = AppLocalizations.of(context);
    final requeue = _isFeedbackFailed(
      ref.read(interviewFeedbackProvider(interviewId)).error,
    );
    setState(() => _retrying = true);
    try {
      if (requeue) {
        await ref.read(interviewsRepositoryProvider).retry(interviewId);
      }
      return true;
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(apiErrorSnackBar(context, e.code));
      }
      return false;
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text(l10n.errorGeneric)));
      }
      return false;
    } finally {
      if (mounted) {
        ref.invalidate(interviewProvider(interviewId));
        ref.invalidate(interviewFeedbackProvider(interviewId));
        setState(() => _retrying = false);
      }
    }
  }

  /// "Avísame cuando esté listo": con el parecer fallido lo re-encola (el
  /// push de "listo" sale solo cuando el job termina, F12.3.T1) y avisa;
  /// en cualquier otro caso solo sale de la pantalla.
  Future<void> _notifyLater() async {
    final l10n = AppLocalizations.of(context);
    final messenger = ScaffoldMessenger.of(context);
    if (_isFeedbackFailed(
      ref.read(interviewFeedbackProvider(interviewId)).error,
    )) {
      if (!await _retry() || !mounted) return;
      messenger.showSnackBar(
        SnackBar(content: Text(l10n.interviewFeedbackNotifyLaterSnack)),
      );
    }
    if (!mounted) return;
    context.canPop() ? context.pop() : context.go('/interviews');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final asyncFeedback = ref.watch(interviewFeedbackProvider(interviewId));
    return Scaffold(
      appBar: AppBar(title: Text(l10n.interviewFeedbackTitle)),
      body: SafeArea(
        child: asyncFeedback.when(
          data: (feedback) => feedback == null
              ? const _LoadingView()
              : _FeedbackBody(
                  feedback: feedback,
                  // El parecer solo trae `competencyId`; el nombre vive en
                  // la ficha que ya tiene `interviewProvider`.
                  competencyNames: {
                    for (final c
                        in ref
                                .watch(interviewProvider(interviewId))
                                .valueOrNull
                                ?.competencies ??
                            const <InterviewCompetency>[])
                      c.id: c.name,
                  },
                  learnerName:
                      ref.watch(
                        authControllerProvider.select(
                          (s) => s.me?.profile.displayName,
                        ),
                      ) ??
                      '',
                  interviewId: interviewId,
                ),
          loading: () => const _LoadingView(),
          error: (error, _) => switch (error) {
            InterviewTooShort(:final resumable) => _TooShortView(
              resumable: resumable,
              interviewId: interviewId,
            ),
            ApiException(code: ApiErrorCode.notReady) =>
              InterviewNotFinishedView(interviewId: interviewId),
            _ => _FailedView(
              retrying: _retrying,
              onRetry: _retry,
              onNotifyLater: _notifyLater,
            ),
          },
        ),
      ),
    );
  }
}

/// IE-06c: "Armando tu parecer", con el mismo aviso de IE-03 de que se puede
/// salir y se avisa por notificación cuando esté listo.
class _LoadingView extends StatelessWidget {
  const _LoadingView();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.interviewHistoryStatusFeedbackPending,
              key: const Key('interview_feedback_loading_title'),
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
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

/// IE-06d: `too_short`. "Retomar entrevista" solo si `resumable` (la sesión
/// sigue pausada y `POST /interviews/:id/session` la retoma); "Empezar de
/// nuevo" siempre está.
class _TooShortView extends StatelessWidget {
  const _TooShortView({required this.resumable, required this.interviewId});

  final bool resumable;
  final String interviewId;

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
              Icons.hourglass_bottom,
              size: 48,
              color: AppColors.textMuted,
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.interviewFeedbackTooShortTitle,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.interviewFeedbackTooShortBody,
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            if (resumable) ...[
              ElevatedButton(
                key: const Key('interview_feedback_resume_button'),
                onPressed: () =>
                    context.push('/interviews/$interviewId/session'),
                child: Text(l10n.interviewFeedbackResumeCta),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            OutlinedButton(
              key: const Key('interview_feedback_restart_button'),
              // ponytail: `GET /interviews/:id` no devuelve el texto de la
              // oferta original (y `reinterview` exige el ciclo completo,
              // F13), así que "empezar de nuevo" manda a pegarla otra vez en
              // vez de reenviarla sola. Ampliar si la API llega a exponerla.
              onPressed: () => context.push('/interviews/new'),
              child: Text(l10n.interviewFeedbackRestartCta),
            ),
          ],
        ),
      ),
    );
  }
}

/// IE-06e: `feedback_failed` o cualquier error de red al pedir el parecer.
class _FailedView extends StatelessWidget {
  const _FailedView({
    required this.retrying,
    required this.onRetry,
    required this.onNotifyLater,
  });

  final bool retrying;
  final VoidCallback onRetry;
  final VoidCallback onNotifyLater;

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
              l10n.interviewFeedbackFailedTitle,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.interviewFeedbackFailedBody,
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            ElevatedButton(
              key: const Key('interview_feedback_retry_button'),
              onPressed: retrying ? null : onRetry,
              child: retrying ? const ButtonSpinner() : Text(l10n.commonRetry),
            ),
            const SizedBox(height: AppSpacing.md),
            OutlinedButton(
              key: const Key('interview_feedback_notify_later_button'),
              onPressed: retrying ? null : onNotifyLater,
              child: Text(l10n.interviewFeedbackNotifyLaterCta),
            ),
          ],
        ),
      ),
    );
  }
}

/// IE-06a + IE-06b + FR-14 + CTA: el cuerpo normal con el parecer ya listo.
class _FeedbackBody extends StatelessWidget {
  const _FeedbackBody({
    required this.feedback,
    required this.competencyNames,
    required this.learnerName,
    required this.interviewId,
  });

  final InterviewFeedback feedback;
  final Map<String, String> competencyNames;
  final String learnerName;
  final String interviewId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        Text(
          l10n.interviewFeedbackSummaryTitle(learnerName),
          key: const Key('interview_feedback_summary_title'),
          style: theme.headlineSmall,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(feedback.summary, style: theme.bodyMedium),
        const SizedBox(height: AppSpacing.xl),
        for (final competency in feedback.competencies)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.lg),
            child: _CompetencyCard(
              competency: competency,
              name:
                  competencyNames[competency.competencyId] ??
                  competency.name ??
                  competency.competencyId,
            ),
          ),
        Text(l10n.interviewFeedbackEnglishTitle, style: theme.titleMedium),
        const SizedBox(height: AppSpacing.sm),
        _EnglishAspectRow(
          label: l10n.interviewFeedbackClarityLabel,
          aspect: feedback.english.clarity,
        ),
        _EnglishAspectRow(
          label: l10n.interviewFeedbackVocabularyLabel,
          aspect: feedback.english.vocabulary,
        ),
        for (final error in feedback.english.errors)
          _EnglishErrorTile(error: error),
        if (feedback.comparison != null) ...[
          const SizedBox(height: AppSpacing.lg),
          OutlinedButton(
            key: const Key('interview_feedback_view_comparison_button'),
            // El parecer ya cargado viaja en `extra` (la comparación no lo
            // vuelve a pedir) y marca que se llegó desde acá: "Ver el
            // parecer completo" vuelve con `pop` en vez de apilar otro.
            onPressed: () => context.push(
              '/interviews/$interviewId/compare',
              extra: feedback,
            ),
            child: Text(l10n.interviewFeedbackViewComparisonCta),
          ),
        ],
        const SizedBox(height: AppSpacing.xl),
        InterviewDisclaimerBanner(
          key: const Key('interview_feedback_disclaimer'),
          text: l10n.interviewFeedbackDisclaimer,
        ),
        const SizedBox(height: AppSpacing.lg),
        _StartCycleButton(interviewId: interviewId),
      ],
    );
  }
}

/// "Empezar ciclo de estudio": crea el ciclo (`POST /interviews/:id/cycle`,
/// idempotente) y recién entonces navega; la pantalla del ciclo solo lo lee.
class _StartCycleButton extends ConsumerStatefulWidget {
  const _StartCycleButton({required this.interviewId});

  final String interviewId;

  @override
  ConsumerState<_StartCycleButton> createState() => _StartCycleButtonState();
}

class _StartCycleButtonState extends ConsumerState<_StartCycleButton> {
  bool _busy = false;

  Future<void> _start() async {
    setState(() => _busy = true);
    try {
      await ref
          .read(interviewsRepositoryProvider)
          .createCycle(widget.interviewId);
      if (!mounted) return;
      context.push('/interviews/${widget.interviewId}/cycle');
    } on ApiException catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(apiErrorSnackBar(context, e.code));
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppLocalizations.of(context).errorGeneric)),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => ElevatedButton(
    key: const Key('interview_feedback_start_cycle_button'),
    onPressed: _busy ? null : _start,
    child: _busy
        ? const ButtonSpinner()
        : Text(AppLocalizations.of(context).interviewFeedbackStartCycleCta),
  );
}

/// Una tarjeta por competencia (IE-06a): observado vs. esperado, la cita
/// literal del candidato, "Qué faltó" (vacío si la respuesta ya estuvo
/// completa) y "Qué estudiar", con el badge "Verificado" cuando el agente
/// confirmó la afirmación técnica con una búsqueda (FR-15).
class _CompetencyCard extends StatelessWidget {
  const _CompetencyCard({required this.competency, required this.name});

  final CompetencyFeedback competency;
  final String name;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    return Container(
      key: Key('interview_feedback_competency_${competency.competencyId}'),
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
              if (competency.verified)
                Chip(
                  key: const Key('interview_feedback_verified_badge'),
                  label: Text(l10n.interviewFeedbackVerifiedBadge),
                  backgroundColor: AppColors.primarySoft,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: _LabeledText(
                  label: l10n.interviewFeedbackObservedLabel,
                  text: seniorityLabel(competency.observedLevel, l10n),
                ),
              ),
              Expanded(
                child: _LabeledText(
                  label: l10n.interviewFeedbackExpectedLabel,
                  text: seniorityLabel(competency.expectedLevel, l10n),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            '“${competency.evidence}”',
            style: theme.bodyMedium?.copyWith(
              fontStyle: FontStyle.italic,
              color: AppColors.textSecondary,
            ),
          ),
          if (competency.missing.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            _LabeledText(
              label: l10n.interviewFeedbackMissingLabel,
              text: competency.missing,
            ),
          ],
          const SizedBox(height: AppSpacing.sm),
          _LabeledText(
            label: l10n.interviewFeedbackStudyLabel,
            text: competency.study,
          ),
        ],
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

/// IE-06b: una fila por aspecto (claridad, vocabulario) con su nivel y nota.
class _EnglishAspectRow extends StatelessWidget {
  const _EnglishAspectRow({required this.label, required this.aspect});

  final String label;
  final EnglishAspect aspect;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(width: 96, child: Text(label, style: theme.labelSmall)),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _englishRatingLabel(aspect.rating, l10n),
                  style: theme.bodyMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
                ),
                Text(aspect.note, style: theme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// IE-06b: un error de inglés con su corrección y por qué (`englishErrors`
/// del turno, filtrados por el agente para no marcar errores de
/// transcripción, FR-35).
class _EnglishErrorTile extends StatelessWidget {
  const _EnglishErrorTile({required this.error});

  final EnglishErrorItem error;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '${error.original} → ${error.corrected}',
            style: theme.bodyMedium,
          ),
          Text(
            error.explanation,
            style: theme.bodySmall?.copyWith(color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }
}

String _englishRatingLabel(String rating, AppLocalizations l10n) =>
    switch (rating) {
      'very_good' => l10n.interviewEnglishRatingVeryGood,
      'good' => l10n.interviewEnglishRatingGood,
      'fair' => l10n.interviewEnglishRatingFair,
      'needs_work' => l10n.interviewEnglishRatingNeedsWork,
      _ => rating,
    };

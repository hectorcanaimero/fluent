import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Piezas de presentación compartidas por preparación, parecer y
/// comparación del simulador de entrevistas.

String seniorityLabel(String code, AppLocalizations l10n) => switch (code) {
  'junior' => l10n.interviewSeniorityJunior,
  'semi_senior' => l10n.interviewSenioritySemiSenior,
  'senior' => l10n.interviewSenioritySenior,
  'staff_lead' => l10n.interviewSeniorityStaffLead,
  _ => code,
};

/// FR-14/FR-30: aviso fijo de que el parecer o la comparación son
/// orientativos, no una evaluación oficial.
class InterviewDisclaimerBanner extends StatelessWidget {
  const InterviewDisclaimerBanner({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
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

/// `404 NOT_READY`: la entrevista sigue en `preparing`/`ready`/`in_progress`
/// y todavía no hay parecer que pedir; lleva a su ficha.
class InterviewNotFinishedView extends StatelessWidget {
  const InterviewNotFinishedView({super.key, required this.interviewId});

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
            const Icon(Icons.schedule, size: 48, color: AppColors.textMuted),
            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.interviewFeedbackNotFinishedTitle,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            ElevatedButton(
              key: const Key('interview_feedback_open_interview_button'),
              onPressed: () => context.go('/interviews/$interviewId'),
              child: Text(l10n.interviewFeedbackNotFinishedCta),
            ),
          ],
        ),
      ),
    );
  }
}

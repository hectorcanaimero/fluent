import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/widgets/async_body.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../data/interviews_repository.dart';

/// Estado visible de una fila del historial (FR-31). Cada uno tiene su
/// etiqueta y su destino (IE-03/03b/04, el parecer IE-06/06a/08 o el ciclo
/// IE-07).
enum InterviewHistoryStatus {
  preparing,
  prepFailed,
  unfinished,
  finishedNoFeedback,
  feedbackPending,
  feedbackReady,
  feedbackFailed,
  cycle,
  reinterviewDone,
}

typedef InterviewHistoryEntry = ({
  InterviewHistoryStatus status,
  int? cycleSession,
});

/// Un ciclo sin terminar manda sobre todo lo demás, también sobre
/// "Re-entrevista hecha" (FR-29); una re-entrevista con parecer listo se
/// distingue de una entrevista normal (FR-30, IE-08).
@visibleForTesting
InterviewHistoryEntry interviewHistoryStatus(InterviewSummary interview) {
  final completed = interview.cycleCompletedSessions;
  if (completed != null && completed < 5) {
    return (status: InterviewHistoryStatus.cycle, cycleSession: completed + 1);
  }
  final status = switch (interview.status) {
    'preparing' => InterviewHistoryStatus.preparing,
    'prep_failed' => InterviewHistoryStatus.prepFailed,
    'too_short' when !interview.resumable =>
      InterviewHistoryStatus.finishedNoFeedback,
    'feedback_pending' => InterviewHistoryStatus.feedbackPending,
    'feedback_ready' when interview.isReinterview =>
      InterviewHistoryStatus.reinterviewDone,
    'feedback_ready' => InterviewHistoryStatus.feedbackReady,
    'feedback_failed' => InterviewHistoryStatus.feedbackFailed,
    // ready, in_progress, too_short retomable y cualquier estado nuevo: el
    // detalle decide (continuar, empezar o ver el parecer).
    _ => InterviewHistoryStatus.unfinished,
  };
  return (status: status, cycleSession: null);
}

@visibleForTesting
String interviewHistoryRoute(String id, InterviewHistoryStatus status) =>
    switch (status) {
      InterviewHistoryStatus.preparing ||
      InterviewHistoryStatus.prepFailed ||
      InterviewHistoryStatus.unfinished ||
      InterviewHistoryStatus.finishedNoFeedback => '/interviews/$id',
      InterviewHistoryStatus.cycle => '/interviews/$id/cycle',
      InterviewHistoryStatus.feedbackPending ||
      InterviewHistoryStatus.feedbackReady ||
      InterviewHistoryStatus.feedbackFailed ||
      InterviewHistoryStatus.reinterviewDone => '/interviews/$id/feedback',
    };

String _statusLabel(
  AppLocalizations l10n,
  InterviewHistoryEntry entry,
) => switch (entry.status) {
  InterviewHistoryStatus.preparing => l10n.interviewHistoryStatusPreparing,
  InterviewHistoryStatus.prepFailed => l10n.interviewHistoryStatusPrepFailed,
  InterviewHistoryStatus.unfinished => l10n.interviewHistoryStatusUnfinished,
  InterviewHistoryStatus.finishedNoFeedback =>
    l10n.interviewHistoryStatusFinishedNoFeedback,
  InterviewHistoryStatus.feedbackPending =>
    l10n.interviewHistoryStatusFeedbackPending,
  InterviewHistoryStatus.feedbackReady =>
    l10n.interviewHistoryStatusFeedbackReady,
  InterviewHistoryStatus.feedbackFailed =>
    l10n.interviewHistoryStatusFeedbackFailed,
  InterviewHistoryStatus.cycle => l10n.interviewHistoryStatusCycle(
    entry.cycleSession!,
  ),
  InterviewHistoryStatus.reinterviewDone =>
    l10n.interviewHistoryStatusReinterviewDone,
};

/// `/interviews` (IE-09, FR-31): historial agrupado por mes con el botón de
/// nueva entrevista; cada fila navega a la pantalla de su estado.
class InterviewHistoryScreen extends ConsumerWidget {
  const InterviewHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final asyncInterviews = ref.watch(interviewsProvider);
    final snapshot = asyncInterviews.when(
      data: (d) => AsyncSnapshot<List<InterviewSummary>>.withData(
        ConnectionState.done,
        d,
      ),
      error: (e, st) => AsyncSnapshot<List<InterviewSummary>>.withError(
        ConnectionState.done,
        e,
        st,
      ),
      loading: () => const AsyncSnapshot<List<InterviewSummary>>.waiting(),
    );
    // Al volver de una fila o de "nueva entrevista" el estado pudo cambiar
    // (preparación lista, parecer armado): se vuelve a pedir la lista.
    Future<void> open(String route) async {
      await context.push(route);
      if (context.mounted) ref.invalidate(interviewsProvider);
    }

    Future<void> refresh() => ref.refresh(interviewsProvider.future);

    return Scaffold(
      appBar: AppBar(title: Text(l10n.interviewHistoryTitle)),
      floatingActionButton: FloatingActionButton(
        key: const Key('interview_history_new_button'),
        tooltip: l10n.interviewHistoryNewCta,
        onPressed: () => open('/interviews/new'),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: AsyncBody<List<InterviewSummary>>(
          snapshot: snapshot,
          onRetry: () => ref.invalidate(interviewsProvider),
          builder: (interviews) => RefreshIndicator(
            onRefresh: refresh,
            child: interviews.isEmpty
                ? ListView(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    children: [
                      Text(
                        l10n.interviewHistoryEmpty,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  )
                : _HistoryList(interviews: interviews, onOpen: open),
          ),
        ),
      ),
    );
  }
}

/// Mes del grupo; `null` = fecha ilegible ("Fecha desconocida", al final).
class _MonthGroup {
  _MonthGroup(this.month);

  final DateTime? month;
  final List<({InterviewSummary interview, DateTime? date})> rows = [];
}

/// Agrupa conservando el orden de la API (más reciente primero,
/// `interviews_user_created_idx ... created_at desc`): no reordena, solo
/// junta filas del mismo mes. `createdAt` se parsea una sola vez.
List<_MonthGroup> _groupByMonth(List<InterviewSummary> interviews) {
  final groups = <DateTime?, _MonthGroup>{};
  for (final interview in interviews) {
    final date = DateTime.tryParse(interview.createdAt)?.toLocal();
    final month = date == null ? null : DateTime(date.year, date.month);
    groups.putIfAbsent(month, () => _MonthGroup(month)).rows.add((
      interview: interview,
      date: date,
    ));
  }
  final unknown = groups.remove(null);
  return [...groups.values, ?unknown];
}

class _HistoryList extends StatelessWidget {
  const _HistoryList({required this.interviews, required this.onOpen});

  final List<InterviewSummary> interviews;
  final void Function(String route) onOpen;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
    final monthFormat = DateFormat.yMMMM(locale);
    final dayFormat = DateFormat.yMMMd(locale);
    final groups = _groupByMonth(interviews);
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screenPad,
        AppSpacing.md,
        AppSpacing.screenPad,
        AppSpacing.xl + AppSpacing.xl,
      ),
      children: [
        for (final group in groups) ...[
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
            child: Text(
              group.month == null
                  ? l10n.interviewHistoryUnknownDate
                  : monthFormat.format(group.month!),
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          for (final row in group.rows)
            _HistoryRow(
              interview: row.interview,
              date: row.date == null ? null : dayFormat.format(row.date!),
              l10n: l10n,
              onOpen: onOpen,
            ),
        ],
      ],
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({
    required this.interview,
    required this.date,
    required this.l10n,
    required this.onOpen,
  });

  final InterviewSummary interview;
  final String? date;
  final AppLocalizations l10n;
  final void Function(String route) onOpen;

  @override
  Widget build(BuildContext context) {
    final entry = interviewHistoryStatus(interview);
    final typeLabel = interview.type == 'mixed'
        ? l10n.interviewTypeMixed
        : l10n.interviewTypeTechnical;
    final subtitle = [
      if (interview.role != null) interview.role!,
      typeLabel,
      ?date,
    ].join(' · ');
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: ListTile(
        key: Key('interview_history_row_${interview.id}'),
        title: Text(
          interview.company?.name ?? l10n.interviewHistoryCompanyFallback,
        ),
        subtitle: Text(subtitle),
        trailing: Text(_statusLabel(l10n, entry)),
        onTap: () => onOpen(interviewHistoryRoute(interview.id, entry.status)),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/widgets/async_body.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../data/interviews_repository.dart';

/// Estado visible de una fila del historial (FR-31) y la pantalla a la que
/// navega: solo tres destinos posibles (IE-03/03b/04, el parecer IE-06/06a/08
/// o el ciclo IE-07), aunque la API tenga más estados internos.
enum InterviewHistoryStatus { preparing, unfinished, feedbackReady, cycle, reinterviewDone }

typedef InterviewHistoryEntry = ({
  InterviewHistoryStatus status,
  int? cycleSession,
});

/// Un ciclo sin terminar manda sobre el estado de la entrevista (FR-29); una
/// re-entrevista con parecer listo se distingue de una entrevista normal
/// (FR-30, IE-08).
@visibleForTesting
InterviewHistoryEntry interviewHistoryStatus(InterviewSummary interview) {
  if (interview.isReinterview && interview.status == 'feedback_ready') {
    return (status: InterviewHistoryStatus.reinterviewDone, cycleSession: null);
  }
  final completed = interview.cycleCompletedSessions;
  if (completed != null && completed < 5) {
    return (status: InterviewHistoryStatus.cycle, cycleSession: completed + 1);
  }
  return switch (interview.status) {
    'preparing' || 'prep_failed' => (
      status: InterviewHistoryStatus.preparing,
      cycleSession: null,
    ),
    'feedback_ready' => (
      status: InterviewHistoryStatus.feedbackReady,
      cycleSession: null,
    ),
    _ => (status: InterviewHistoryStatus.unfinished, cycleSession: null),
  };
}

@visibleForTesting
String interviewHistoryRoute(String id, InterviewHistoryStatus status) =>
    switch (status) {
      InterviewHistoryStatus.preparing ||
      InterviewHistoryStatus.unfinished => '/interviews/$id',
      InterviewHistoryStatus.cycle => '/interviews/$id/cycle',
      InterviewHistoryStatus.feedbackReady ||
      InterviewHistoryStatus.reinterviewDone => '/interviews/$id/feedback',
    };

String _statusLabel(AppLocalizations l10n, InterviewHistoryEntry entry) =>
    switch (entry.status) {
      InterviewHistoryStatus.preparing => l10n.interviewHistoryStatusPreparing,
      InterviewHistoryStatus.unfinished =>
        l10n.interviewHistoryStatusUnfinished,
      InterviewHistoryStatus.feedbackReady =>
        l10n.interviewHistoryStatusFeedbackReady,
      InterviewHistoryStatus.cycle =>
        l10n.interviewHistoryStatusCycle(entry.cycleSession!),
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
      data: (d) =>
          AsyncSnapshot<List<InterviewSummary>>.withData(ConnectionState.done, d),
      error: (e, st) => AsyncSnapshot<List<InterviewSummary>>.withError(
        ConnectionState.done,
        e,
        st,
      ),
      loading: () => const AsyncSnapshot<List<InterviewSummary>>.waiting(),
    );
    return Scaffold(
      appBar: AppBar(title: Text(l10n.interviewHistoryTitle)),
      floatingActionButton: FloatingActionButton(
        key: const Key('interview_history_new_button'),
        tooltip: l10n.interviewHistoryNewCta,
        onPressed: () => context.push('/interviews/new'),
        child: const Icon(Icons.add),
      ),
      body: SafeArea(
        child: AsyncBody<List<InterviewSummary>>(
          snapshot: snapshot,
          onRetry: () => ref.invalidate(interviewsProvider),
          builder: (interviews) => interviews.isEmpty
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Text(
                      l10n.interviewHistoryEmpty,
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                )
              : _HistoryList(interviews: interviews),
        ),
      ),
    );
  }
}

class _MonthGroup {
  _MonthGroup(this.month, this.interviews);

  final DateTime month;
  final List<InterviewSummary> interviews;
}

/// Agrupa conservando el orden de la API (más reciente primero,
/// `interviews_user_created_idx ... created_at desc`): no reordena, solo
/// junta filas del mismo mes.
List<_MonthGroup> _groupByMonth(List<InterviewSummary> interviews) {
  final byMonth = <DateTime, List<InterviewSummary>>{};
  final order = <DateTime>[];
  for (final interview in interviews) {
    final date =
        DateTime.tryParse(interview.createdAt)?.toLocal() ?? DateTime.now();
    final month = DateTime(date.year, date.month);
    if (!byMonth.containsKey(month)) order.add(month);
    byMonth.putIfAbsent(month, () => []).add(interview);
  }
  return [for (final month in order) _MonthGroup(month, byMonth[month]!)];
}

class _HistoryList extends StatelessWidget {
  const _HistoryList({required this.interviews});

  final List<InterviewSummary> interviews;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final locale = Localizations.localeOf(context).toLanguageTag();
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
              DateFormat.yMMMM(locale).format(group.month),
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          for (final interview in group.interviews)
            _HistoryRow(interview: interview, l10n: l10n, locale: locale),
        ],
      ],
    );
  }
}

class _HistoryRow extends StatelessWidget {
  const _HistoryRow({
    required this.interview,
    required this.l10n,
    required this.locale,
  });

  final InterviewSummary interview;
  final AppLocalizations l10n;
  final String locale;

  @override
  Widget build(BuildContext context) {
    final entry = interviewHistoryStatus(interview);
    final date = DateTime.tryParse(interview.createdAt)?.toLocal();
    final typeLabel = interview.type == 'mixed'
        ? l10n.interviewTypeMixed
        : l10n.interviewTypeTechnical;
    final subtitle = [
      if (interview.role != null) interview.role!,
      typeLabel,
      if (date != null) DateFormat.yMMMd(locale).format(date),
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
        onTap: () =>
            context.push(interviewHistoryRoute(interview.id, entry.status)),
      ),
    );
  }
}

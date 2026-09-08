import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/providers.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Resumen de sesión (SPEC-06 §4.4). El XP/streak/duración vienen del
/// `POST /sessions/:id/end` que ya se llamó desde la conversación (se pasa
/// por `extra` del router, no hay endpoint para volver a pedirlo); las
/// correcciones agrupadas por categoría se piden de nuevo con
/// `GET /sessions/:id` para no tener que arrastrar esa lista completa por
/// la navegación.
class SessionSummaryScreen extends ConsumerStatefulWidget {
  const SessionSummaryScreen({super.key, required this.sessionId, required this.summary});

  final String sessionId;
  final SessionSummary summary;

  @override
  ConsumerState<SessionSummaryScreen> createState() => _SessionSummaryScreenState();
}

class _SessionSummaryScreenState extends ConsumerState<SessionSummaryScreen> {
  late final Future<List<Correction>> _correctionsFuture = ref
      .read(fluentApiProvider)
      .getSession(widget.sessionId)
      .then((d) => d.corrections);

  String get _duration {
    final m = (widget.summary.durationSec ~/ 60).toString().padLeft(2, '0');
    final s = (widget.summary.durationSec % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final summary = widget.summary;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.screenPad),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.xl),
              Text(
                l10n.summaryTitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: AppSpacing.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _StatColumn(
                    label: l10n.summaryXpEarnedLabel,
                    valueBuilder:
                        (context) => TweenAnimationBuilder<int>(
                          tween: IntTween(begin: 0, end: summary.xpEarned),
                          duration: const Duration(milliseconds: 800),
                          builder: (context, value, _) => Text('+$value'),
                        ),
                  ),
                  _StatColumn(
                    label: l10n.summaryStreakLabel,
                    valueBuilder: (context) => Text('${summary.streak}'),
                  ),
                  _StatColumn(
                    label: l10n.summaryDurationLabel,
                    valueBuilder: (context) => Text(_duration),
                  ),
                ],
              ),
              if (summary.isDoubleDay) ...[
                const SizedBox(height: AppSpacing.lg),
                _Banner(text: l10n.summaryDoubleDayBadge, color: AppColors.goldSoft),
              ],
              if (summary.nextIsBoss) ...[
                const SizedBox(height: AppSpacing.md),
                _Banner(text: l10n.summaryNextIsBossBanner, color: AppColors.accentSoft),
              ],
              const SizedBox(height: AppSpacing.xl),
              Text(l10n.summaryCorrectionsTitle, style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              FutureBuilder<List<Correction>>(
                future: _correctionsFuture,
                builder: (context, snapshot) {
                  final corrections = snapshot.data ?? const <Correction>[];
                  if (snapshot.connectionState != ConnectionState.done) {
                    return const Padding(
                      padding: EdgeInsets.symmetric(vertical: AppSpacing.md),
                      child: LinearProgressIndicator(),
                    );
                  }
                  if (corrections.isEmpty) {
                    return Text(
                      l10n.summaryCorrectionsEmpty,
                      style: Theme.of(context).textTheme.bodySmall,
                    );
                  }
                  final byCategory = <String, int>{};
                  for (final c in corrections) {
                    byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
                  }
                  return Column(
                    children: [
                      for (final entry in byCategory.entries)
                        Padding(
                          padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                          child: Row(
                            children: [
                              Expanded(child: Text(entry.key)),
                              Text('${entry.value}'),
                            ],
                          ),
                        ),
                    ],
                  );
                },
              ),
              const SizedBox(height: AppSpacing.xl),
              ElevatedButton(
                key: const Key('summary_back_button'),
                onPressed: () => context.go('/'),
                child: Text(l10n.summaryBackButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatColumn extends StatelessWidget {
  const _StatColumn({required this.label, required this.valueBuilder});

  final String label;
  final WidgetBuilder valueBuilder;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        DefaultTextStyle(
          style: Theme.of(context).textTheme.headlineMedium!.copyWith(color: AppColors.primary),
          child: valueBuilder(context),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(label, style: Theme.of(context).textTheme.bodySmall),
      ],
    );
  }
}

class _Banner extends StatelessWidget {
  const _Banner({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(AppRadius.md)),
      child: Text(text, textAlign: TextAlign.center),
    );
  }
}

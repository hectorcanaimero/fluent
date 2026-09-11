import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  const SessionSummaryScreen({
    super.key,
    required this.sessionId,
    this.summary,
  });

  final String sessionId;

  /// `null` si se llega sin pasar por `_endSession` (MEJ-20) — por ejemplo,
  /// la app se reinició justo en esta ruta. En ese caso no hay forma de
  /// volver a pedir xp/streak/duración reales (SPEC-02 no expone ese
  /// endpoint), así que se arma un resumen best-effort con lo que sí
  /// devuelve `GET /sessions/:id`.
  final SessionSummary? summary;

  @override
  ConsumerState<SessionSummaryScreen> createState() =>
      _SessionSummaryScreenState();
}

class _SessionSummaryScreenState extends ConsumerState<SessionSummaryScreen> {
  late final Future<SessionDetailResult> _detailFuture = ref
      .read(fluentApiProvider)
      .getSession(widget.sessionId);

  /// MAL-28: "primera sesión válida" no viene de la API (no hay un contador
  /// de sesiones totales) — se guarda localmente la primera vez que
  /// `xpEarned > 0`. Memoizado por instancia para no leer/escribir dos
  /// veces si `_buildScaffold` se reconstruye.
  static const _firstValidSessionPrefsKey = 'first_valid_session_done';
  Future<bool>? _isFirstValidSessionFuture;

  Future<bool> _isFirstValidSession(int xpEarned) {
    return _isFirstValidSessionFuture ??= _computeIsFirstValidSession(
      xpEarned,
    );
  }

  Future<bool> _computeIsFirstValidSession(int xpEarned) async {
    if (xpEarned <= 0) return false;
    final prefs = await SharedPreferences.getInstance();
    final alreadyDone = prefs.getBool(_firstValidSessionPrefsKey) ?? false;
    if (alreadyDone) return false;
    await prefs.setBool(_firstValidSessionPrefsKey, true);
    return true;
  }

  SessionSummary _summaryFromDetail(SessionDetailResult detail) {
    final started = DateTime.tryParse(detail.session.startedAt);
    final ended = detail.session.endedAt == null
        ? null
        : DateTime.tryParse(detail.session.endedAt!);
    final durationSec = (started != null && ended != null)
        ? ended.difference(started).inSeconds.clamp(0, 24 * 60 * 60)
        : 0;
    return SessionSummary(
      xpEarned: detail.session.xpEarned ?? 0,
      streak: 0,
      correctionsCount: detail.corrections.length,
      durationSec: durationSec,
    );
  }

  @override
  void initState() {
    super.initState();
    // A esta pantalla solo se llega con la sesión ya cerrada, así que deja de
    // ser la "activa". Sin esto, `computeRedirect` seguía empujando a
    // `/session/:id` y no se podía volver al inicio (MAL-04). Se hace en un
    // post-frame porque tocar el estado del router durante el primer build
    // dispara una redirección en mitad de la construcción del árbol.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      ref
          .read(authControllerProvider.notifier)
          .clearActiveSession(widget.sessionId);
    });
  }

  String _durationFor(SessionSummary summary) {
    final m = (summary.durationSec ~/ 60).toString().padLeft(2, '0');
    final s = (summary.durationSec % 60).toString().padLeft(2, '0');
    return '$m:$s';
  }

  @override
  Widget build(BuildContext context) {
    final explicitSummary = widget.summary;
    if (explicitSummary != null) {
      return _buildScaffold(
        context,
        summary: explicitSummary,
        correctionsFuture: _detailFuture.then((d) => d.corrections),
      );
    }
    return FutureBuilder<SessionDetailResult>(
      future: _detailFuture,
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        final detail = snapshot.data!;
        return _buildScaffold(
          context,
          summary: _summaryFromDetail(detail),
          correctionsFuture: Future.value(detail.corrections),
        );
      },
    );
  }

  Widget _buildScaffold(
    BuildContext context, {
    required SessionSummary summary,
    required Future<List<Correction>> correctionsFuture,
  }) {
    final l10n = AppLocalizations.of(context);
    // MAL-28: antes se celebraba igual una sesión demasiado corta para sumar
    // XP/racha — el usuario no entendía por qué el resumen no reflejaba
    // nada. Con `xpEarned == 0` cambia el título y ofrece reintentar ya.
    final tooShort = summary.xpEarned == 0;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.screenPad),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: AppSpacing.xl),
              Text(
                tooShort ? l10n.summaryTooShortTitle : l10n.summaryTitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              if (tooShort) ...[
                const SizedBox(height: AppSpacing.md),
                Text(
                  l10n.summaryTooShortBody,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                ElevatedButton(
                  key: const Key('summary_too_short_retry_button'),
                  onPressed: () => context.go('/session/new'),
                  child: Text(l10n.summaryTooShortRetryButton),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _StatColumn(
                    label: l10n.summaryXpEarnedLabel,
                    valueBuilder: (context) => TweenAnimationBuilder<int>(
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
                    valueBuilder: (context) => Text(_durationFor(summary)),
                  ),
                ],
              ),
              if (summary.isDoubleDay) ...[
                const SizedBox(height: AppSpacing.lg),
                _Banner(
                  text: l10n.summaryDoubleDayBadge,
                  color: AppColors.goldSoft,
                ),
              ],
              if (summary.nextIsBoss) ...[
                const SizedBox(height: AppSpacing.md),
                _Banner(
                  text: l10n.summaryNextIsBossBanner,
                  color: AppColors.accentSoft,
                ),
              ],
              // MAL-28: la primera sesión que sí sumó XP ancla la promesa de
              // memoria del tutor, para que quede claro que esto no termina
              // acá.
              FutureBuilder<bool>(
                future: _isFirstValidSession(summary.xpEarned),
                builder: (context, snapshot) {
                  if (snapshot.data != true) return const SizedBox.shrink();
                  return Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.md),
                    child: _Banner(
                      text: l10n.summaryFirstValidSessionBanner,
                      color: AppColors.primarySoft,
                    ),
                  );
                },
              ),
              const SizedBox(height: AppSpacing.xl),
              Text(
                l10n.summaryCorrectionsTitle,
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: AppSpacing.sm),
              FutureBuilder<List<Correction>>(
                future: correctionsFuture,
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
                          padding: const EdgeInsets.symmetric(
                            vertical: AppSpacing.xs,
                          ),
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
          style: Theme.of(context).textTheme.headlineMedium!
              .copyWith(color: AppColors.primary),
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
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Text(text, textAlign: TextAlign.center),
    );
  }
}

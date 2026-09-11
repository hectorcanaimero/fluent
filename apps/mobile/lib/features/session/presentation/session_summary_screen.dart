import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/providers.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../../settings/data/reminder_prefs.dart';
import '../domain/correction_labels.dart';
import '../domain/session_prefs.dart';

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
  Future<bool>? _isFirstValidSessionFuture;

  Future<bool> _isFirstValidSession(int xpEarned) {
    return _isFirstValidSessionFuture ??= _computeIsFirstValidSession(
      xpEarned,
    );
  }

  Future<bool> _computeIsFirstValidSession(int xpEarned) async {
    if (xpEarned <= 0) return false;
    final prefs = await SharedPreferences.getInstance();
    final alreadyDone = prefs.getBool(kFirstValidSessionPrefsKey) ?? false;
    if (alreadyDone) return false;
    await prefs.setBool(kFirstValidSessionPrefsKey, true);
    return true;
  }

  /// MAL-10: al cerrar la 2ª sesión válida del día ya no tiene sentido
  /// seguir recordándole a alguien que practique hoy — pero mañana el
  /// recordatorio debe seguir sonando (`ReminderService.skipToday`).
  /// Memoizado (efecto de una sola vez por instancia, no por rebuild).
  Future<void>? _maybeSkipTodayReminderFuture;

  Future<void> _maybeSkipTodayReminder(int xpEarned) {
    return _maybeSkipTodayReminderFuture ??= _computeMaybeSkipTodayReminder(
      xpEarned,
    );
  }

  Future<void> _computeMaybeSkipTodayReminder(int xpEarned) async {
    if (xpEarned <= 0) return;
    final sessions = await ref.read(fluentApiProvider).getSessions(limit: 20);
    final today = DateTime.now();
    final validToday = sessions.items.where((s) {
      final started = DateTime.tryParse(s.startedAt);
      return (s.xpEarned ?? 0) > 0 &&
          started != null &&
          started.year == today.year &&
          started.month == today.month &&
          started.day == today.day;
    }).length;
    if (validToday < 2) return;
    if (!mounted) return;
    final l10n = AppLocalizations.of(context);
    final (morning, evening) = await loadReminderTimes();
    if (!mounted) return;
    await ref.read(reminderServiceProvider).skipToday(
      morning: morning,
      evening: evening,
      title: l10n.settingsReminderNotificationTitle,
      body: l10n.settingsReminderNotificationBody,
    );
  }

  /// MEJ-07: no hay un "antes/después" de nivel en la respuesta de la API —
  /// se reconstruye comparando el XP antes de esta sesión (`progress.xp -
  /// xpEarned`) contra el piso del nivel actual (`progress.level.min`): si
  /// ese piso queda entre los dos, se cruzó durante esta sesión.
  late final Future<ProgressResult> _progressFuture = ref
      .read(fluentApiProvider)
      .getProgress();
  late final Future<MeResponse> _meFuture = ref.read(fluentApiProvider).getMe();

  bool _leveledUp(ProgressResult progress, int xpEarned) {
    final xpBefore = progress.xp - xpEarned;
    return xpBefore < progress.level.min && progress.level.min <= progress.xp;
  }

  final _shareCardKey = GlobalKey();
  bool _sharingStreak = false;

  Future<void> _shareStreak() async {
    if (_sharingStreak) return;
    setState(() => _sharingStreak = true);
    try {
      final boundary =
          _shareCardKey.currentContext?.findRenderObject()
              as RenderRepaintBoundary?;
      if (boundary == null) return;
      final image = await boundary.toImage(pixelRatio: 3);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) return;
      final bytes = byteData.buffer.asUint8List();
      await ref
          .read(shareServiceProvider)
          .shareImage(bytes, fileName: 'fluent-racha.png');
    } finally {
      if (mounted) setState(() => _sharingStreak = false);
    }
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
    // MEJ-07: celebración física al llegar al resumen — antes solo el XP
    // se animaba, sin ninguna señal más allá de la pantalla.
    HapticFeedback.mediumImpact();
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
                      builder: (context, value, _) =>
                          Text(l10n.summaryXpDelta(value)),
                    ),
                  ),
                  _StatColumn(
                    label: l10n.summaryStreakLabel,
                    // MEJ-07: la llama "prende" con un rebote en vez de
                    // aparecer estática — la única animación de esta
                    // pantalla era la del XP.
                    valueBuilder: (context) => TweenAnimationBuilder<double>(
                      tween: Tween(begin: 0, end: 1),
                      duration: const Duration(milliseconds: 600),
                      curve: Curves.elasticOut,
                      builder: (context, t, child) =>
                          Transform.scale(scale: t, child: child),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(
                            Icons.local_fire_department,
                            color: AppColors.accent,
                          ),
                          Text('${summary.streak}'),
                        ],
                      ),
                    ),
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
              // MAL-10: efecto sin UI propia — solo dispara
              // `ReminderService.skipToday` si corresponde.
              FutureBuilder<void>(
                future: _maybeSkipTodayReminder(summary.xpEarned),
                builder: (context, snapshot) => const SizedBox.shrink(),
              ),
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
              // MEJ-07: aviso de subida de nivel — antes la única señal de
              // progreso de nivel vivía en Progreso, nunca en el momento en
              // que realmente ocurrió.
              FutureBuilder<ProgressResult>(
                future: _progressFuture,
                builder: (context, snapshot) {
                  final progress = snapshot.data;
                  if (progress == null ||
                      !_leveledUp(progress, summary.xpEarned)) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.md),
                    child: _Banner(
                      text: l10n.summaryLevelUpBanner(progress.level.name),
                      color: AppColors.goldSoft,
                    ),
                  );
                },
              ),
              if (summary.streak > 0) ...[
                const SizedBox(height: AppSpacing.xl),
                FutureBuilder<MeResponse>(
                  future: _meFuture,
                  builder: (context, snapshot) {
                    final displayName = snapshot.data?.profile.displayName;
                    if (displayName == null) return const SizedBox.shrink();
                    return Center(
                      child: Column(
                        children: [
                          RepaintBoundary(
                            key: _shareCardKey,
                            child: _StreakShareCard(
                              displayName: displayName,
                              streak: summary.streak,
                              l10n: l10n,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          OutlinedButton.icon(
                            key: const Key('summary_share_streak_button'),
                            onPressed: _sharingStreak ? null : _shareStreak,
                            icon: const Icon(Icons.share),
                            label: Text(l10n.summaryShareStreakButton),
                          ),
                        ],
                      ),
                    );
                  },
                ),
              ],
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
                              Expanded(
                                child: Text(
                                  correctionCategoryLabel(l10n, entry.key),
                                ),
                              ),
                              Text('${entry.value}'),
                            ],
                          ),
                        ),
                    ],
                  );
                },
              ),
              // MAL-24: la sesión de cortesía es de una vez — el resumen es
              // el mejor momento para convertir ese "probaste gratis" en
              // "conectá tu cuenta", con el entusiasmo todavía fresco.
              FutureBuilder<SessionDetailResult>(
                future: _detailFuture,
                builder: (context, snapshot) {
                  if (snapshot.data?.session.courtesy != true) {
                    return const SizedBox.shrink();
                  }
                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.md),
                    child: Column(
                      children: [
                        _Banner(
                          text: l10n.summaryCourtesyBanner,
                          color: AppColors.primarySoft,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        ElevatedButton(
                          key: const Key('summary_connect_provider_button'),
                          onPressed: () => context.go('/providers'),
                          child: Text(l10n.summaryCourtesyConnectButton),
                        ),
                      ],
                    ),
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

/// MEJ-07: tarjeta capturada como PNG (`RepaintBoundary` en
/// `_SessionSummaryScreenState._shareStreak`) para "Compartir tu racha".
class _StreakShareCard extends StatelessWidget {
  const _StreakShareCard({
    required this.displayName,
    required this.streak,
    required this.l10n,
  });

  final String displayName;
  final int streak;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 280,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [AppColors.primary, AppColors.primaryDark],
        ),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Fluent',
            style: TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w700,
              fontSize: 14,
              letterSpacing: 1.2,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          const Icon(
            Icons.local_fire_department,
            color: AppColors.gold,
            size: 64,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            l10n.homeStreakDays(streak),
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            displayName,
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
        ],
      ),
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

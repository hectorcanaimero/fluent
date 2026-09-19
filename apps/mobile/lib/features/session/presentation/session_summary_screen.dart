import 'dart:async';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/providers.dart';
import '../../../core/push/push_service.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/skeleton.dart';
import '../../badges/domain/badge_labels.dart';
import '../../badges/presentation/badge_image.dart';
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
  late Future<SessionDetailResult> _detailFuture = _loadDetail();

  /// Solo se pide si la sesión ganó insignias (para sus imágenes).
  late final Future<List<BadgeItem>> _badgesFuture = ref
      .read(fluentApiProvider)
      .getBadges();

  Future<SessionDetailResult> _loadDetail() =>
      ref.read(fluentApiProvider).getSession(widget.sessionId);

  /// MAL-28: "primera sesión válida" no viene de la API (no hay un contador
  /// de sesiones totales) — se guarda localmente la primera vez que
  /// `xpEarned > 0`. Memoizado por instancia para no leer/escribir dos
  /// veces si `_buildScaffold` se reconstruye.
  Future<bool>? _isFirstValidSessionFuture;

  Future<bool> _isFirstValidSession(int xpEarned) {
    return _isFirstValidSessionFuture ??= _computeIsFirstValidSession(xpEarned);
  }

  Future<bool> _computeIsFirstValidSession(int xpEarned) async {
    if (xpEarned <= 0) return false;
    final prefs = await SharedPreferences.getInstance();
    final alreadyDone = prefs.getBool(kFirstValidSessionPrefsKey) ?? false;
    if (alreadyDone) return false;
    await prefs.setBool(kFirstValidSessionPrefsKey, true);
    ref.invalidate(firstValidSessionDoneProvider);
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
    await ref
        .read(reminderServiceProvider)
        .skipToday(
          morning: morning,
          evening: evening,
          title: l10n.settingsReminderNotificationTitle,
          body: l10n.settingsReminderNotificationBody,
        );
  }

  /// MEJ-38: tras la primera sesión válida, ofrecer el recordatorio diario
  /// opt-in a "esta misma hora". Se pregunta una sola vez en la vida de la
  /// instalación (se acepte o no) — persistido por
  /// `markFirstSessionReminderAsked`. Memoizado por instancia, igual que
  /// `_isFirstValidSession`.
  Future<void>? _maybeShowFirstSessionReminderDialogFuture;

  Future<void> _maybeShowFirstSessionReminderDialog(int xpEarned) {
    return _maybeShowFirstSessionReminderDialogFuture ??=
        _computeMaybeShowFirstSessionReminderDialog(xpEarned);
  }

  Future<void> _computeMaybeShowFirstSessionReminderDialog(int xpEarned) async {
    final isFirst = await _isFirstValidSession(xpEarned);
    if (!isFirst) return;
    if (await hasAskedFirstSessionReminder()) return;
    await markFirstSessionReminderAsked();
    if (!mounted) return;
    final l10n = AppLocalizations.of(context);
    final accepted = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.firstSessionReminderDialogTitle),
        content: Text(l10n.firstSessionReminderDialogBody),
        actions: [
          TextButton(
            key: const Key('first_session_reminder_decline_button'),
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.firstSessionReminderDecline),
          ),
          ElevatedButton(
            key: const Key('first_session_reminder_accept_button'),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.firstSessionReminderAccept),
          ),
        ],
      ),
    );
    if (accepted != true) return;
    if (!mounted) return;
    // MAL-10: pedir el permiso no debería bloquear programar el
    // recordatorio — si el plugin tarda o no está disponible (por ejemplo,
    // en tests), igual se programa; sin permiso, el SO simplemente no lo
    // mostrará.
    // Un solo pedido de permiso para recordatorios y push: el sistema
    // pregunta una vez y `enable()` ya no vuelve a preguntar.
    unawaited(
      Permission.notification
          .request()
          .catchError((_) => PermissionStatus.denied)
          .then((_) => ref.read(pushServiceProvider).enable())
          .catchError((_) {}),
    );
    await ref
        .read(reminderServiceProvider)
        .scheduleAtHour(
          time: TimeOfDay.now(),
          title: l10n.settingsReminderNotificationTitle,
          body: l10n.settingsReminderNotificationBody,
        );
  }

  /// MEJ-39: al cerrar cada sesión válida, cancelar el aviso de "racha en
  /// riesgo" de hoy (ya no hace falta) y programar el de mañana 20:30 con
  /// el streak/gracia actuales. Controlado por el switch "Alerta de racha"
  /// de Ajustes (`loadStreakAlertEnabled`).
  Future<void>? _maybeScheduleStreakDangerFuture;

  Future<void> _maybeScheduleStreakDanger(int xpEarned) {
    return _maybeScheduleStreakDangerFuture ??=
        _computeMaybeScheduleStreakDanger(xpEarned);
  }

  Future<void> _computeMaybeScheduleStreakDanger(int xpEarned) async {
    if (xpEarned <= 0) return;
    if (!await loadStreakAlertEnabled()) return;
    if (!mounted) return;
    final l10n = AppLocalizations.of(context);
    final progress = await _progressFuture;
    if (!mounted) return;
    final reminder = ref.read(reminderServiceProvider);
    await reminder.cancelStreakDanger();
    final now = DateTime.now();
    final fireAt = DateTime(
      now.year,
      now.month,
      now.day,
      20,
      30,
    ).add(const Duration(days: 1));
    final body = progress.grace == 'available'
        ? l10n.streakDangerGraceBody
        : l10n.streakDangerBody(progress.streak);
    await reminder.scheduleStreakDanger(
      fireAt: fireAt,
      title: l10n.settingsReminderNotificationTitle,
      body: body,
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
    // La vibración de la celebración (MEJ-07) la dispara `_Celebration`
    // cuando llega el XP, y no la hay si la sesión fue demasiado corta.
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
        final detail = snapshot.data;
        if (detail != null &&
            snapshot.connectionState == ConnectionState.done) {
          return _buildScaffold(
            context,
            summary: _summaryFromDetail(detail),
            correctionsFuture: Future.value(detail.corrections),
          );
        }
        // Sin el resumen en `extra` (p. ej. tras reiniciar la app) la carga
        // puede fallar: antes el spinner giraba para siempre, sin salida.
        return Scaffold(
          appBar: AppBar(
            leading: CloseButton(onPressed: () => context.go('/')),
          ),
          body: AsyncBody<SessionDetailResult>(
            snapshot: snapshot,
            onRetry: () => setState(() {
              _detailFuture = _loadDetail();
            }),
            skeleton: (context) => const _SummarySkeleton(),
            builder: (_) => const SizedBox.shrink(),
          ),
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
              const SizedBox(height: AppSpacing.lg),
              _Celebration(
                title: tooShort
                    ? l10n.summaryTooShortTitle
                    : summary.correctionsCount == 0
                    ? l10n.summaryTitleNoCorrections
                    : l10n.summaryTitle,
                summary: summary,
                duration: _durationFor(summary),
                tooShort: tooShort,
                badgesFuture: summary.newBadges.isEmpty ? null : _badgesFuture,
              ),
              if (tooShort) ...[
                const SizedBox(height: AppSpacing.lg),
                Text(
                  l10n.summaryTooShortBody,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyLarge
                      ?.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: AppSpacing.md),
                ElevatedButton(
                  key: const Key('summary_too_short_retry_button'),
                  onPressed: () => context.go('/session/new'),
                  child: Text(l10n.summaryTooShortRetryButton),
                ),
              ],
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
              // MEJ-38: efecto sin UI propia — el diálogo opt-in se muestra
              // con `showDialog`, no como parte de este árbol.
              FutureBuilder<void>(
                future: _maybeShowFirstSessionReminderDialog(summary.xpEarned),
                builder: (context, snapshot) => const SizedBox.shrink(),
              ),
              // MEJ-39: efecto sin UI propia — reprograma el aviso de racha
              // en riesgo para mañana.
              FutureBuilder<void>(
                future: _maybeScheduleStreakDanger(summary.xpEarned),
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
                    child: _LevelUpCard(
                      text: l10n.summaryLevelUpBanner(progress.level.name),
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
                    return const Column(
                      children: [SkeletonListTile(), SkeletonListTile()],
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
                      crossAxisAlignment: CrossAxisAlignment.stretch,
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
              if (tooShort)
                OutlinedButton(
                  key: const Key('summary_back_button'),
                  onPressed: () => context.go('/'),
                  child: Text(l10n.summaryBackButton),
                )
              else
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
          // Desde `primaryDark`: el texto blanco sobre `primary` da 3.4:1.
          colors: [AppColors.primaryDark, Color(0xFF075A51)],
        ),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.asset('assets/icon/icon.png', width: 24),
              ),
              const SizedBox(width: AppSpacing.sm),
              const Text(
                'Open Fluent',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 14,
                  letterSpacing: 1.2,
                ),
              ),
            ],
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
            style: const TextStyle(color: Colors.white, fontSize: 14),
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

/// Forma del resumen mientras se recupera la sesión (ruta sin `extra`):
/// título y tres estadísticas.
class _SummarySkeleton extends StatelessWidget {
  const _SummarySkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const Key('summary_skeleton'),
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: const [
        Center(child: SkeletonBox(width: 200, height: 28)),
        SizedBox(height: AppSpacing.xl),
        Row(
          children: [
            Expanded(
              child: SkeletonBox(height: 96, borderRadius: AppRadius.lg),
            ),
            SizedBox(width: AppSpacing.md),
            Expanded(
              child: SkeletonBox(height: 96, borderRadius: AppRadius.lg),
            ),
            SizedBox(width: AppSpacing.md),
            Expanded(
              child: SkeletonBox(height: 96, borderRadius: AppRadius.lg),
            ),
          ],
        ),
        SizedBox(height: AppSpacing.xl),
        SkeletonListTile(),
        SkeletonListTile(),
      ],
    );
  }
}

/// Cabecera del resumen con su coreografía: el check aparece, las tarjetas
/// entran en cascada, el XP cuenta cuando llega su tarjeta (con la
/// vibración justo ahí) y la racha sube +1. Una sesión demasiado corta no
/// se celebra: todo aparece quieto y sin vibrar. Con "reducir movimiento"
/// se salta al estado final.
class _Celebration extends StatefulWidget {
  const _Celebration({
    required this.title,
    required this.summary,
    required this.duration,
    required this.tooShort,
    this.badgesFuture,
  });

  final String title;
  final SessionSummary summary;
  final String duration;
  final bool tooShort;

  /// Catálogo de insignias, para las imágenes de `summary.newBadges`.
  final Future<List<BadgeItem>>? badgesFuture;

  @override
  State<_Celebration> createState() => _CelebrationState();
}

class _CelebrationState extends State<_Celebration>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  );

  static const _xpLands = 0.75;
  bool _hapticDone = false;
  bool _started = false;

  Animation<double> _interval(double begin, double end, [Curve? curve]) =>
      CurvedAnimation(
        parent: _controller,
        curve: Interval(begin, end, curve: curve ?? Curves.easeOutCubic),
      );

  late final _ring = _interval(0, 0.3, Curves.elasticOut);
  late final _titleIn = _interval(0.1, 0.35);
  late final _cards = [
    for (var i = 0; i < 3; i++) _interval(0.3 + i * 0.08, 0.55 + i * 0.08),
  ];
  late final _xp = _interval(0.4, _xpLands);
  late final _streakUp = _interval(0.78, 0.92, Curves.easeOutBack);
  late final _badgesIn = _interval(0.86, 1, Curves.easeOutBack);

  @override
  void initState() {
    super.initState();
    _controller.addListener(() {
      if (!_hapticDone && _controller.value >= _xpLands) {
        _hapticDone = true;
        // MEJ-07: celebración física, en el momento en que llega el XP.
        HapticFeedback.mediumImpact();
      }
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    if (widget.tooShort) {
      _hapticDone = true;
      _controller.value = 1;
    } else if (MediaQuery.disableAnimationsOf(context)) {
      _controller.value = 1;
    } else {
      _controller.forward();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    final summary = widget.summary;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: ScaleTransition(
            scale: _ring,
            child: widget.tooShort
                ? const _HeaderBadge(
                    icon: Icons.hourglass_bottom,
                    background: AppColors.locked,
                    foreground: AppColors.textSecondary,
                  )
                : const _HeaderBadge(
                    icon: Icons.check_rounded,
                    background: AppColors.primaryDark,
                    foreground: Colors.white,
                  ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        FadeTransition(
          opacity: _titleIn,
          child: Column(
            children: [
              Text(
                widget.title,
                textAlign: TextAlign.center,
                style: theme.headlineLarge?.copyWith(fontSize: 26),
              ),
              const SizedBox(height: AppSpacing.xs),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.timer_outlined,
                    size: 16,
                    color: AppColors.textSecondary,
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text(
                    widget.duration,
                    semanticsLabel:
                        '${l10n.summaryDurationLabel} ${widget.duration}',
                    style: theme.bodyLarge?.copyWith(
                      color: AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.xl),
        IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: _CardIn(
                  animation: _cards[0],
                  child: _StatCard(
                    icon: Icons.bolt,
                    tint: AppColors.goldSoft,
                    iconColor: AppColors.goldText,
                    label: l10n.summaryXpEarnedLabel,
                    value: AnimatedBuilder(
                      animation: _xp,
                      builder: (context, _) => Text(
                        l10n.summaryXpDelta(
                          (summary.xpEarned * _xp.value).round(),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _CardIn(
                  animation: _cards[1],
                  child: _StatCard(
                    icon: Icons.edit_outlined,
                    tint: AppColors.primarySoft,
                    iconColor: AppColors.primaryDark,
                    label: l10n.summaryCorrectedLabel,
                    value: Text('${summary.correctionsCount}'),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _CardIn(
                  animation: _cards[2],
                  child: _StatCard(
                    icon: Icons.local_fire_department,
                    tint: AppColors.accentSoft,
                    iconColor: AppColors.accentText,
                    label: l10n.summaryStreakLabel,
                    value: _StreakTicker(
                      streak: summary.streak,
                      // Solo sube si esta sesión la hizo crecer.
                      animation: widget.tooShort || summary.streak == 0
                          ? const AlwaysStoppedAnimation(1.0)
                          : _streakUp,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (summary.newBadges.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xl),
          _NewBadges(
            ids: summary.newBadges,
            future: widget.badgesFuture,
            animation: _badgesIn,
          ),
        ],
      ],
    );
  }
}

class _HeaderBadge extends StatelessWidget {
  const _HeaderBadge({
    required this.icon,
    required this.background,
    required this.foreground,
  });

  final IconData icon;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        key: const Key('summary_header_badge'),
        width: 88,
        height: 88,
        decoration: BoxDecoration(
          color: background,
          shape: BoxShape.circle,
          border: Border.all(
            color: background.withValues(alpha: 0.25),
            width: 8,
          ),
        ),
        child: Icon(icon, size: 44, color: foreground),
      ),
    );
  }
}

/// Entrada de cada tarjeta: fade + subida de 16 px.
class _CardIn extends StatelessWidget {
  const _CardIn({required this.animation, required this.child});

  final Animation<double> animation;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: animation,
      child: SlideTransition(
        position: Tween(
          begin: const Offset(0, 0.15),
          end: Offset.zero,
        ).animate(animation),
        child: child,
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.tint,
    required this.iconColor,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final Color tint;
  final Color iconColor;
  final String label;
  final Widget value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context).textTheme;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Column(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(color: tint, shape: BoxShape.circle),
            child: Icon(icon, size: 20, color: iconColor),
          ),
          const SizedBox(height: AppSpacing.sm),
          // El número se achica antes que desbordar la tarjeta.
          FittedBox(
            fit: BoxFit.scaleDown,
            child: DefaultTextStyle(style: theme.headlineMedium!, child: value),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(label, textAlign: TextAlign.center, style: theme.bodySmall),
        ],
      ),
    );
  }
}

/// La racha pasa de `streak - 1` a `streak` deslizándose hacia arriba.
class _StreakTicker extends StatelessWidget {
  const _StreakTicker({required this.streak, required this.animation});

  final int streak;
  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      builder: (context, _) {
        final t = animation.value;
        if (t >= 1 || streak == 0) return Text('$streak');
        return ClipRect(
          child: Stack(
            children: [
              Opacity(opacity: 0, child: Text('$streak')),
              Transform.translate(
                offset: Offset(0, -24 * t),
                child: Opacity(
                  opacity: (1 - t).clamp(0.0, 1.0),
                  child: Text('${streak - 1}'),
                ),
              ),
              Transform.translate(
                offset: Offset(0, 24 * (1 - t)),
                child: Opacity(
                  opacity: t.clamp(0.0, 1.0),
                  child: Text('$streak'),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Subir de nivel es el momento más raro: tarjeta dorada propia, no un
/// aviso más.
class _LevelUpCard extends StatelessWidget {
  const _LevelUpCard({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('summary_level_up_card'),
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        // Texto `textPrimary` sobre `gold`: 9:1.
        color: AppColors.gold,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: const BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.military_tech,
              color: AppColors.goldText,
              size: 26,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.titleMedium),
          ),
        ],
      ),
    );
  }
}

/// Insignias ganadas al cerrar esta sesión: entran con un rebote al final
/// de la celebración. El nombre se muestra ya; la imagen, cuando llega el
/// catálogo (mientras tanto, un círculo neutro del mismo tamaño).
class _NewBadges extends StatelessWidget {
  const _NewBadges({
    required this.ids,
    required this.future,
    required this.animation,
  });

  final List<String> ids;
  final Future<List<BadgeItem>>? future;
  final Animation<double> animation;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context).textTheme;
    return FutureBuilder<List<BadgeItem>>(
      future: future,
      builder: (context, snapshot) {
        final urls = {for (final b in snapshot.data ?? []) b.id: b.imageUrl};
        return Column(
          key: const Key('summary_new_badges'),
          children: [
            Text(
              l10n.badgesNewUnlocked,
              style: theme.labelLarge?.copyWith(color: AppColors.goldText),
            ),
            const SizedBox(height: AppSpacing.md),
            ScaleTransition(
              scale: animation,
              child: Wrap(
                alignment: WrapAlignment.center,
                spacing: AppSpacing.lg,
                runSpacing: AppSpacing.md,
                children: [
                  for (final id in ids)
                    Semantics(
                      label:
                          '${l10n.badgesNewUnlocked}: ${badgeName(l10n, id)}',
                      excludeSemantics: true,
                      child: SizedBox(
                        width: 96,
                        child: Column(
                          children: [
                            BadgeImage(url: urls[id], size: 72, earned: true),
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              badgeName(l10n, id),
                              textAlign: TextAlign.center,
                              style: theme.labelLarge,
                            ),
                          ],
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../../session/domain/chat_message.dart';
import '../../../session/presentation/conversation_screen.dart';
import '../../data/interviews_repository.dart';

/// `/interviews/:id/session` (IE-05, F12.4.T1): abre o retoma la sesión de
/// entrevista (`POST /interviews/:id/session`, PR #94) y, con el `sessionId`
/// que devuelve, muestra la conversación en `ConversationMode.interview`.
///
/// `409 SESSION_ALREADY_ACTIVE` (hay una sesión normal abierta) y
/// `409 INTERVIEW_NOT_RESUMABLE` (se cerró por tiempo o abandono) tienen su
/// propia pantalla en vez del error genérico; `409 INTERVIEW_NOT_OPENABLE`
/// vuelve al detalle (`/interviews/:id`), que sabe en qué estado quedó;
/// cualquier otro código u error de red cae en Reintentar.
class InterviewSessionScreen extends ConsumerStatefulWidget {
  const InterviewSessionScreen({super.key, required this.interviewId});

  final String interviewId;

  @override
  ConsumerState<InterviewSessionScreen> createState() =>
      _InterviewSessionScreenState();
}

class _InterviewSessionScreenState
    extends ConsumerState<InterviewSessionScreen> {
  late Future<InterviewSessionStart> _future;

  @override
  void initState() {
    super.initState();
    _future = _start();
  }

  Future<InterviewSessionStart> _start() async {
    try {
      return await ref
          .read(interviewsRepositoryProvider)
          .startSession(widget.interviewId);
    } on ApiException catch (e) {
      // Reintentar no la va a abrir: el detalle decide (parecer, too_short…).
      if (e.code == ApiErrorCode.interviewNotOpenable && mounted) {
        context.go('/interviews/${widget.interviewId}');
      }
      rethrow;
    }
  }

  void _retry() => setState(() => _future = _start());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<InterviewSessionStart>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const Scaffold(
            key: Key('interview_session_loading'),
            body: Center(child: CircularProgressIndicator()),
          );
        }
        final error = snapshot.error;
        if (error != null) {
          return _InterviewSessionError(
            error: error,
            interviewId: widget.interviewId,
            onRetry: _retry,
          );
        }
        final start = snapshot.data!;
        return ConversationScreen(
          sessionId: start.sessionId,
          mode: ConversationMode.interview,
          interviewId: widget.interviewId,
          initialInterview: _initialInterview(start),
        );
      },
    );
  }
}

/// Progreso de la apertura: el `interview` de la API o, si no vino, el que
/// se deduce de `answeredCount`/`totalQuestions` (sin tiempo restante).
TurnInterviewInfo? _initialInterview(InterviewSessionStart start) {
  if (start.interview != null) return start.interview;
  final total = start.totalQuestions;
  if (total == null) return null;
  final answered = start.answeredCount ?? 0;
  return TurnInterviewInfo(
    questionIdx: (answered + 1).clamp(1, total),
    totalQuestions: total,
    competency: '',
    remainingSec: 0,
  );
}

class _InterviewSessionError extends StatelessWidget {
  const _InterviewSessionError({
    required this.error,
    required this.interviewId,
    required this.onRetry,
  });

  final Object error;
  final String interviewId;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final err = error;

    final activeRoute = err is ApiException ? err.activeSessionRoute : null;
    if (err is ApiException &&
        err.code == ApiErrorCode.sessionAlreadyActive &&
        activeRoute != null) {
      return _ErrorCard(
        title: l10n.interviewSessionActiveSessionTitle,
        body: l10n.interviewSessionActiveSessionBody,
        ctaKey: const Key('interview_session_active_session_cta'),
        cta: l10n.interviewSessionActiveSessionCta,
        // Si la activa es otra entrevista, se retoma en modo entrevista.
        onPressed: () => context.push(activeRoute),
      );
    }

    if (err is ApiException && err.code == ApiErrorCode.interviewNotResumable) {
      return _ErrorCard(
        title: l10n.interviewSessionNotResumableTitle,
        body: l10n.interviewSessionNotResumableBody,
        ctaKey: const Key('interview_session_not_resumable_cta'),
        cta: l10n.interviewSessionNotResumableBackCta,
        onPressed: () => context.go('/interviews'),
      );
    }

    return _ErrorCard(
      title: l10n.interviewSessionStartErrorGeneric,
      body: l10n.commonLoadErrorBody,
      ctaKey: const Key('interview_session_retry_button'),
      cta: l10n.commonRetry,
      onPressed: onRetry,
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({
    required this.title,
    required this.body,
    required this.ctaKey,
    required this.cta,
    required this.onPressed,
  });

  final String title;
  final String body;
  final Key ctaKey;
  final String cta;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      // Sin AppBar no había forma de salir de un error (salvo el back del
      // sistema): la flecha vuelve atrás o, sin historial, a las entrevistas.
      appBar: AppBar(
        leading: BackButton(
          key: const Key('interview_session_error_back'),
          onPressed: () =>
              context.canPop() ? context.pop() : context.go('/interviews'),
        ),
      ),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: Theme.of(context).textTheme.titleMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                body,
                style: Theme.of(context).textTheme.bodyMedium,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.lg),
              ElevatedButton(
                key: ctaKey,
                onPressed: onPressed,
                child: Text(cta),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

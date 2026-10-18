import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../app/theme.dart';
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
/// propia pantalla en vez del error genérico; cualquier otro código u error
/// de red cae en Reintentar.
class InterviewSessionScreen extends ConsumerStatefulWidget {
  const InterviewSessionScreen({super.key, required this.interviewId});

  final String interviewId;

  @override
  ConsumerState<InterviewSessionScreen> createState() =>
      _InterviewSessionScreenState();
}

class _InterviewSessionScreenState
    extends ConsumerState<InterviewSessionScreen> {
  late Future<String> _future;

  @override
  void initState() {
    super.initState();
    _future = _start();
  }

  Future<String> _start() => ref
      .read(interviewsRepositoryProvider)
      .startSession(widget.interviewId)
      .then((result) => result.sessionId);

  void _retry() => setState(() => _future = _start());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
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
        return ConversationScreen(
          sessionId: snapshot.data!,
          mode: ConversationMode.interview,
          interviewId: widget.interviewId,
        );
      },
    );
  }
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

    if (err is ApiException &&
        err.code == ApiErrorCode.sessionAlreadyActive &&
        err.activeSessionId != null) {
      return _ErrorCard(
        title: l10n.interviewSessionActiveSessionTitle,
        body: l10n.interviewSessionActiveSessionBody,
        ctaKey: const Key('interview_session_active_session_cta'),
        cta: l10n.interviewSessionActiveSessionCta,
        onPressed: () => context.push('/session/${err.activeSessionId}'),
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

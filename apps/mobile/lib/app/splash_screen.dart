import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../features/auth/domain/auth_state.dart';
import '../l10n/gen/app_localizations.dart';

/// Se muestra mientras `AuthController.bootstrap()` resuelve si hay una
/// sesión guardada. El router redirige apenas el estado deja de ser
/// [AuthStatus.unknown].
///
/// Si el arranque falla por algo que no es un 401 —modo avión, timeout, un
/// 5xx— el estado queda en [AuthStatus.error] con los tokens intactos y esta
/// pantalla ofrece reintentar en vez de mandar al login (MAL-03).
class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final status = ref.watch(authControllerProvider).status;

    if (status == AuthStatus.error) {
      return Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.authOfflineTitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineSmall,
                ),
                const SizedBox(height: 12),
                Text(l10n.authOfflineBody, textAlign: TextAlign.center),
                const SizedBox(height: 24),
                FilledButton(
                  key: const Key('splash_retry_button'),
                  onPressed: () =>
                      ref.read(authControllerProvider.notifier).retry(),
                  child: Text(l10n.authRetry),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircularProgressIndicator(),
            const SizedBox(height: 16),
            Text(l10n.splashLoading),
          ],
        ),
      ),
    );
  }
}

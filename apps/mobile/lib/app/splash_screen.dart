import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lottie/lottie.dart';

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
class SplashScreen extends ConsumerStatefulWidget {
  const SplashScreen({super.key});

  @override
  ConsumerState<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends ConsumerState<SplashScreen>
    with SingleTickerProviderStateMixin {
  late final _controller = AnimationController(vsync: this)
    ..addStatusListener((status) {
      if (status == AnimationStatus.completed) _markDone();
    });

  void _markDone() => ref.read(splashDoneProvider.notifier).state = true;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
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
      body: Semantics(
        label: l10n.splashLoading,
        child: Lottie.asset(
          'assets/animations/splash.json',
          key: const Key('splash_animation'),
          controller: _controller,
          // lottie-flutter ignora las fuentes embebidas en un .json y pide
          // 'Plus Jakarta Sans' (con espacios): sin esto el wordmark sale en
          // la fuente del sistema y salta al pasar a la bienvenida.
          delegates: LottieDelegates(
            textStyle: (font) => TextStyle(
              fontFamily: 'PlusJakartaSans',
              fontWeight: switch (font.style) {
                'Medium' => FontWeight.w500,
                'SemiBold' => FontWeight.w600,
                'ExtraBold' => FontWeight.w800,
                _ => null,
              },
            ),
          ),
          onLoaded: (composition) => _controller
            ..duration = composition.duration
            ..forward(),
          // Si el asset no carga, no dejar al usuario atrapado en el splash.
          errorBuilder: (context, error, stack) {
            WidgetsBinding.instance.addPostFrameCallback((_) => _markDone());
            return const SizedBox.shrink();
          },
          fit: BoxFit.cover,
          width: double.infinity,
          height: double.infinity,
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'theme.dart';

import '../l10n/gen/app_localizations.dart';

import '../core/api/models.dart';
import '../core/providers.dart';
import '../features/auth/domain/auth_state.dart';
import '../features/group/presentation/group_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/home/presentation/home_shell.dart';
import '../features/memory/presentation/memory_screen.dart';
import '../features/onboarding/presentation/onboarding_flow.dart';
import '../features/progress/presentation/progress_screen.dart';
import '../features/providers/presentation/providers_screen.dart';
import '../features/session/presentation/conversation_screen.dart';
import '../features/session/presentation/new_session_screen.dart';
import '../features/session/presentation/session_summary_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/welcome/presentation/welcome_screen.dart';
import 'splash_screen.dart';

/// Puente entre `AuthController` (Riverpod) y `GoRouter.refreshListenable`
/// (necesita un [Listenable] plano). Se crea una sola vez; el `ref.listen`
/// de adentro dispara `notifyListeners()` en cada cambio de [AuthState].
class RouterNotifier extends ChangeNotifier {
  RouterNotifier(this._ref) {
    _ref.listen<AuthState>(authControllerProvider, (previous, next) {
      notifyListeners();
    });
    _ref.listen<bool>(splashDoneProvider, (previous, next) {
      notifyListeners();
    });
  }

  final Ref _ref;

  AuthState get authState => _ref.read(authControllerProvider);

  bool get splashDone => _ref.read(splashDoneProvider);
}

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  final notifier = RouterNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

@visibleForTesting
String? computeRedirect(
  AuthState auth,
  String location, {
  bool splashDone = true,
}) {
  if (location == '/splash' && !splashDone) return null;

  // `unknown` (resolviendo) y `error` (hay tokens pero no se pudo comprobar
  // la sesión, MAL-03) van los dos al splash: es la pantalla que muestra o
  // bien el spinner o bien "No pudimos conectar" con **Reintentar**. Mandar
  // un `error` a `/login` obligaría a volver a loguearse por estar sin red.
  if (auth.status == AuthStatus.unknown || auth.status == AuthStatus.error) {
    return location == '/splash' ? null : '/splash';
  }

  final isAuthRoute = location == '/login';

  if (auth.status == AuthStatus.unauthenticated) {
    return isAuthRoute ? null : '/login';
  }

  if (!auth.onboarded) {
    return location.startsWith('/onboarding') ? null : '/onboarding';
  }

  final activeId = auth.activeSessionId;
  if (activeId != null && !location.startsWith('/session/$activeId')) {
    return '/session/$activeId';
  }

  if (isAuthRoute ||
      location == '/splash' ||
      location.startsWith('/onboarding')) {
    return '/';
  }

  return null;
}

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(routerNotifierProvider);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: notifier,
    redirect: (context, state) =>
        computeRedirect(
      notifier.authState,
      state.matchedLocation,
      splashDone: notifier.splashDone,
    ),
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      // Fundido corto: la bienvenida arranca redibujando el logo del último
      // cuadro del splash en el mismo lugar, así que lo compartido queda
      // quieto y solo el lema y los puntos del splash se desvanecen.
      GoRoute(
        path: '/login',
        pageBuilder: (context, state) => CustomTransitionPage(
          key: state.pageKey,
          child: const WelcomeScreen(),
          transitionDuration: WelcomeScreen.handoffDuration,
          transitionsBuilder: (context, animation, _, child) => FadeTransition(
            opacity: CurvedAnimation(parent: animation, curve: Curves.easeOut),
            child: child,
          ),
        ),
      ),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingFlow(),
      ),
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
          GoRoute(
            path: '/group',
            builder: (context, state) => const GroupScreen(),
          ),
          GoRoute(
            path: '/progress',
            builder: (context, state) => const ProgressScreen(),
          ),
        ],
      ),
      GoRoute(
        path: '/session/new',
        builder: (context, state) => const NewSessionScreen(),
      ),
      GoRoute(
        path: '/session/:id',
        builder: (context, state) =>
            ConversationScreen(sessionId: state.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'summary',
            builder: (context, state) => SessionSummaryScreen(
              sessionId: state.pathParameters['id']!,
              // MEJ-20: `extra` no sobrevive un reinicio de la app (por
              // ejemplo, si quedó como última ruta); sin el cast
              // opcional, `state.extra as SessionSummary` reventaba.
              summary: state.extra as SessionSummary?,
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/memory',
        builder: (context, state) => const MemoryScreen(),
      ),
      GoRoute(
        path: '/providers',
        builder: (context, state) => const ProvidersScreen(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
    ],
    errorBuilder: (context, state) => const _NotFoundScreen(),
  );
});

/// Ruta desconocida (MEJ-11): antes era un `PlaceholderScreen` sin salida.
class _NotFoundScreen extends StatelessWidget {
  const _NotFoundScreen();

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.screenPad),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                l10n.notFoundTitle,
                style: Theme.of(context).textTheme.headlineSmall,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(l10n.notFoundBody, textAlign: TextAlign.center),
              const SizedBox(height: AppSpacing.xl),
              ElevatedButton(
                key: const Key('not_found_go_home'),
                onPressed: () => context.go('/'),
                child: Text(l10n.notFoundGoHome),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

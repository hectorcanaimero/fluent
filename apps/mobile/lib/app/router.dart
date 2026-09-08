import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api/models.dart';
import '../core/providers.dart';
import '../core/widgets/placeholder_screen.dart';
import '../features/auth/domain/auth_state.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/auth/presentation/register_screen.dart';
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
import 'splash_screen.dart';

/// Puente entre `AuthController` (Riverpod) y `GoRouter.refreshListenable`
/// (necesita un [Listenable] plano). Se crea una sola vez; el `ref.listen`
/// de adentro dispara `notifyListeners()` en cada cambio de [AuthState].
class RouterNotifier extends ChangeNotifier {
  RouterNotifier(this._ref) {
    _ref.listen<AuthState>(authControllerProvider, (previous, next) {
      notifyListeners();
    });
  }

  final Ref _ref;

  AuthState get authState => _ref.read(authControllerProvider);
}

final routerNotifierProvider = Provider<RouterNotifier>((ref) {
  final notifier = RouterNotifier(ref);
  ref.onDispose(notifier.dispose);
  return notifier;
});

@visibleForTesting
String? computeRedirect(AuthState auth, String location) {
  if (auth.status == AuthStatus.unknown) {
    return location == '/splash' ? null : '/splash';
  }

  final isAuthRoute = location == '/login' || location == '/register';

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

  if (isAuthRoute || location == '/splash' || location.startsWith('/onboarding')) {
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
        computeRedirect(notifier.authState, state.matchedLocation),
    routes: [
      GoRoute(path: '/splash', builder: (context, state) => const SplashScreen()),
      GoRoute(path: '/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(
        path: '/onboarding',
        builder: (context, state) => const OnboardingFlow(),
      ),
      ShellRoute(
        builder: (context, state, child) => HomeShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
          GoRoute(path: '/group', builder: (context, state) => const GroupScreen()),
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
        builder:
            (context, state) =>
                ConversationScreen(sessionId: state.pathParameters['id']!),
        routes: [
          GoRoute(
            path: 'summary',
            builder:
                (context, state) => SessionSummaryScreen(
                  sessionId: state.pathParameters['id']!,
                  summary: state.extra as SessionSummary,
                ),
          ),
        ],
      ),
      GoRoute(path: '/memory', builder: (context, state) => const MemoryScreen()),
      GoRoute(
        path: '/providers',
        builder: (context, state) => const ProvidersScreen(),
      ),
      GoRoute(
        path: '/settings',
        builder: (context, state) => const SettingsScreen(),
      ),
    ],
    errorBuilder:
        (context, state) => const PlaceholderScreen(title: 'Fluent'),
  );
});

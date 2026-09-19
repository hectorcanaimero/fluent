import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../core/push/push_platform.dart';
import '../core/push/push_service.dart';
import '../features/auth/domain/auth_state.dart';
import '../l10n/gen/app_localizations.dart';
import 'router.dart';
import 'theme.dart';

/// Widget raíz. Dispara `AuthController.bootstrap()` una sola vez y expone
/// el `GoRouter` con el tema y la localización de la app. También conecta
/// los push: registra el dispositivo al tener sesión y lleva a la ruta del
/// push tocado.
class FluentApp extends ConsumerStatefulWidget {
  const FluentApp({super.key});

  @override
  ConsumerState<FluentApp> createState() => _FluentAppState();
}

class _FluentAppState extends ConsumerState<FluentApp> {
  final _messengerKey = GlobalKey<ScaffoldMessengerState>();
  final _subs = <StreamSubscription<Object?>>[];

  /// Ruta de un push tocado que espera a que haya sesión y termine el
  /// splash (si no, el router la pisaría al redirigir).
  String? _pendingRoute;
  bool _initialRouteChecked = false;

  PushService get _push => ref.read(pushServiceProvider);

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(authControllerProvider.notifier).bootstrap(),
    );
    ref.listenManual<AuthState>(authControllerProvider, (previous, next) {
      if (next.status == AuthStatus.authenticated &&
          previous?.status != AuthStatus.authenticated) {
        unawaited(_onSignedIn());
      }
      _flushPendingRoute();
    });
    ref.listenManual<bool>(splashDoneProvider, (_, _) => _flushPendingRoute());
    _subs
      ..add(_push.openedRoutes.listen(_openRoute))
      ..add(_push.foregroundMessages.listen(_showForegroundPush));
  }

  @override
  void dispose() {
    for (final sub in _subs) {
      unawaited(sub.cancel());
    }
    super.dispose();
  }

  Future<void> _onSignedIn() async {
    await _push.syncIfPermitted();
    if (_initialRouteChecked) return;
    _initialRouteChecked = true;
    final route = await _push.initialRoute();
    if (route != null) _openRoute(route);
  }

  void _openRoute(String route) {
    _pendingRoute = route;
    _flushPendingRoute();
  }

  void _flushPendingRoute() {
    final route = _pendingRoute;
    if (route == null || !mounted) return;
    final signedIn =
        ref.read(authControllerProvider).status == AuthStatus.authenticated;
    if (!signedIn || !ref.read(splashDoneProvider)) return;
    _pendingRoute = null;
    ref.read(routerProvider).go(route);
  }

  /// Con la app abierta el sistema no muestra el push: se avisa con un
  /// SnackBar que lleva a su ruta.
  void _showForegroundPush(ForegroundPush push) {
    final messenger = _messengerKey.currentState;
    final text = [
      push.title,
      push.body,
    ].whereType<String>().where((t) => t.isNotEmpty).join('\n');
    if (messenger == null || text.isEmpty) return;
    final route = push.route;
    final l10n = AppLocalizations.of(messenger.context);
    messenger.showSnackBar(
      SnackBar(
        content: Text(text),
        action: route == null
            ? null
            : SnackBarAction(
                label: l10n.pushOpenAction,
                onPressed: () => _openRoute(route),
              ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final localeOverride = ref.watch(localeOverrideProvider);

    return MaterialApp.router(
      scaffoldMessengerKey: _messengerKey,
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      theme: AppTheme.light(),
      routerConfig: router,
      locale: localeOverride,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}

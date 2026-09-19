import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/fluent_api.dart';
import '../env.dart';
import '../providers.dart';
import 'push_platform.dart';

/// Rutas a las que puede llevar un push. El servidor manda `data.route`;
/// cualquier otra cosa se ignora (no se navega a lo que diga un payload).
const _allowedRoutes = {'/', '/group', '/progress', '/badges', '/memory'};

String? _safeRoute(String? route) =>
    route != null && _allowedRoutes.contains(route) ? route : null;

/// Push de Firebase Messaging: permiso, registro del token en la API y
/// adónde llevan los push tocados.
class PushService {
  PushService({required PushPlatform platform, required FluentApi api})
    : _platform = platform,
      _api = api;

  final PushPlatform _platform;
  final FluentApi _api;
  String? _token;
  StreamSubscription<String>? _refreshSub;

  /// Pide el permiso (una sola vez, en un buen momento: tras la primera
  /// sesión) y, si lo conceden, registra el dispositivo.
  Future<void> enable() async {
    if (await _platform.requestPermission()) await _register();
  }

  /// Al arrancar con sesión: si el permiso ya estaba concedido (por ejemplo
  /// desde los recordatorios), registra sin preguntar nada.
  Future<void> syncIfPermitted() async {
    if (await _platform.hasPermission()) await _register();
  }

  Future<void> _register() async {
    final token = await _platform.getToken();
    if (token != null) await _send(token);
    _refreshSub ??= _platform.onTokenRefresh.listen(_send);
  }

  Future<void> _send(String token) async {
    try {
      await _api.registerPushToken(token: token, platform: _platform.platform);
      _token = token;
    } catch (error) {
      // Sin red o API caída: se reintenta en el próximo arranque.
      debugPrint('No se pudo registrar el token de push: $error');
    }
  }

  /// Al cerrar sesión, antes de borrar los tokens de auth: este teléfono
  /// deja de recibir push de esa cuenta. Los fallos se ignoran.
  Future<void> unregister() async {
    await _refreshSub?.cancel();
    _refreshSub = null;
    final token = _token ?? await _platform.getToken();
    _token = null;
    if (token == null) return;
    try {
      await _api.unregisterPushToken(token);
    } catch (_) {}
  }

  /// Ruta del push que abrió la app desde cerrada.
  Future<String?> initialRoute() async =>
      _safeRoute(await _platform.initialRoute());

  /// Rutas de push tocados con la app en segundo plano.
  Stream<String> get openedRoutes =>
      _platform.openedRoutes.map(_safeRoute).where((r) => r != null).cast();

  /// Push recibidos con la app abierta (la ruta ya validada).
  Stream<ForegroundPush> get foregroundMessages => _platform.foregroundMessages
      .map((p) => (title: p.title, body: p.body, route: _safeRoute(p.route)));
}

final pushPlatformProvider = Provider<PushPlatform>((ref) {
  // Firebase solo se inicializa en Android/iOS con la API real
  // (`main.dart`); si no está, no hay push.
  if (kIsWeb || Env.useFakeApi || Firebase.apps.isEmpty) {
    return const NoopPushPlatform();
  }
  return FirebasePushPlatform();
});

final pushServiceProvider = Provider<PushService>(
  (ref) => PushService(
    platform: ref.watch(pushPlatformProvider),
    api: ref.watch(fluentApiProvider),
  ),
);

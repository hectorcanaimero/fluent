import 'dart:async';

import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Un push recibido con la app abierta: el servidor ya manda título y
/// cuerpo localizados, y en `data.route` adónde lleva tocarlo.
typedef ForegroundPush = ({String? title, String? body, String? route});

/// Lo que la app necesita de Firebase Messaging, detrás de una interfaz
/// para poder probar [PushService] sin Firebase.
abstract class PushPlatform {
  /// `android` o `ios`, como lo espera `POST /me/push-token`.
  String get platform;

  /// Pide el permiso del sistema (Android 13+: POST_NOTIFICATIONS; iOS:
  /// alertas). Devuelve si quedó concedido.
  Future<bool> requestPermission();

  /// Si el permiso ya está concedido, sin preguntar.
  Future<bool> hasPermission();

  Future<String?> getToken();
  Stream<String> get onTokenRefresh;

  /// Ruta del push que abrió la app desde cerrada, si lo hubo.
  Future<String?> initialRoute();

  /// Rutas de los push tocados con la app en segundo plano.
  Stream<String> get openedRoutes;

  /// Push que llegan con la app en primer plano.
  Stream<ForegroundPush> get foregroundMessages;
}

class FirebasePushPlatform implements PushPlatform {
  FirebaseMessaging get _messaging => FirebaseMessaging.instance;

  static String? _routeOf(RemoteMessage message) =>
      message.data['route'] as String?;

  @override
  String get platform =>
      defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';

  static bool _granted(NotificationSettings settings) =>
      settings.authorizationStatus == AuthorizationStatus.authorized ||
      settings.authorizationStatus == AuthorizationStatus.provisional;

  @override
  Future<bool> requestPermission() async =>
      _granted(await _messaging.requestPermission());

  @override
  Future<bool> hasPermission() async =>
      _granted(await _messaging.getNotificationSettings());

  @override
  Future<String?> getToken() => _messaging.getToken();

  @override
  Stream<String> get onTokenRefresh => _messaging.onTokenRefresh;

  @override
  Future<String?> initialRoute() async {
    final message = await _messaging.getInitialMessage();
    return message == null ? null : _routeOf(message);
  }

  @override
  Stream<String> get openedRoutes => FirebaseMessaging.onMessageOpenedApp
      .map(_routeOf)
      .where((route) => route != null)
      .cast<String>();

  @override
  Stream<ForegroundPush> get foregroundMessages => FirebaseMessaging.onMessage
      .map(
        (m) => (
          title: m.notification?.title,
          body: m.notification?.body,
          route: _routeOf(m),
        ),
      );
}

/// Sin Firebase (web, `USE_FAKE_API`, tests, o si no se pudo inicializar):
/// nada que pedir ni registrar.
class NoopPushPlatform implements PushPlatform {
  const NoopPushPlatform();

  @override
  String get platform => 'android';

  @override
  Future<bool> requestPermission() async => false;

  @override
  Future<bool> hasPermission() async => false;

  @override
  Future<String?> getToken() async => null;

  @override
  Stream<String> get onTokenRefresh => const Stream.empty();

  @override
  Future<String?> initialRoute() async => null;

  @override
  Stream<String> get openedRoutes => const Stream.empty();

  @override
  Stream<ForegroundPush> get foregroundMessages => const Stream.empty();
}

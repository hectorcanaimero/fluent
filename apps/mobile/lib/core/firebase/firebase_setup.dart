import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';

/// Push recibido con la app en segundo plano o cerrada. Tiene que ser una
/// función de nivel superior: Android la corre en un isolate aparte.
@pragma('vm:entry-point')
Future<void> _onBackgroundMessage(RemoteMessage message) async {
  // Las notificaciones con `notification` las muestra el sistema solo; los
  // mensajes de solo datos todavía no se usan.
}

/// Inicializa Firebase (Crashlytics, Analytics, Messaging) con la config
/// nativa: `android/app/google-services.json` e
/// `ios/Runner/GoogleService-Info.plist`. Analytics no necesita más que
/// esto: registra sesiones y pantallas de sistema solo.
///
/// Nunca rompe el arranque: si algo falla, la app sigue sin Firebase.
Future<void> setUpFirebase() async {
  try {
    await Firebase.initializeApp();
  } catch (error) {
    debugPrint('Firebase no disponible: $error');
    return;
  }

  // Crashlytics: errores de Flutter y los asíncronos que no maneja nadie.
  // En debug no se envía nada para no llenar la consola con pruebas.
  final crashlytics = FirebaseCrashlytics.instance;
  await crashlytics.setCrashlyticsCollectionEnabled(!kDebugMode);
  FlutterError.onError = crashlytics.recordFlutterFatalError;
  PlatformDispatcher.instance.onError = (error, stack) {
    crashlytics.recordError(error, stack, fatal: true);
    return true;
  };

  // Messaging: solo el handler de segundo plano. El permiso de
  // notificaciones lo pide la app en su momento (recordatorios), y el
  // token se registra en la API cuando exista ese endpoint.
  FirebaseMessaging.onBackgroundMessage(_onBackgroundMessage);
}

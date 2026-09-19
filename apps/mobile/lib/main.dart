import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/env.dart';
import 'core/firebase/firebase_setup.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Firebase solo en Android/iOS con la API real: en web no hay config
  // nativa y con `USE_FAKE_API` (demos, capturas) no queremos reportes.
  // Si falla (falta el google-services.json, sin red), la app arranca igual.
  if (!kIsWeb && !Env.useFakeApi) {
    await setUpFirebase();
  }
  runApp(const ProviderScope(child: FluentApp()));
}

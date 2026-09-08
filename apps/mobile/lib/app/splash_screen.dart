import 'package:flutter/material.dart';

import '../l10n/gen/app_localizations.dart';

/// Se muestra mientras `AuthController.bootstrap()` resuelve si hay una
/// sesión guardada. El router redirige apenas el estado deja de ser
/// [AuthStatus.unknown].
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
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

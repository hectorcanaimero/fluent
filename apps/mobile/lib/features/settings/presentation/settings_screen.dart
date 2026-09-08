import 'package:flutter/material.dart';

import '../../../core/widgets/placeholder_screen.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Se completa en T8 (`feat(mobile): grupo, progreso y ajustes`).
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PlaceholderScreen(title: l10n.comingSoonTitle);
  }
}

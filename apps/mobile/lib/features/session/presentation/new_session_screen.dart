import 'package:flutter/material.dart';

import '../../../core/widgets/placeholder_screen.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Se completa en T5 (`feat(mobile): home y selección de sesión`).
class NewSessionScreen extends StatelessWidget {
  const NewSessionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PlaceholderScreen(title: l10n.comingSoonTitle);
  }
}

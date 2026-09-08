import 'package:flutter/material.dart';

import '../../../core/widgets/placeholder_screen.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Se completa en T6 (`feat(mobile): pantalla de conversación por voz`).
class ConversationScreen extends StatelessWidget {
  const ConversationScreen({super.key, required this.sessionId});

  final String sessionId;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PlaceholderScreen(title: l10n.comingSoonTitle);
  }
}

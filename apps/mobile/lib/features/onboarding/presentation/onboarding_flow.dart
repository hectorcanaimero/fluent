import 'package:flutter/material.dart';

import '../../../core/widgets/placeholder_screen.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Se completa en T3 (`feat(mobile): onboarding de perfil`).
class OnboardingFlow extends StatelessWidget {
  const OnboardingFlow({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PlaceholderScreen(title: l10n.comingSoonTitle);
  }
}

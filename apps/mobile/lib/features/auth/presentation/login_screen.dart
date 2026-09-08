import 'package:flutter/material.dart';

import '../../../app/theme.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Pantalla de bienvenida (Pen "01 Onboarding · Welcome"). El formulario de
/// email/contraseña y el enlace a registro con código de invitación se
/// agregan en T2 (`feat(mobile): login, registro e invitación`).
class LoginScreen extends StatelessWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.screenPad,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Icon(Icons.forum_rounded, size: 56, color: AppColors.primary),
              const SizedBox(height: AppSpacing.xl),
              Text(
                l10n.loginWelcomeHeadline,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.headlineLarge,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                l10n.loginWelcomeSubtitle,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.xl),
              _Benefit(icon: Icons.chat_bubble_outline, text: l10n.loginBenefit1),
              _Benefit(icon: Icons.newspaper_outlined, text: l10n.loginBenefit2),
              _Benefit(icon: Icons.local_fire_department_outlined, text: l10n.loginBenefit3),
              const SizedBox(height: AppSpacing.xl),
              ElevatedButton(
                key: const Key('login_cta_button'),
                onPressed: () {},
                child: Text(l10n.loginLogInButton),
              ),
              const SizedBox(height: AppSpacing.md),
              TextButton(
                onPressed: () {},
                child: Text(l10n.loginAlreadyHaveAccount),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Benefit extends StatelessWidget {
  const _Benefit({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Icon(icon, color: AppColors.primary),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(text, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}

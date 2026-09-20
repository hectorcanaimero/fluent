import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme.dart';
import '../../../core/providers.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/social_sign_in.dart';

/// Botones de login social para el pie de la bienvenida. Al terminar deja
/// la sesión en `AuthController` y el router hace el resto (onboarding para
/// usuarios nuevos, Home para los que ya estaban).
///
/// Apple va en las dos plataformas: la guía 4.8 de la App Store lo exige
/// cuando la app ofrece otro login social, y en Android el flujo web de
/// InsForge funciona igual.
class SocialLoginButtons extends ConsumerStatefulWidget {
  const SocialLoginButtons({
    super.key,
    this.providers = const [SocialProvider.google, SocialProvider.apple],
  });

  final List<SocialProvider> providers;

  @override
  ConsumerState<SocialLoginButtons> createState() => _SocialLoginButtonsState();
}

class _SocialLoginButtonsState extends ConsumerState<SocialLoginButtons> {
  SocialProvider? _pending;
  String? _errorMessage;

  Future<void> _signIn(SocialProvider provider) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _pending = provider;
      _errorMessage = null;
    });
    try {
      final tokens = await ref.read(socialSignInProvider).signIn(provider);
      if (tokens == null) return; // cerró el navegador: no es un error
      await ref.read(authControllerProvider.notifier).setAuthenticated(tokens);
    } catch (_) {
      if (mounted) setState(() => _errorMessage = l10n.authSignInError);
    } finally {
      if (mounted) setState(() => _pending = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final provider in widget.providers) ...[
          _ProviderButton(
            key: Key('social_login_${provider.name}'),
            provider: provider,
            label: switch (provider) {
              SocialProvider.google => l10n.authContinueWithGoogle,
              SocialProvider.apple => l10n.authContinueWithApple,
            },
            loading: _pending == provider,
            onPressed: _pending == null ? () => _signIn(provider) : null,
          ),
          const SizedBox(height: AppSpacing.sm),
        ],
        if (_errorMessage != null)
          Text(
            _errorMessage!,
            key: const Key('social_login_error'),
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.bodyMedium?.copyWith(color: AppColors.errorText),
          ),
      ],
    );
  }
}

class _ProviderButton extends StatelessWidget {
  const _ProviderButton({
    super.key,
    required this.provider,
    required this.label,
    required this.loading,
    required this.onPressed,
  });

  final SocialProvider provider;
  final String label;
  final bool loading;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    // Guías de marca: Google va en blanco con su "G"; Apple, en negro.
    final isApple = provider == SocialProvider.apple;
    final foreground = isApple ? Colors.white : AppColors.textPrimary;
    return OutlinedButton(
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(52),
        backgroundColor: isApple ? Colors.black : AppColors.surface,
        foregroundColor: foreground,
        side: BorderSide(color: isApple ? Colors.black : AppColors.border),
      ),
      child: loading
          ? SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: foreground),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isApple)
                  const Icon(Icons.apple, size: 22)
                else
                  Image.asset('assets/auth/google_g.png', height: 20, width: 20),
                const SizedBox(width: AppSpacing.sm),
                Flexible(
                  child: Text(label, overflow: TextOverflow.ellipsis),
                ),
              ],
            ),
    );
  }
}

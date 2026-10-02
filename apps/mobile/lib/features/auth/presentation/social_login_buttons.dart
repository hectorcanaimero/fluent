import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme.dart';
import '../../../core/env.dart';
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
        TextButton(
          key: const Key('email_login'),
          onPressed: _pending == null
              ? () => showModalBottomSheet<void>(
                  context: context,
                  isScrollControlled: true,
                  builder: (_) => const _EmailSignInSheet(),
                )
              : null,
          child: Text(l10n.authContinueWithEmail),
        ),
        if (_errorMessage != null)
          Text(
            _errorMessage!,
            key: const Key('social_login_error'),
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodyMedium
                ?.copyWith(color: AppColors.errorText),
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
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: foreground,
              ),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (isApple)
                  const Icon(Icons.apple, size: 22)
                else
                  Image.asset(
                    'assets/auth/google_g.png',
                    height: 20,
                    width: 20,
                  ),
                const SizedBox(width: AppSpacing.sm),
                Flexible(child: Text(label, overflow: TextOverflow.ellipsis)),
              ],
            ),
    );
  }
}

/// Login con email y contraseña, sin registro. Existe para la cuenta demo
/// que piden los revisores de App Store y Google Play.
class _EmailSignInSheet extends ConsumerStatefulWidget {
  const _EmailSignInSheet();

  @override
  ConsumerState<_EmailSignInSheet> createState() => _EmailSignInSheetState();
}

class _EmailSignInSheetState extends ConsumerState<_EmailSignInSheet> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final tokens = Env.useFakeApi
          ? await FakeSocialSignIn().signIn(SocialProvider.google)
          : await ref
                .read(insforgeAuthClientProvider)
                .login(email: _email.text.trim(), password: _password.text);
      await ref.read(authControllerProvider.notifier).setAuthenticated(tokens!);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      if (mounted) setState(() => _error = l10n.authEmailSignInError);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.screenPad,
        AppSpacing.xl,
        AppSpacing.screenPad,
        MediaQuery.viewInsetsOf(context).bottom + AppSpacing.xl,
      ),
      child: AutofillGroup(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            TextField(
              key: const Key('email_login_email'),
              controller: _email,
              decoration: InputDecoration(labelText: l10n.authEmailLabel),
              keyboardType: TextInputType.emailAddress,
              autofillHints: const [AutofillHints.email],
              textInputAction: TextInputAction.next,
            ),
            const SizedBox(height: AppSpacing.md),
            TextField(
              key: const Key('email_login_password'),
              controller: _password,
              decoration: InputDecoration(labelText: l10n.authPasswordLabel),
              obscureText: true,
              autofillHints: const [AutofillHints.password],
              onSubmitted: (_) => _loading ? null : _submit(),
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                _error!,
                key: const Key('email_login_error'),
                style: Theme.of(context).textTheme.bodyMedium
                    ?.copyWith(color: AppColors.errorText),
              ),
            ],
            const SizedBox(height: AppSpacing.lg),
            FilledButton(
              key: const Key('email_login_submit'),
              onPressed: _loading ? null : _submit,
              style: FilledButton.styleFrom(
                minimumSize: const Size.fromHeight(52),
              ),
              child: _loading
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(l10n.authSignIn),
            ),
          ],
        ),
      ),
    );
  }
}

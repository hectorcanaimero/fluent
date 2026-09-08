import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/providers.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Pantalla de bienvenida (Pen "01 Onboarding · Welcome") con el formulario
/// de login agregado en T2. El CTA primario lleva a `/register` (la app es
/// solo por invitación); el enlace "¿Ya tenés una cuenta?" despliega el
/// formulario de email y contraseña en el mismo lugar.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  bool _showForm = false;
  bool _submitting = false;
  String? _errorMessage;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context);
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      final tokens = await ref
          .read(insforgeAuthClientProvider)
          .login(
            email: _emailController.text.trim(),
            password: _passwordController.text,
          );
      await ref.read(authControllerProvider.notifier).setAuthenticated(tokens);
    } on ApiException catch (e) {
      setState(() {
        _errorMessage =
            e.code == ApiErrorCode.unauthenticated
                ? l10n.loginErrorInvalidCredentials
                : l10n.loginErrorGeneric;
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.screenPad,
            vertical: AppSpacing.xl,
          ),
          child: Column(
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
              if (!_showForm) ...[
                ElevatedButton(
                  key: const Key('login_get_started_button'),
                  onPressed: () => context.push('/register'),
                  child: Text(l10n.loginGetStartedButton),
                ),
                const SizedBox(height: AppSpacing.md),
                TextButton(
                  key: const Key('login_show_form_button'),
                  onPressed: () => setState(() => _showForm = true),
                  child: Text(l10n.loginAlreadyHaveAccount),
                ),
              ] else
                Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      TextFormField(
                        key: const Key('login_email_field'),
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        decoration: InputDecoration(labelText: l10n.loginEmailLabel),
                        validator:
                            (value) =>
                                (value == null || value.trim().isEmpty)
                                    ? l10n.formFieldRequired
                                    : null,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextFormField(
                        key: const Key('login_password_field'),
                        controller: _passwordController,
                        obscureText: true,
                        decoration: InputDecoration(labelText: l10n.loginPasswordLabel),
                        validator:
                            (value) =>
                                (value == null || value.isEmpty)
                                    ? l10n.formFieldRequired
                                    : null,
                      ),
                      if (_errorMessage != null) ...[
                        const SizedBox(height: AppSpacing.md),
                        Text(
                          _errorMessage!,
                          style: const TextStyle(color: AppColors.error),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      ElevatedButton(
                        key: const Key('login_submit_button'),
                        onPressed: _submitting ? null : _submit,
                        child:
                            _submitting
                                ? const SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                                : Text(l10n.loginSubmitButton),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      TextButton(
                        onPressed: () => setState(() => _showForm = false),
                        child: Text(l10n.loginBackButton),
                      ),
                    ],
                  ),
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

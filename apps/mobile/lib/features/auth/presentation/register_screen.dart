import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/providers.dart';
import '../../../core/storage/token_store.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Registro con código de invitación (SPEC-06 §3 y §6). Primero crea la
/// cuenta en InsForge y hace login; recién después intenta canjear el
/// código contra la API. Si el canje falla, la cuenta ya existe y queda
/// autenticada localmente (tokens guardados) pero sin flipear el estado
/// global de auth hasta que el usuario reintente el código o decida
/// continuar sin grupo — así el router no navega lejos de esta pantalla
/// mientras se resuelve.
class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _accountFormKey = GlobalKey<FormState>();
  final _codeFormKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _codeController = TextEditingController();

  bool _submitting = false;
  String? _errorMessage;

  /// No nulo cuando la cuenta ya se creó pero el código todavía no se
  /// canjeó (falló o no se intentó).
  AuthTokens? _pendingTokens;
  String? _invitationErrorMessage;

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _submitAccount() async {
    final l10n = AppLocalizations.of(context);
    if (!(_accountFormKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      final tokens = await ref
          .read(insforgeAuthClientProvider)
          .register(
            email: _emailController.text.trim(),
            password: _passwordController.text,
            name: _nameController.text.trim(),
          );
      // Autoriza llamadas a la API sin todavía marcar auth como
      // autenticado globalmente (eso movería el router fuera de acá).
      await ref.read(tokenStoreProvider).write(tokens);
      setState(() => _pendingTokens = tokens);
      await _redeemCode(tokens);
    } on ApiException catch (_) {
      setState(() => _errorMessage = l10n.registerErrorGeneric);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _redeemCode(AuthTokens tokens) async {
    final l10n = AppLocalizations.of(context);
    if (!(_codeFormKey.currentState?.validate() ?? true)) return;
    setState(() {
      _submitting = true;
      _invitationErrorMessage = null;
    });
    try {
      await ref
          .read(fluentApiProvider)
          .redeemInvitation(_codeController.text.trim());
      await ref.read(authControllerProvider.notifier).setAuthenticated(tokens);
    } on ApiException catch (e) {
      setState(() {
        _invitationErrorMessage = switch (e.code) {
          ApiErrorCode.invitationInvalid => l10n.registerErrorInvitationInvalid,
          ApiErrorCode.invitationUsed => l10n.registerErrorInvitationUsed,
          ApiErrorCode.invitationExpired => l10n.registerErrorInvitationExpired,
          _ => l10n.registerErrorGeneric,
        };
      });
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _continueWithoutGroup() async {
    final tokens = _pendingTokens;
    if (tokens == null) return;
    await ref.read(authControllerProvider.notifier).setAuthenticated(tokens);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.registerTitle)),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.screenPad),
          child: _pendingTokens == null ? _buildAccountForm(l10n) : _buildCodeRetry(l10n),
        ),
      ),
    );
  }

  Widget _buildAccountForm(AppLocalizations l10n) {
    return Form(
      key: _accountFormKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextFormField(
            key: const Key('register_name_field'),
            controller: _nameController,
            decoration: InputDecoration(labelText: l10n.registerNameLabel),
            validator:
                (v) => (v == null || v.trim().isEmpty) ? l10n.formFieldRequired : null,
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            key: const Key('register_email_field'),
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            decoration: InputDecoration(labelText: l10n.registerEmailLabel),
            validator:
                (v) => (v == null || v.trim().isEmpty) ? l10n.formFieldRequired : null,
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            key: const Key('register_password_field'),
            controller: _passwordController,
            obscureText: true,
            decoration: InputDecoration(labelText: l10n.registerPasswordLabel),
            validator:
                (v) => (v == null || v.isEmpty) ? l10n.formFieldRequired : null,
          ),
          const SizedBox(height: AppSpacing.md),
          TextFormField(
            key: const Key('register_code_field'),
            controller: _codeController,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(labelText: l10n.registerInvitationCodeLabel),
            validator:
                (v) => (v == null || v.trim().isEmpty) ? l10n.formFieldRequired : null,
          ),
          if (_errorMessage != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(_errorMessage!, style: const TextStyle(color: AppColors.error)),
          ],
          const SizedBox(height: AppSpacing.lg),
          ElevatedButton(
            key: const Key('register_submit_button'),
            onPressed: _submitting ? null : _submitAccount,
            child:
                _submitting
                    ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                    : Text(l10n.registerSubmitButton),
          ),
          const SizedBox(height: AppSpacing.md),
          TextButton(
            onPressed: () => context.pop(),
            child: Text(l10n.registerGoToLogin),
          ),
        ],
      ),
    );
  }

  Widget _buildCodeRetry(AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(l10n.registerInvitationPendingTitle, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: AppSpacing.sm),
        Text(l10n.registerInvitationPendingBody, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: AppSpacing.lg),
        Form(
          key: _codeFormKey,
          child: TextFormField(
            key: const Key('register_retry_code_field'),
            controller: _codeController,
            textCapitalization: TextCapitalization.characters,
            decoration: InputDecoration(labelText: l10n.registerInvitationCodeLabel),
            validator:
                (v) => (v == null || v.trim().isEmpty) ? l10n.formFieldRequired : null,
          ),
        ),
        if (_invitationErrorMessage != null) ...[
          const SizedBox(height: AppSpacing.md),
          Text(_invitationErrorMessage!, style: const TextStyle(color: AppColors.error)),
        ],
        const SizedBox(height: AppSpacing.lg),
        ElevatedButton(
          key: const Key('register_retry_code_button'),
          onPressed: _submitting ? null : () => _redeemCode(_pendingTokens!),
          child:
              _submitting
                  ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                  : Text(l10n.registerInvitationRetryButton),
        ),
        const SizedBox(height: AppSpacing.md),
        TextButton(
          key: const Key('register_skip_invitation_button'),
          onPressed: _submitting ? null : _continueWithoutGroup,
          child: Text(l10n.registerInvitationContinueButton),
        ),
      ],
    );
  }
}

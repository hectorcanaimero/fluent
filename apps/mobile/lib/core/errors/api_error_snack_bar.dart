import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/gen/app_localizations.dart';
import 'api_exception.dart';
import 'l10n_for_api_error.dart';

/// Aviso para un error de la API. Si el problema se resuelve en otra
/// pantalla, el aviso lleva hasta ahí: antes "Conectá tu cuenta de IA" no
/// ofrecía cómo hacerlo.
SnackBar apiErrorSnackBar(BuildContext context, ApiErrorCode code) {
  final l10n = AppLocalizations.of(context);
  final action = switch (code) {
    ApiErrorCode.providerNotConnected => SnackBarAction(
      label: l10n.homeNoProviderAction,
      onPressed: () => context.push('/providers'),
    ),
    _ => null,
  };
  return SnackBar(
    content: Text(l10nForApiError(code, l10n)),
    action: action,
    // Con acción se deja más tiempo para leer y tocar.
    duration: action == null
        ? const Duration(seconds: 4)
        : const Duration(seconds: 8),
  );
}

import 'package:flutter/material.dart';

import '../../l10n/gen/app_localizations.dart';
import 'api_exception.dart';
import 'l10n_for_api_error.dart';

/// Aviso para un error de la API.
SnackBar apiErrorSnackBar(BuildContext context, ApiErrorCode code) {
  final l10n = AppLocalizations.of(context);
  return SnackBar(
    content: Text(l10nForApiError(code, l10n)),
    duration: const Duration(seconds: 4),
  );
}

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/providers.dart';
import '../l10n/gen/app_localizations.dart';
import 'router.dart';
import 'theme.dart';

/// Widget raíz. Dispara `AuthController.bootstrap()` una sola vez y expone
/// el `GoRouter` con el tema y la localización de la app.
class FluentApp extends ConsumerStatefulWidget {
  const FluentApp({super.key});

  @override
  ConsumerState<FluentApp> createState() => _FluentAppState();
}

class _FluentAppState extends ConsumerState<FluentApp> {
  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => ref.read(authControllerProvider.notifier).bootstrap(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final localeOverride = ref.watch(localeOverrideProvider);

    return MaterialApp.router(
      onGenerateTitle: (context) => AppLocalizations.of(context).appTitle,
      theme: AppTheme.light(),
      routerConfig: router,
      locale: localeOverride,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
    );
  }
}

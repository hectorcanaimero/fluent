import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/providers.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Contenedor con la Tab Bar Home · Practicar · Grupo · Progreso
/// (docs/design/README.md). "Practicar" no tiene contenido propio: abre el
/// flujo de nueva sesión. El perfil y los ajustes se abren desde el avatar
/// en la cabecera de Home, no desde esta barra.
class HomeShell extends ConsumerWidget {
  const HomeShell({super.key, required this.child});

  final Widget child;

  static const _tabPaths = ['/', '/session/new', '/group', '/progress'];

  int _indexForLocation(String location) {
    if (location.startsWith('/group')) return 2;
    if (location.startsWith('/progress')) return 3;
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context);
    final location = GoRouterState.of(context).matchedLocation;
    final currentIndex = _indexForLocation(location);

    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: currentIndex,
        onDestinationSelected: (index) async {
          if (index == 1) {
            // MAL-13: sin proveedor activo, "Practicar" manda a conectar
            // uno en vez de abrir el selector de temas (que igual fallaría
            // al intentar crear la sesión). Se espera el valor real: con
            // `valueOrNull ?? true` la primera vez que se toca este tab
            // (antes de que resuelva el `getMe()` de canPracticeProvider)
            // dejaba pasar a alguien sin proveedor.
            final canPractice = await ref.read(canPracticeProvider.future);
            if (!context.mounted) return;
            if (!canPractice) {
              context.go('/providers');
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text(l10n.homeNeedProviderHint)),
              );
              return;
            }
            context.push(_tabPaths[1]);
            return;
          }
          context.go(_tabPaths[index]);
        },
        destinations: [
          NavigationDestination(
            icon: const Icon(Icons.home_outlined),
            selectedIcon: const Icon(Icons.home),
            label: l10n.tabHome,
          ),
          NavigationDestination(
            icon: const Icon(Icons.mic_none_outlined),
            selectedIcon: const Icon(Icons.mic),
            label: l10n.tabPractice,
          ),
          NavigationDestination(
            icon: const Icon(Icons.groups_outlined),
            selectedIcon: const Icon(Icons.groups),
            label: l10n.tabGroup,
          ),
          NavigationDestination(
            icon: const Icon(Icons.trending_up_outlined),
            selectedIcon: const Icon(Icons.trending_up),
            label: l10n.tabProgress,
          ),
        ],
      ),
    );
  }
}

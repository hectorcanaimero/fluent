import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/errors/l10n_for_api_error.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/button_spinner.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/interests_catalog.dart';
import '../domain/interest_labels.dart';

const int _kMinInterests = 3;
const int _kMaxInterests = 5;
const int _kInitialInterestsShown = 8;

/// Onboarding de perfil (SPEC-06 §3): nombre, nivel, intereses. El paso 4
/// no vive acá: al terminar el paso 3 se guarda el perfil con
/// `PUT /me/profile` y se va directo a `/`.
class OnboardingFlow extends ConsumerStatefulWidget {
  const OnboardingFlow({super.key});

  @override
  ConsumerState<OnboardingFlow> createState() => _OnboardingFlowState();
}

enum _Level { beginner, intermediate, advanced }

extension on _Level {
  String get apiValue => switch (this) {
    _Level.beginner => 'A2',
    _Level.intermediate => 'B1',
    _Level.advanced => 'B2',
  };
}

class _OnboardingFlowState extends ConsumerState<OnboardingFlow> {
  // MAL-24: el nombre ya lo pidió el registro — pedirlo de nuevo acá era
  // literalmente la misma pregunta dos veces seguidas. Quedan 2 pasos:
  // nivel (0) e intereses (1).
  static const _totalSteps = 2;

  int _step = 0;
  _Level? _level;
  final Set<String> _selectedInterests = {};
  bool _showAllInterests = false;
  bool _submitting = false;
  String? _errorMessage;
  List<String>? _catalog;

  bool get _canContinueFromStep0 => _level != null;
  bool get _canFinish =>
      _selectedInterests.length >= _kMinInterests &&
      _selectedInterests.length <= _kMaxInterests;

  Future<List<String>> _loadCatalog() async {
    if (_catalog != null) return _catalog!;
    final me = await ref.read(fluentApiProvider).getMe();
    final catalog = me.interestsCatalog.isNotEmpty
        ? me.interestsCatalog
        : kFallbackInterests;
    _catalog = catalog;
    return catalog;
  }

  Future<void> _finish() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _submitting = true;
      _errorMessage = null;
    });
    try {
      final locale = Localizations.localeOf(context);
      final apiLocale = locale.languageCode == 'pt' ? 'pt-BR' : 'es';
      final timezone = await ref.read(timezoneProvider.future);
      // MAL-24: el nombre ya se cargó en el registro — se reenvía tal cual
      // en vez de pedirlo de nuevo (`putProfile` lo requiere igual).
      final displayName =
          ref.read(authControllerProvider).me?.profile.displayName ?? '';
      final result = await ref
          .read(fluentApiProvider)
          .putProfile(
            displayName: displayName,
            level: _level!.apiValue,
            interests: _selectedInterests.toList(),
            timezone: timezone,
            locale: apiLocale,
          );
      await ref.read(authControllerProvider.notifier).refresh();
      if (!mounted) return;
      // MEJ-14: se muestra antes de navegar — una vez que `context.go`
      // reemplaza el árbol, el snackbar de esta pantalla desaparece con él.
      final xpAwarded = result.xpAwarded;
      if (xpAwarded != null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(l10n.onboardingXpAwarded(xpAwarded))),
        );
        await Future.delayed(const Duration(milliseconds: 900));
        if (!mounted) return;
      }
      context.go('/');
    } on ApiException catch (e) {
      setState(() => _errorMessage = l10nForApiError(e.code, l10n));
    } catch (_) {
      setState(() => _errorMessage = l10n.onboardingErrorGeneric);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  void _onPrimaryPressed() {
    switch (_step) {
      case 0:
        if (_canContinueFromStep0) setState(() => _step = 1);
      default:
        if (_canFinish) _finish();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final canContinue = switch (_step) {
      0 => _canContinueFromStep0,
      _ => _canFinish,
    };

    return Scaffold(
      appBar: AppBar(
        leading: _step > 0
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => setState(() => _step -= 1),
              )
            : null,
        // MEJ-14: "Paso n de 2" — antes no había ninguna señal de cuánto
        // faltaba, solo la flecha de volver a partir del segundo paso.
        title: Text(l10n.onboardingStepIndicator(_step + 1, _totalSteps)),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPad),
          child: switch (_step) {
            0 => _LevelStep(
              selected: _level,
              onSelected: (level) => setState(() => _level = level),
            ),
            _ => _InterestsStep(
              loadCatalog: _loadCatalog,
              // MAL-09: si `_loadCatalog` falló (`_catalog` sigue null),
              // reintentar es simplemente volver a pedir el build: la
              // próxima llamada a `loadCatalog()` reintenta el `getMe()`.
              onRetry: () => setState(() {}),
              selected: _selectedInterests,
              showAll: _showAllInterests,
              onShowAll: () => setState(() => _showAllInterests = true),
              onToggle: (id) {
                setState(() {
                  if (_selectedInterests.contains(id)) {
                    _selectedInterests.remove(id);
                  } else if (_selectedInterests.length < _kMaxInterests) {
                    _selectedInterests.add(id);
                  }
                });
              },
            ),
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.screenPad),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_errorMessage != null) ...[
                Text(
                  _errorMessage!,
                  style: Theme.of(context).textTheme.bodyMedium
                      ?.copyWith(color: AppColors.errorText),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              ElevatedButton(
                key: const Key('onboarding_continue_button'),
                onPressed: (canContinue && !_submitting)
                    ? _onPrimaryPressed
                    : null,
                child: _submitting
                    ? const ButtonSpinner()
                    : Text(
                        _step == _totalSteps - 1
                            ? l10n.onboardingFinishButton
                            : l10n.onboardingContinueButton,
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LevelStep extends StatelessWidget {
  const _LevelStep({required this.selected, required this.onSelected});

  final _Level? selected;
  final ValueChanged<_Level> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListView(
      children: [
        const SizedBox(height: AppSpacing.xl),
        Text(
          l10n.onboardingLevelHeadline,
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          l10n.onboardingLevelSubtitle,
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: AppSpacing.lg),
        _LevelCard(
          level: _Level.beginner,
          title: l10n.onboardingLevelBeginnerTitle,
          subtitle: l10n.onboardingLevelBeginnerSubtitle,
          selected: selected,
          onSelected: onSelected,
        ),
        _LevelCard(
          level: _Level.intermediate,
          title: l10n.onboardingLevelIntermediateTitle,
          subtitle: l10n.onboardingLevelIntermediateSubtitle,
          selected: selected,
          onSelected: onSelected,
        ),
        _LevelCard(
          level: _Level.advanced,
          title: l10n.onboardingLevelAdvancedTitle,
          subtitle: l10n.onboardingLevelAdvancedSubtitle,
          selected: selected,
          onSelected: onSelected,
        ),
      ],
    );
  }
}

class _LevelCard extends StatelessWidget {
  const _LevelCard({
    required this.level,
    required this.title,
    required this.subtitle,
    required this.selected,
    required this.onSelected,
  });

  final _Level level;
  final String title;
  final String subtitle;
  final _Level? selected;
  final ValueChanged<_Level> onSelected;

  @override
  Widget build(BuildContext context) {
    final isSelected = selected == level;
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Semantics(
        button: true,
        selected: isSelected,
        label: '$title. $subtitle',
        excludeSemantics: true,
        child: InkWell(
          key: Key('onboarding_level_${level.name}'),
          onTap: () => onSelected(level),
          borderRadius: BorderRadius.circular(AppRadius.lg),
          // `Ink` (no `Container`): el relleno se pinta debajo del ripple.
          child: Ink(
            padding: const EdgeInsets.all(AppSpacing.lg),
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primarySoft : AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(
                color: isSelected ? AppColors.primary : AppColors.border,
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: AppSpacing.xs),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _InterestsStep extends StatelessWidget {
  const _InterestsStep({
    required this.loadCatalog,
    required this.onRetry,
    required this.selected,
    required this.showAll,
    required this.onShowAll,
    required this.onToggle,
  });

  final Future<List<String>> Function() loadCatalog;
  final VoidCallback onRetry;
  final Set<String> selected;
  final bool showAll;
  final VoidCallback onShowAll;
  final ValueChanged<String> onToggle;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FutureBuilder<List<String>>(
      future: loadCatalog(),
      builder: (context, snapshot) {
        return AsyncBody<List<String>>(
          snapshot: snapshot,
          onRetry: onRetry,
          skeleton: (context) => const _InterestsSkeleton(),
          builder: (catalog) {
            final visible = showAll
                ? catalog
                : catalog.take(_kInitialInterestsShown).toList();
            return ListView(
              children: [
                const SizedBox(height: AppSpacing.xl),
                Text(
                  l10n.onboardingInterestsHeadline,
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  l10n.onboardingInterestsSubtitle,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  l10n.onboardingInterestsSelectedCount(selected.length),
                  // `primary` como texto no llega a AA (MEJ-01).
                  style: Theme.of(context).textTheme.labelLarge
                      ?.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    for (final id in visible)
                      _InterestChip(
                        key: Key('onboarding_interest_$id'),
                        label: interestLabel(l10n, id),
                        isSelected: selected.contains(id),
                        onTap: () => onToggle(id),
                      ),
                  ],
                ),
                if (!showAll && catalog.length > _kInitialInterestsShown) ...[
                  const SizedBox(height: AppSpacing.md),
                  TextButton(
                    key: const Key('onboarding_show_more_interests'),
                    onPressed: onShowAll,
                    child: Text(l10n.onboardingInterestsSeeMore),
                  ),
                ],
              ],
            );
          },
        );
      },
    );
  }
}

/// Forma del paso de intereses mientras carga el catálogo: título,
/// subtítulo y chips.
class _InterestsSkeleton extends StatelessWidget {
  const _InterestsSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: AppSpacing.xl),
        const SkeletonBox(width: 220, height: 28),
        const SizedBox(height: AppSpacing.sm),
        const SkeletonBox(height: 16),
        const SizedBox(height: AppSpacing.xl),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final width in const [96.0, 120.0, 84.0, 132.0, 104.0, 90.0])
              SkeletonBox(
                width: width,
                height: 48,
                borderRadius: AppRadius.pill,
              ),
          ],
        ),
      ],
    );
  }
}

class _InterestChip extends StatelessWidget {
  const _InterestChip({
    super.key,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: isSelected,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        // Alto mínimo de 48 dp para el objetivo táctil; `Ink` para que se
        // vea el ripple sobre el relleno.
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 48),
          child: Ink(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
            decoration: BoxDecoration(
              color: isSelected ? AppColors.primarySoft : AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(
                color: isSelected ? AppColors.primary : AppColors.border,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    color: isSelected
                        ? AppColors.primaryDark
                        : AppColors.textPrimary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

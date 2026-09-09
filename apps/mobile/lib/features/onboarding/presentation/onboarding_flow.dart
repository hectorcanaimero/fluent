import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/providers.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/interests_catalog.dart';
import '../domain/interest_labels.dart';

const int _kMinInterests = 3;
const int _kMaxInterests = 5;
const int _kInitialInterestsShown = 8;

/// Onboarding de perfil (SPEC-06 §3): nombre, nivel, intereses. El paso 4
/// ("conectar proveedor") no vive acá: al terminar el paso 3 se guarda el
/// perfil con `PUT /me/profile` y, si el usuario todavía no tiene ningún
/// proveedor conectado, se salta a `/providers`; si ya tiene uno (por
/// ejemplo, en los datos de ejemplo de `FakeApi`), se va directo a `/`.
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
  int _step = 0;
  final _nameController = TextEditingController();
  _Level? _level;
  final Set<String> _selectedInterests = {};
  bool _showAllInterests = false;
  bool _submitting = false;
  String? _errorMessage;
  List<String>? _catalog;

  @override
  void dispose() {
    _nameController.dispose();
    super.dispose();
  }

  bool get _canContinueFromStep0 => _nameController.text.trim().isNotEmpty;
  bool get _canContinueFromStep1 => _level != null;
  bool get _canFinish =>
      _selectedInterests.length >= _kMinInterests &&
      _selectedInterests.length <= _kMaxInterests;

  Future<List<String>> _loadCatalog() async {
    if (_catalog != null) return _catalog!;
    final me = await ref.read(fluentApiProvider).getMe();
    final catalog = me.interestsCatalog.isNotEmpty ? me.interestsCatalog : kFallbackInterests;
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
      await ref
          .read(fluentApiProvider)
          .putProfile(
            displayName: _nameController.text.trim(),
            level: _level!.apiValue,
            interests: _selectedInterests.toList(),
            // TODO(pendiente): no hay paquete de detección de zona horaria
            // IANA en las dependencias de SPEC-06 §1; se usa un valor por
            // defecto hasta agregar uno (ver docs/specs/pendientes/PR-06.md).
            timezone: 'America/Argentina/Buenos_Aires',
            locale: apiLocale,
          );
      await ref.read(authControllerProvider.notifier).refresh();
      if (!mounted) return;
      final me = ref.read(authControllerProvider).me;
      final hasProvider = me?.providers.any((p) => p.status == 'active') ?? false;
      context.go(hasProvider ? '/' : '/providers');
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
      case 1:
        if (_canContinueFromStep1) setState(() => _step = 2);
      default:
        if (_canFinish) _finish();
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final canContinue = switch (_step) {
      0 => _canContinueFromStep0,
      1 => _canContinueFromStep1,
      _ => _canFinish,
    };

    return Scaffold(
      appBar: AppBar(
        leading:
            _step > 0
                ? IconButton(
                  icon: const Icon(Icons.arrow_back),
                  onPressed: () => setState(() => _step -= 1),
                )
                : null,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screenPad),
          child: switch (_step) {
            0 => _NameStep(controller: _nameController, onChanged: () => setState(() {})),
            1 => _LevelStep(
              selected: _level,
              onSelected: (level) => setState(() => _level = level),
            ),
            _ => _InterestsStep(
              loadCatalog: _loadCatalog,
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
            children: [
              if (_errorMessage != null) ...[
                Text(_errorMessage!, style: const TextStyle(color: AppColors.error)),
                const SizedBox(height: AppSpacing.sm),
              ],
              ElevatedButton(
                key: const Key('onboarding_continue_button'),
                onPressed: (canContinue && !_submitting) ? _onPrimaryPressed : null,
                child:
                    _submitting
                        ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                        : Text(_step == 2 ? l10n.onboardingFinishButton : l10n.onboardingContinueButton),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NameStep extends StatelessWidget {
  const _NameStep({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final VoidCallback onChanged;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppSpacing.xl),
        Text(l10n.onboardingNameHeadline, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: AppSpacing.sm),
        Text(l10n.onboardingNameSubtitle, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: AppSpacing.xl),
        TextField(
          key: const Key('onboarding_name_field'),
          controller: controller,
          autofocus: true,
          onChanged: (_) => onChanged(),
          decoration: InputDecoration(labelText: l10n.onboardingNameLabel),
        ),
      ],
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
        Text(l10n.onboardingLevelHeadline, style: Theme.of(context).textTheme.headlineMedium),
        const SizedBox(height: AppSpacing.sm),
        Text(l10n.onboardingLevelSubtitle, style: Theme.of(context).textTheme.bodyMedium),
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
      child: InkWell(
        key: Key('onboarding_level_${level.name}'),
        onTap: () => onSelected(level),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Container(
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
    );
  }
}

class _InterestsStep extends StatelessWidget {
  const _InterestsStep({
    required this.loadCatalog,
    required this.selected,
    required this.showAll,
    required this.onShowAll,
    required this.onToggle,
  });

  final Future<List<String>> Function() loadCatalog;
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
        if (!snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }
        final catalog = snapshot.data!;
        final visible =
            showAll ? catalog : catalog.take(_kInitialInterestsShown).toList();
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
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.primary),
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
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.pill),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg, vertical: AppSpacing.sm),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primarySoft : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.pill),
          border: Border.all(color: isSelected ? AppColors.primary : AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isSelected ? AppColors.primaryDark : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}

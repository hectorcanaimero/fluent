import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../features/onboarding/domain/interest_labels.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Ajustes (Pen "10 Profile" -> `/settings`). Perfil, zona horaria,
/// recordatorios locales (SPEC-06 §8), idioma, cuenta y borrar cuenta.
/// "Fluent Plus" y cuentas conectadas quedan fuera de v1
/// (docs/design/README.md).
class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  late Future<Profile> _future;
  TimeOfDay _morning = const TimeOfDay(hour: 8, minute: 30);
  TimeOfDay _evening = const TimeOfDay(hour: 20, minute: 30);
  bool _streakAlert = true;
  bool _soundEffects = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  void _loadProfile() {
    _future = ref.read(fluentApiProvider).getMe().then((me) => me.profile);
  }

  Future<void> _pickTime({required bool morning}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: morning ? _morning : _evening,
    );
    if (picked == null) return;
    setState(() {
      if (morning) {
        _morning = picked;
      } else {
        _evening = picked;
      }
    });
    await ref
        .read(reminderServiceProvider)
        .scheduleDaily(morning: _morning, evening: _evening);
  }

  void _setLocale(Locale? locale) {
    ref.read(localeOverrideProvider.notifier).state = locale;
  }

  Future<void> _logout() async {
    await ref.read(authControllerProvider.notifier).logout();
  }

  Future<void> _deleteAccount() async {
    final l10n = AppLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.settingsDeleteAccountConfirmTitle),
        content: Text(l10n.settingsDeleteAccountConfirmBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.settingsDeleteAccountCancel),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.error),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.settingsDeleteAccountConfirm),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    await ref.read(fluentApiProvider).deleteAccount();
    await ref.read(authControllerProvider.notifier).logout();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: SafeArea(
        child: FutureBuilder<Profile>(
          future: _future,
          builder: (context, snapshot) {
            return AsyncBody<Profile>(
              snapshot: snapshot,
              onRetry: () => setState(_loadProfile),
              builder: (profile) => ListView(
                padding: const EdgeInsets.all(AppSpacing.screenPad),
                children: [
                  Text(
                    profile.displayName,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    profile.level,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final id in profile.interests)
                        Chip(label: Text(interestLabel(l10n, id))),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    l10n.settingsLanguageTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  _LocaleOption(
                    key: const Key('settings_locale_system'),
                    label: l10n.settingsLanguageSystem,
                    value: null,
                    selected: ref.watch(localeOverrideProvider),
                    onSelected: _setLocale,
                  ),
                  _LocaleOption(
                    key: const Key('settings_locale_es'),
                    label: l10n.settingsLanguageSpanish,
                    value: const Locale('es'),
                    selected: ref.watch(localeOverrideProvider),
                    onSelected: _setLocale,
                  ),
                  _LocaleOption(
                    key: const Key('settings_locale_pt'),
                    label: l10n.settingsLanguagePortuguese,
                    value: const Locale('pt'),
                    selected: ref.watch(localeOverrideProvider),
                    onSelected: _setLocale,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    l10n.settingsRemindersTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  ListTile(
                    key: const Key('settings_morning_reminder'),
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.settingsMorningReminder),
                    trailing: Text(_morning.format(context)),
                    onTap: () => _pickTime(morning: true),
                  ),
                  ListTile(
                    key: const Key('settings_evening_reminder'),
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.settingsEveningReminder),
                    trailing: Text(_evening.format(context)),
                    onTap: () => _pickTime(morning: false),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.settingsStreakAlert),
                    value: _streakAlert,
                    onChanged: (v) => setState(() => _streakAlert = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.settingsSoundEffects),
                    value: _soundEffects,
                    onChanged: (v) => setState(() => _soundEffects = v),
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  OutlinedButton(
                    key: const Key('settings_logout_button'),
                    onPressed: _logout,
                    child: Text(l10n.settingsLogout),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  OutlinedButton(
                    key: const Key('settings_delete_account_button'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.error,
                    ),
                    onPressed: _deleteAccount,
                    child: Text(l10n.settingsDeleteAccount),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _LocaleOption extends StatelessWidget {
  const _LocaleOption({
    super.key,
    required this.label,
    required this.value,
    required this.selected,
    required this.onSelected,
  });

  final String label;
  final Locale? value;
  final Locale? selected;
  final ValueChanged<Locale?> onSelected;

  @override
  Widget build(BuildContext context) {
    final isSelected = selected == value;
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(label),
      trailing: Icon(
        isSelected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
        color: isSelected ? AppColors.primary : AppColors.textMuted,
      ),
      onTap: () => onSelected(value),
    );
  }
}

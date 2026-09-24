import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/errors/api_error_snack_bar.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/errors/l10n_for_api_error.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/widgets/user_avatar.dart';
import '../../../features/home/domain/home_data.dart';
import '../../../features/onboarding/domain/interest_labels.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../data/reminder_prefs.dart';
import 'model_picker_screen.dart';

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
  late Future<MeResponse> _future;
  // MAL-10: valores por defecto compartidos con `reminder_prefs.dart` —
  // se pisan en cuanto `_loadReminderPrefs` resuelve, si había algo guardado.
  TimeOfDay _morning = kReminderMorningDefault;
  TimeOfDay _evening = kReminderEveningDefault;

  // MEJ-39: "Alerta de racha" ya funciona (controla la notificación de
  // racha en riesgo que programa `SessionSummaryScreen`). "Sonido" sigue
  // sin existir de verdad.
  bool _streakAlert = true;
  final bool _soundEffects = false;

  // MAL-14: código de invitación para quien se registró sin grupo.
  final _invitationCodeController = TextEditingController();
  bool _redeeming = false;
  String? _invitationErrorMessage;

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadReminderPrefs();
  }

  Future<void> _loadReminderPrefs() async {
    final (morning, evening) = await loadReminderTimes();
    final streakAlert = await loadStreakAlertEnabled();
    if (!mounted) return;
    setState(() {
      _morning = morning;
      _evening = evening;
      _streakAlert = streakAlert;
    });
  }

  Future<void> _setStreakAlert(bool value) async {
    setState(() => _streakAlert = value);
    await saveStreakAlertEnabled(value);
    if (value) {
      // MAL-10: pedirlo al activar, no antes de que haga falta de verdad.
      // No se espera la respuesta: sin permiso la notificación simplemente
      // no aparece, y no hay nada más que bloquear en este flujo.
      unawaited(
        Permission.notification.request().catchError(
          (_) => PermissionStatus.denied,
        ),
      );
    } else {
      await ref.read(reminderServiceProvider).cancelStreakDanger();
    }
  }

  @override
  void dispose() {
    _invitationCodeController.dispose();
    super.dispose();
  }

  void _loadProfile() {
    _future = ref.read(fluentApiProvider).getMe();
  }

  Future<void> _redeemInvitationCode() async {
    final l10n = AppLocalizations.of(context);
    final code = _invitationCodeController.text.trim();
    if (code.isEmpty) return;
    setState(() {
      _redeeming = true;
      _invitationErrorMessage = null;
    });
    try {
      await ref.read(fluentApiProvider).redeemInvitation(code);
      if (!mounted) return;
      _invitationCodeController.clear();
      // El grupo recién asignado cambia `me.group` (esta pantalla) y
      // `HomeData.group`/`leaderboard` (MAL-29): ambos se recargan.
      ref.invalidate(homeDataProvider);
      setState(_loadProfile);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(l10n.settingsInvitationSuccess)));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _invitationErrorMessage = switch (e.code) {
          ApiErrorCode.invitationInvalid => l10n.registerErrorInvitationInvalid,
          ApiErrorCode.invitationUsed => l10n.registerErrorInvitationUsed,
          ApiErrorCode.invitationExpired => l10n.registerErrorInvitationExpired,
          ApiErrorCode.alreadyInGroup => l10n.registerErrorGeneric,
          _ => l10nForApiError(e.code, l10n),
        };
      });
    } finally {
      if (mounted) setState(() => _redeeming = false);
    }
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
    await saveReminderTimes(morning: _morning, evening: _evening);
    // MAL-10: sin el permiso, `scheduleDaily` "funciona" pero la
    // notificación nunca aparece — pedirlo acá, al activar un recordatorio,
    // en vez de esperar a que alguien se pregunte por qué nunca sonó.
    await Permission.notification.request();
    if (!mounted) return;
    final l10n = AppLocalizations.of(context);
    await ref
        .read(reminderServiceProvider)
        .scheduleDaily(
          morning: _morning,
          evening: _evening,
          title: l10n.settingsReminderNotificationTitle,
          body: l10n.settingsReminderNotificationBody,
        );
  }

  void _setLocale(Locale? locale) {
    ref.read(localeOverrideProvider.notifier).state = locale;
  }

  Future<void> _logout() async {
    await ref.read(authControllerProvider.notifier).logout();
    // MEJ-16: homeDataProvider sobrevive al logout (autoDispose + keepAlive);
    // sin invalidarlo, un re-login con otra cuenta en el mismo dispositivo
    // vería por un instante los datos de la sesión anterior.
    ref.invalidate(homeDataProvider);
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
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.destructive,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.settingsDeleteAccountConfirm),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    // MEJ-08: antes un fallo acá (por ejemplo, sin red) no mostraba nada —
    // el diálogo simplemente se cerraba y la cuenta seguía intacta sin que
    // quien la borra se enterara de que no pasó nada.
    try {
      await ref.read(fluentApiProvider).deleteAccount();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(apiErrorSnackBar(context, e.code));
      return;
    }
    await ref.read(authControllerProvider.notifier).logout();
    ref.invalidate(homeDataProvider);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsTitle)),
      body: SafeArea(
        child: FutureBuilder<MeResponse>(
          future: _future,
          builder: (context, snapshot) {
            return AsyncBody<MeResponse>(
              snapshot: snapshot,
              onRetry: () => setState(_loadProfile),
              skeleton: (_) => const _SettingsSkeleton(),
              builder: (me) => ListView(
                padding: const EdgeInsets.all(AppSpacing.screenPad),
                children: [
                  Row(
                    children: [
                      UserAvatar(
                        name: me.profile.displayName,
                        imageUrl: me.profile.avatarUrl,
                        size: 56,
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Text(
                          me.profile.displayName,
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    _levelLabel(AppLocalizations.of(context), me.profile.level),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final id in me.profile.interests)
                        Chip(label: Text(interestLabel(l10n, id))),
                    ],
                  ),
                  // MAL-14: única entrada del código de invitación. También
                  // se muestra en el grupo por defecto: el código lleva al
                  // grupo de un amigo.
                  if (me.group == null || me.group!.isDefault) ...[
                    const SizedBox(height: AppSpacing.xl),
                    Text(
                      l10n.settingsInvitationTitle,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    TextField(
                      key: const Key('settings_invitation_code_field'),
                      controller: _invitationCodeController,
                      decoration: InputDecoration(
                        hintText: l10n.settingsInvitationHint,
                        errorText: _invitationErrorMessage,
                      ),
                      textCapitalization: TextCapitalization.characters,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    OutlinedButton(
                      key: const Key('settings_invitation_submit_button'),
                      onPressed: _redeeming ? null : _redeemInvitationCode,
                      child: Text(l10n.settingsInvitationSubmit),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  // Entradas fijas: antes solo se llegaba a estas pantallas
                  // desde avisos que aparecen a veces.
                  ListTile(
                    key: const Key('settings_memory'),
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.psychology_outlined),
                    title: Text(l10n.memoryTitle),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/memory'),
                  ),
                  ListTile(
                    key: const Key('settings_plan'),
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.workspace_premium_outlined),
                    title: Text(l10n.settingsPlanTitle),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => context.push('/settings/plan'),
                  ),
                  if (me.isPro)
                    ModelPicker(preference: me.modelPreference)
                  else
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.sm,
                      ),
                      child: Text(
                        l10n.settingsFreeModelsNote,
                        key: const Key('settings_free_models_note'),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
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
                  // MEJ-39: ya controla la notificación de racha en riesgo
                  // (programada por `SessionSummaryScreen` al cerrar una
                  // sesión válida).
                  SwitchListTile(
                    key: const Key('settings_streak_alert_switch'),
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.settingsStreakAlert),
                    value: _streakAlert,
                    onChanged: (value) => _setStreakAlert(value),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(l10n.settingsSoundEffects),
                    subtitle: Text(l10n.commonComingSoon),
                    value: _soundEffects,
                    onChanged: null,
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
                      foregroundColor: AppColors.errorText,
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

/// Nombre del nivel del perfil tal como se eligió en el onboarding; antes se
/// mostraba el código de la API ("B1").
String _levelLabel(AppLocalizations l10n, String level) => switch (level) {
  'A2' => l10n.onboardingLevelBeginnerTitle,
  'B1' => l10n.onboardingLevelIntermediateTitle,
  'B2' => l10n.onboardingLevelAdvancedTitle,
  _ => level,
};

/// Forma de Ajustes mientras carga el perfil (antes, spinner pelado).
class _SettingsSkeleton extends StatelessWidget {
  const _SettingsSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: const [
        SkeletonBox(width: 180, height: 28),
        SizedBox(height: AppSpacing.sm),
        SkeletonBox(width: 90, height: 14),
        SizedBox(height: AppSpacing.xl),
        SkeletonListTile(),
        SkeletonListTile(),
        SkeletonListTile(),
        SizedBox(height: AppSpacing.xl),
        SkeletonListTile(),
        SkeletonListTile(),
      ],
    );
  }
}

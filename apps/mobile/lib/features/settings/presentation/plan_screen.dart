import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/billing/billing_service.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Plan actual (`/settings/plan`): Free o Pro, qué incluye Pro y, para Free,
/// el botón «Pasar a Pro». Con RevenueCat configurado abre la compra nativa;
/// sin clave abre «Disponible pronto».
class PlanScreen extends ConsumerStatefulWidget {
  const PlanScreen({super.key});

  @override
  ConsumerState<PlanScreen> createState() => _PlanScreenState();
}

class _PlanScreenState extends ConsumerState<PlanScreen> {
  late Future<MeResponse> _future;

  @override
  void initState() {
    super.initState();
    _load();
  }

  String? _price;
  bool _busy = false;
  bool _loggedIn = false;

  void _load() {
    _future = ref.read(fluentApiProvider).getMe();
    _future.then(_prepareBilling, onError: (_) {});
  }

  /// Vincula RevenueCat con el usuario y pide el precio localizado.
  Future<void> _prepareBilling(MeResponse me) async {
    final billing = ref.read(billingServiceProvider);
    if (billing == null || me.isPro || _price != null) return;
    try {
      await _logIn(billing, me);
      final price = await billing.proPrice();
      if (mounted) setState(() => _price = price);
    } catch (_) {
      // Sin precio el botón muestra el texto genérico; la compra reintenta.
    }
  }

  Future<void> _logIn(BillingService billing, MeResponse me) async {
    if (_loggedIn) return;
    final id = me.profile.userId ?? await _userIdFromToken();
    if (id != null) await billing.logIn(id);
    _loggedIn = true;
  }

  /// `/me` todavía no manda `userId`: se lee el `sub` del JWT de acceso.
  Future<String?> _userIdFromToken() async {
    final tokens = await ref.read(tokenStoreProvider).read();
    final parts = tokens?.accessToken.split('.');
    if (parts == null || parts.length < 2) return null;
    final payload = jsonDecode(
      utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
    );
    return payload is Map ? payload['sub'] as String? : null;
  }

  void _snack(String text) =>
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));

  Future<void> _upgrade(MeResponse me) async {
    final billing = ref.read(billingServiceProvider);
    if (billing == null) return _showComingSoon();
    await _run(me, () async {
      await _logIn(billing, me);
      await billing.buyPro();
    });
  }

  Future<void> _restore(MeResponse me) async {
    final billing = ref.read(billingServiceProvider)!;
    await _run(me, () async {
      await _logIn(billing, me);
      await billing.restore();
    });
  }

  /// Ejecuta [action] y, si termina, espera a que el webhook pase el plan a
  /// Pro: vuelve a pedir `/me` cada segundo, máximo 10 s.
  Future<void> _run(MeResponse me, Future<void> Function() action) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _busy = true);
    try {
      await action();
      final api = ref.read(fluentApiProvider);
      for (var i = 0; i < 10; i++) {
        if ((await api.getMe()).isPro) {
          if (mounted) setState(_load);
          return;
        }
        await Future<void>.delayed(const Duration(seconds: 1));
      }
      if (mounted) _snack(l10n.planActivating);
    } catch (_) {
      if (mounted) _snack(l10n.planPurchaseError);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _showComingSoon() {
    final l10n = AppLocalizations.of(context);
    return showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(l10n.planComingSoonTitle),
        content: Text(l10n.planComingSoonBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: Text(l10n.planComingSoonClose),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.settingsPlanTitle)),
      body: SafeArea(
        child: FutureBuilder<MeResponse>(
          future: _future,
          builder: (context, snapshot) => AsyncBody<MeResponse>(
            snapshot: snapshot,
            onRetry: () => setState(_load),
            skeleton: (_) => ListView(
              padding: const EdgeInsets.all(AppSpacing.screenPad),
              children: const [
                SkeletonBox(width: 140, height: 28),
                SizedBox(height: AppSpacing.xl),
                SkeletonListTile(),
                SkeletonListTile(),
                SkeletonListTile(),
              ],
            ),
            builder: (me) {
              final expires = me.planExpiresAt;
              return ListView(
                padding: const EdgeInsets.all(AppSpacing.screenPad),
                children: [
                  Text(
                    me.isPro ? l10n.planCurrentPro : l10n.planCurrentFree,
                    key: const Key('plan_current'),
                    style: theme.textTheme.headlineMedium,
                  ),
                  if (me.isPro && expires != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      l10n.planProUntil(
                        DateFormat.yMMMd(
                          Localizations.localeOf(context).toString(),
                        ).format(expires.toLocal()),
                      ),
                      style: theme.textTheme.bodySmall,
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    l10n.planProIncludesTitle,
                    style: theme.textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  for (final text in [
                    l10n.planProFeatureModels,
                    l10n.planProFeatureDailyCap,
                    l10n.planProFeatureBrief,
                  ])
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      leading: const Icon(
                        Icons.check_circle_outline,
                        color: AppColors.primary,
                      ),
                      title: Text(text),
                    ),
                  if (!me.isPro) ...[
                    const SizedBox(height: AppSpacing.xl),
                    ElevatedButton(
                      key: const Key('plan_upgrade_button'),
                      onPressed: _busy ? null : () => _upgrade(me),
                      child: Text(
                        _price == null
                            ? l10n.planUpgradeButton
                            : l10n.planUpgradeButtonWithPrice(_price!),
                      ),
                    ),
                    if (ref.read(billingServiceProvider) != null)
                      TextButton(
                        key: const Key('plan_restore_button'),
                        onPressed: _busy ? null : () => _restore(me),
                        child: Text(l10n.planRestoreButton),
                      ),
                  ],
                ],
              );
            },
          ),
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/env.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/errors/l10n_for_api_error.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../features/home/domain/home_data.dart';
import '../../../l10n/gen/app_localizations.dart';
import '../domain/providers_data.dart';

const _kGeminiHelpUrl = 'https://aistudio.google.com/apikey';

/// MEJ-11: `providerId` es un identificador técnico ('openrouter',
/// 'gemini'); antes de esto se mostraba tal cual en mayúsculas
/// ('OPENROUTER') en vez del nombre de marca que ya usan el resto de las
/// tarjetas de esta misma pantalla.
String providerDisplayName(String providerId, AppLocalizations l10n) {
  return switch (providerId) {
    'openrouter' => l10n.providersOpenRouterTitle,
    'gemini' => l10n.providersGeminiTitle,
    _ => providerId.toUpperCase(),
  };
}

/// Proveedores y modelos (SPEC-06 §4.6, RF-2.x). Tarjetas de estado para
/// OpenRouter (PKCE) y Gemini (API key pegada), y selectores de modelo por
/// rol (conversación / coach) agrupados en Gratis, Económico y Premium.
class ProvidersScreen extends ConsumerStatefulWidget {
  const ProvidersScreen({super.key});

  @override
  ConsumerState<ProvidersScreen> createState() => _ProvidersScreenState();
}

class _ProvidersScreenState extends ConsumerState<ProvidersScreen> {
  late Future<ProvidersData> _future;
  bool _connectingOpenRouter = false;
  bool _connectingGemini = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<ProvidersData> _load() async {
    final api = ref.read(fluentApiProvider);
    final me = await api.getMe();
    final catalog = await api.getModels();
    final statuses = <String, ProviderStatusResult>{};
    for (final p in me.providers) {
      if (p.status == 'active') {
        statuses[p.provider] = await api.getProviderStatus(p.provider);
      }
    }
    return ProvidersData(me: me, catalog: catalog, statuses: statuses);
  }

  void _reload() {
    // MAL-13: mantiene fresco el `canPracticeProvider` que consulta la
    // pestaña Practicar de Home al conectar/desconectar un proveedor.
    ref.invalidate(canPracticeProvider);
    // MEJ-16: Home también tiene un banner/CTA que depende de si hay
    // proveedor activo — sin esto quedaba con el dato viejo hasta que algo
    // más lo invalidara.
    ref.invalidate(homeDataProvider);
    setState(() {
      _future = _load();
    });
  }

  /// SPEC-02 §(PKCE), contrato tras MAL-18: el callback público de
  /// OpenRouter ya no canjea nada, solo deja el `code` pendiente en Redis y
  /// redirige acá con `?done=1` (o `?error=…` si el usuario canceló o
  /// OpenRouter rechazó). El canje real lo hace `POST /pkce/complete`
  /// autenticado, con el `codeVerifierId` — sin `code`: ya no existe el
  /// flujo legado que lo aceptaba por deep link.
  Future<void> _connectOpenRouter() async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _connectingOpenRouter = true;
      _error = null;
    });
    try {
      final api = ref.read(fluentApiProvider);
      final pkce = await api.startOpenRouterPkce(Env.oauthCallbackUrl);
      final callback = await ref
          .read(oauthLauncherProvider)
          .authenticate(
            url: pkce.authUrl,
            callbackUrlScheme: Env.oauthCallbackScheme,
          );
      final params = Uri.parse(callback).queryParameters;
      if (params['done'] != '1') {
        // `error=…`, o cualquier otra cosa que no sea el `done=1` del
        // contrato nuevo: no hay nada que canjear.
        if (mounted) setState(() => _error = l10n.providersOauthError);
        return;
      }
      final completed = await _completeOpenRouterPkce(
        codeVerifierId: pkce.codeVerifierId,
      );
      if (!completed) return;
      await ref.read(authControllerProvider.notifier).refresh();
      _reload();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = l10nForApiError(e.code, l10n));
    } catch (_) {
      if (mounted) setState(() => _error = l10n.providersErrorGeneric);
    } finally {
      if (mounted) setState(() => _connectingOpenRouter = false);
    }
  }

  /// `POST /pkce/complete`: `403 FORBIDDEN` si el `codeVerifierId` no
  /// existe, caducó o es de otro usuario — se relanza y cae al catch
  /// genérico de [_connectOpenRouter], que equivale a reiniciar el flujo
  /// desde `startOpenRouterPkce`. `400 VALIDATION` si todavía no llegó el
  /// `code` (el navegador no volvió) — recuperable: se reintenta una vez
  /// tras un breve retraso; si persiste, `providersOauthError`.
  Future<bool> _completeOpenRouterPkce({
    required String codeVerifierId,
    bool retried = false,
  }) async {
    try {
      await ref
          .read(fluentApiProvider)
          .completeOpenRouterPkce(codeVerifierId: codeVerifierId);
      return true;
    } on ApiException catch (e) {
      if (e.code != ApiErrorCode.validation) rethrow;
      if (!retried) {
        await Future.delayed(const Duration(milliseconds: 800));
        if (!mounted) return false;
        return _completeOpenRouterPkce(
          codeVerifierId: codeVerifierId,
          retried: true,
        );
      }
      if (!mounted) return false;
      setState(() => _error = AppLocalizations.of(context).providersOauthError);
      return false;
    }
  }

  Future<void> _disconnect(String provider) async {
    final l10n = AppLocalizations.of(context);
    setState(() => _error = null);
    try {
      await ref.read(fluentApiProvider).disconnectProvider(provider);
      await ref.read(authControllerProvider.notifier).refresh();
      _reload();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = l10nForApiError(e.code, l10n));
    } catch (_) {
      if (mounted) setState(() => _error = l10n.providersErrorGeneric);
    }
  }

  Future<void> _connectGemini(String apiKey) async {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _connectingGemini = true;
      _error = null;
    });
    try {
      await ref.read(fluentApiProvider).connectGemini(apiKey);
      await ref.read(authControllerProvider.notifier).refresh();
      _reload();
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.code == ApiErrorCode.providerKeyInvalid
              ? l10n.providersGeminiKeyInvalid
              : l10nForApiError(e.code, l10n);
        });
      }
    } finally {
      if (mounted) setState(() => _connectingGemini = false);
    }
  }

  Future<void> _openGeminiKeySheet() async {
    final key = await showModalBottomSheet<String>(
      context: context,
      isScrollControlled: true,
      builder: (context) => const _GeminiKeySheet(),
    );
    if (key != null && key.isNotEmpty) {
      await _connectGemini(key);
    }
  }

  Future<void> _pickModel({
    required ProvidersData data,
    required bool isChatRole,
  }) async {
    final l10n = AppLocalizations.of(context);
    final pref = data.me.modelPreference;
    final result = await showModalBottomSheet<(String, String)>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _ModelPickerSheet(
        title: isChatRole
            ? l10n.providersModelChatTitle
            : l10n.providersModelBriefTitle,
        data: data,
      ),
    );
    if (result == null) return;
    final (providerId, modelId) = result;
    try {
      await ref
          .read(fluentApiProvider)
          .putModelPreference(
            chatProvider: isChatRole
                ? providerId
                : (pref?.chatProvider ?? providerId),
            chatModel: isChatRole ? modelId : (pref?.chatModel ?? modelId),
            briefProvider: !isChatRole
                ? providerId
                : (pref?.briefProvider ?? providerId),
            briefModel: !isChatRole ? modelId : (pref?.briefModel ?? modelId),
          );
      _reload();
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = l10nForApiError(e.code, l10n));
    } catch (_) {
      if (mounted) setState(() => _error = l10n.providersErrorGeneric);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.providersTitle),
        leading: context.canPop() ? const BackButton() : null,
      ),
      body: SafeArea(
        child: FutureBuilder<ProvidersData>(
          future: _future,
          // Antes: spinner pelado y, si fallaba, un texto sin forma de
          // reintentar.
          builder: (context, snapshot) => AsyncBody<ProvidersData>(
            snapshot: snapshot,
            onRetry: _reload,
            skeleton: (_) => const _ProvidersSkeleton(),
            builder: (data) => Column(
              children: [
                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.all(AppSpacing.screenPad),
                    children: [
                      if (_error != null) ...[
                        Text(
                          _error!,
                          style: const TextStyle(color: AppColors.errorText),
                        ),
                        const SizedBox(height: AppSpacing.md),
                      ],
                      _ProviderCard(
                        key: const Key('provider_card_openrouter'),
                        title: l10n.providersOpenRouterTitle,
                        info: data.providerInfo('openrouter'),
                        status: data.statuses['openrouter'],
                        connecting: _connectingOpenRouter,
                        onConnect: _connectOpenRouter,
                        onDisconnect: () => _disconnect('openrouter'),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _ProviderCard(
                        key: const Key('provider_card_gemini'),
                        title: l10n.providersGeminiTitle,
                        info: data.providerInfo('gemini'),
                        status: data.statuses['gemini'],
                        connecting: _connectingGemini,
                        recommended: true,
                        onConnect: _openGeminiKeySheet,
                        onDisconnect: () => _disconnect('gemini'),
                        connectLabel: l10n.providersGeminiPasteKeyButton,
                      ),
                      const SizedBox(height: AppSpacing.xl),
                      Text(
                        l10n.providersModelChatTitle,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      _ModelSummaryTile(
                        key: const Key('model_picker_chat'),
                        data: data,
                        providerId: data.me.modelPreference?.chatProvider,
                        modelId: data.me.modelPreference?.chatModel,
                        onTap: () => _pickModel(data: data, isChatRole: true),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        l10n.providersModelBriefTitle,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      _ModelSummaryTile(
                        key: const Key('model_picker_brief'),
                        data: data,
                        providerId: data.me.modelPreference?.briefProvider,
                        modelId: data.me.modelPreference?.briefModel,
                        onTap: () => _pickModel(data: data, isChatRole: false),
                      ),
                    ],
                  ),
                ),
                if (data.hasActiveProvider)
                  SafeArea(
                    top: false,
                    child: Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.screenPad,
                        0,
                        AppSpacing.screenPad,
                        AppSpacing.md,
                      ),
                      child: ElevatedButton(
                        key: const Key('providers_go_practice_button'),
                        onPressed: () => context.go('/'),
                        child: Text(l10n.providersGoPractice),
                      ),
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

/// Contenido de la hoja para pegar la API key de Gemini. Un `StatefulWidget`
/// propio en vez de un `TextEditingController` creado en el método que abre
/// la hoja (MEJ-20): así el `dispose()` lo llama el framework cuando el
/// widget realmente se desmonta (al terminar la animación de cierre), en
/// vez de nosotros disponiéndolo apenas se resuelve el `Future` de
/// `showModalBottomSheet` — eso pasaba mientras la hoja todavía estaba
/// animando y tiraba "TextEditingController was used after being disposed".
class _GeminiKeySheet extends StatefulWidget {
  const _GeminiKeySheet();

  @override
  State<_GeminiKeySheet> createState() => _GeminiKeySheetState();
}

class _GeminiKeySheetState extends State<_GeminiKeySheet> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: EdgeInsets.only(
        left: AppSpacing.screenPad,
        right: AppSpacing.screenPad,
        top: AppSpacing.screenPad,
        bottom: MediaQuery.of(context).viewInsets.bottom + AppSpacing.screenPad,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            l10n.providersGeminiKeyDialogTitle,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            l10n.providersGeminiKeyHelpStep1,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          // TextButton: área táctil de 48 dp y color con contraste AA (el
          // InkWell con texto `primary` medía ~20 dp y daba 3,2:1).
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton(
              onPressed: () => launchUrl(
                Uri.parse(_kGeminiHelpUrl),
                mode: LaunchMode.externalApplication,
              ),
              style: TextButton.styleFrom(
                foregroundColor: AppColors.primaryDark,
                padding: EdgeInsets.zero,
              ),
              child: Text(
                l10n.providersGeminiKeyLink,
                style: const TextStyle(decoration: TextDecoration.underline),
              ),
            ),
          ),
          Text(
            l10n.providersGeminiKeyHelpStep2,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          Text(
            l10n.providersGeminiKeyHelpStep3,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.lg),
          TextField(
            key: const Key('gemini_key_field'),
            controller: _controller,
            decoration: InputDecoration(
              labelText: l10n.providersGeminiKeyLabel,
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text(l10n.providersGeminiKeyCancel),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: ElevatedButton(
                  key: const Key('gemini_key_confirm_button'),
                  onPressed: () =>
                      Navigator.of(context).pop(_controller.text.trim()),
                  child: Text(l10n.providersGeminiKeyConfirm),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ProviderCard extends StatelessWidget {
  const _ProviderCard({
    super.key,
    required this.title,
    required this.info,
    required this.status,
    required this.connecting,
    required this.onConnect,
    required this.onDisconnect,
    this.recommended = false,
    this.connectLabel,
  });

  final String title;
  final ProviderInfo? info;
  final ProviderStatusResult? status;
  final bool connecting;
  final VoidCallback onConnect;
  final VoidCallback onDisconnect;
  final bool recommended;
  final String? connectLabel;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final statusText = info?.status ?? 'not_connected';
    final isConnected = statusText == 'active';

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              if (recommended)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.goldSoft,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                  ),
                  child: Text(
                    l10n.providersGeminiRecommendedBadge,
                    style: const TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: AppColors.goldText,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(switch (statusText) {
            'active' => l10n.providersStatusConnected,
            'error' => l10n.providersStatusError,
            _ => l10n.providersStatusNotConnected,
          }, style: Theme.of(context).textTheme.bodySmall),
          if (isConnected && status?.credits != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              l10n.providersCreditsRemaining(
                (status!.credits!.total - status!.credits!.used)
                    .toStringAsFixed(2),
              ),
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          SizedBox(
            width: double.infinity,
            child: isConnected
                ? OutlinedButton(
                    onPressed: onDisconnect,
                    child: Text(l10n.providersDisconnectButton),
                  )
                : ElevatedButton(
                    onPressed: connecting ? null : onConnect,
                    child: connecting
                        // Sin color fijo: el blanco no se veía sobre el
                        // fondo claro del botón deshabilitado.
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : Text(connectLabel ?? l10n.providersConnectButton),
                  ),
          ),
        ],
      ),
    );
  }
}

class _ModelSummaryTile extends StatelessWidget {
  const _ModelSummaryTile({
    super.key,
    required this.data,
    required this.providerId,
    required this.modelId,
    required this.onTap,
  });

  final ProvidersData data;
  final String? providerId;
  final String? modelId;
  final VoidCallback onTap;

  ModelOption? _findModel() {
    if (providerId == null || modelId == null) return null;
    final groups = data.catalog.providers[providerId];
    if (groups == null) return null;
    for (final list in [groups.free, groups.budget, groups.premium]) {
      for (final m in list) {
        if (m.id == modelId) return m;
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final model = _findModel();
    // Ink en vez de Container: con un fondo opaco el ripple del InkWell
    // quedaba tapado y el toque no daba ninguna respuesta.
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Ink(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                model?.name ?? modelId ?? l10n.commonEmptyValue,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ),
            const Icon(Icons.chevron_right, color: AppColors.textMuted),
          ],
        ),
      ),
    );
  }
}

class _ModelPickerSheet extends StatelessWidget {
  const _ModelPickerSheet({required this.title, required this.data});

  final String title;
  final ProvidersData data;

  @override
  Widget build(BuildContext context) {
    // Solo los proveedores conectados: listar los demás deshabilitados
    // confundía (con Gemini conectado aparecía todo OpenRouter apagado).
    final connected = data.catalog.providers.keys
        .where(data.isConnected)
        .toList();
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.7,
      builder: (context, scrollController) {
        return Padding(
          padding: const EdgeInsets.all(AppSpacing.screenPad),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: AppSpacing.md),
              Expanded(
                child: ListView(
                  key: const Key('model_picker_list'),
                  controller: scrollController,
                  children: [
                    if (connected.isEmpty)
                      Text(
                        AppLocalizations.of(context).homeNeedProviderHint,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    for (final providerId in connected)
                      _ProviderModelGroup(
                        providerId: providerId,
                        groups: data.catalog.providers[providerId]!,
                        estimatePerSession: data.catalog.estimatePerSession,
                        onSelected: (modelId) =>
                            Navigator.of(context).pop((providerId, modelId)),
                      ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _ProviderModelGroup extends StatelessWidget {
  const _ProviderModelGroup({
    required this.providerId,
    required this.groups,
    required this.estimatePerSession,
    required this.onSelected,
  });

  final String providerId;
  final ModelTierGroups groups;
  final Map<String, double> estimatePerSession;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
            top: AppSpacing.md,
            bottom: AppSpacing.xs,
          ),
          child: Text(
            providerDisplayName(providerId, l10n),
            style: Theme.of(context).textTheme.labelSmall,
          ),
        ),
        if (groups.free.isNotEmpty)
          _TierSection(
            label: l10n.providersModelTierFree,
            models: groups.free,
            estimatePerSession: estimatePerSession,
            onSelected: onSelected,
          ),
        if (groups.budget.isNotEmpty)
          _TierSection(
            label: l10n.providersModelTierBudget,
            models: groups.budget,
            estimatePerSession: estimatePerSession,
            onSelected: onSelected,
          ),
        if (groups.premium.isNotEmpty)
          _TierSection(
            label: l10n.providersModelTierPremium,
            models: groups.premium,
            estimatePerSession: estimatePerSession,
            onSelected: onSelected,
          ),
      ],
    );
  }
}

class _TierSection extends StatelessWidget {
  const _TierSection({
    required this.label,
    required this.models,
    required this.estimatePerSession,
    required this.onSelected,
  });

  final String label;
  final List<ModelOption> models;
  final Map<String, double> estimatePerSession;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall
              ?.copyWith(fontWeight: FontWeight.w700),
        ),
        for (final model in models)
          ListTile(
            key: Key('model_option_${model.id}'),
            contentPadding: EdgeInsets.zero,
            title: Text(model.name),
            subtitle: Text(
              (estimatePerSession[model.id] ?? 0) > 0
                  ? l10n.providersModelEstimatePaid(
                      (estimatePerSession[model.id] ?? 0).toStringAsFixed(3),
                    )
                  : l10n.providersModelEstimateFree,
            ),
            onTap: () => onSelected(model.id),
          ),
      ],
    );
  }
}

/// Forma de la pantalla mientras carga: dos tarjetas de cuenta y los
/// selectores de modelo.
class _ProvidersSkeleton extends StatelessWidget {
  const _ProvidersSkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const NeverScrollableScrollPhysics(),
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: const [
        SkeletonBox(height: 120, borderRadius: AppRadius.lg),
        SizedBox(height: AppSpacing.md),
        SkeletonBox(height: 120, borderRadius: AppRadius.lg),
        SizedBox(height: AppSpacing.xl),
        SkeletonListTile(),
        SkeletonListTile(),
      ],
    );
  }
}

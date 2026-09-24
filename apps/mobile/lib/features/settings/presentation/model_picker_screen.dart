import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/errors/api_error_snack_bar.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/providers.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Selector de modelo de chat y de brief; solo se muestra a cuentas Pro
/// (lo decide `SettingsScreen`). Es una sección, no una ruta: vive en Ajustes.
class ModelPicker extends ConsumerStatefulWidget {
  const ModelPicker({super.key, this.preference});

  final ModelPreference? preference;

  @override
  ConsumerState<ModelPicker> createState() => _ModelPickerState();
}

class _ModelPickerState extends ConsumerState<ModelPicker> {
  late final Future<ModelsCatalog> _catalog;
  late ModelPreference? _pref = widget.preference;

  @override
  void initState() {
    super.initState();
    _catalog = ref.read(fluentApiProvider).getModels();
  }

  Future<void> _save({String? chat, String? brief}) async {
    // Los valores son "proveedor|modelo".
    (String, String) split(String v) {
      final i = v.indexOf('|');
      return (v.substring(0, i), v.substring(i + 1));
    }

    final p = _pref;
    final (cp, cm) = chat != null
        ? split(chat)
        : (p?.chatProvider ?? '', p?.chatModel ?? '');
    final (bp, bm) = brief != null
        ? split(brief)
        : (p?.briefProvider ?? '', p?.briefModel ?? '');
    try {
      final saved = await ref
          .read(fluentApiProvider)
          .putModelPreference(
            chatProvider: cp,
            chatModel: cm,
            briefProvider: bp,
            briefModel: bm,
          );
      if (mounted) setState(() => _pref = saved);
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(apiErrorSnackBar(context, e.code));
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return FutureBuilder<ModelsCatalog>(
      future: _catalog,
      builder: (context, snapshot) {
        if (snapshot.hasError) return Text(l10n.modelPickerLoadError);
        final catalog = snapshot.data;
        if (catalog == null) return const SizedBox.shrink();
        final items = [
          for (final MapEntry(key: provider, value: tiers)
              in catalog.providers.entries)
            for (final m in [...tiers.free, ...tiers.budget, ...tiers.premium])
              DropdownMenuItem(
                value: '$provider|${m.id}',
                child: Text(m.name, overflow: TextOverflow.ellipsis),
              ),
        ];
        String? current(String? provider, String? model) {
          final v = '$provider|$model';
          return items.any((i) => i.value == v) ? v : null;
        }

        final p = _pref;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              l10n.modelPickerChatTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            DropdownButton<String>(
              key: const Key('model_picker_chat'),
              isExpanded: true,
              value: current(p?.chatProvider, p?.chatModel),
              items: items,
              onChanged: (v) => _save(chat: v),
            ),
            const SizedBox(height: AppSpacing.md),
            Text(
              l10n.modelPickerBriefTitle,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            DropdownButton<String>(
              key: const Key('model_picker_brief'),
              isExpanded: true,
              value: current(p?.briefProvider, p?.briefModel),
              items: items,
              onChanged: (v) => _save(brief: v),
            ),
          ],
        );
      },
    );
  }
}

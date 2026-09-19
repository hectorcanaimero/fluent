import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/errors/api_exception.dart';
import '../../../core/errors/l10n_for_api_error.dart';
import '../../../core/providers.dart';
import '../../../core/widgets/async_body.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../features/home/domain/home_data.dart';
import '../../../l10n/gen/app_localizations.dart';

/// "Lo que recuerdo de vos" (SPEC-06 §4.5, RF-4.2, RF-4.6). Todos los
/// textos pasan por `AppLocalizations`, sin cadenas literales en widgets.
class MemoryScreen extends ConsumerStatefulWidget {
  const MemoryScreen({super.key});

  @override
  ConsumerState<MemoryScreen> createState() => _MemoryScreenState();
}

class _MemoryScreenState extends ConsumerState<MemoryScreen> {
  late Future<MemoryResult> _future;
  final _briefController = TextEditingController();
  bool _briefDirty = false;
  bool _savingBrief = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _briefController.dispose();
    super.dispose();
  }

  Future<MemoryResult> _load() async {
    final result = await ref.read(fluentApiProvider).getMemory();
    _briefController.text = result.brief.text;
    _briefDirty = false;
    return result;
  }

  void _reload() {
    // MEJ-16: la tarjeta de hechos pendientes de Home cuenta lo mismo que
    // esta pantalla edita.
    ref.invalidate(homeDataProvider);
    setState(() {
      _future = _load();
    });
  }

  /// MEJ-08: antes un fallo acá no mostraba nada — el hecho pendiente
  /// desaparecía de la UI (por el `_reload` optimista implícito del rebuild)
  /// sin que la confirmación hubiera llegado a guardarse.
  void _showApiError(ApiException e) => _showMessage(
    (l10n) => l10nForApiError(e.code, l10n),
  );

  /// Errores fuera de `ApiException` (sin red, timeout) también avisan: antes
  /// guardar las notas u "olvidar todo" fallaba en silencio.
  void _showError(Object e) => e is ApiException
      ? _showApiError(e)
      : _showMessage((l10n) => l10n.errorGeneric);

  void _showMessage(String Function(AppLocalizations l10n) text) {
    if (!mounted) return;
    final l10n = AppLocalizations.of(context);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(text(l10n))));
  }

  Future<void> _confirmFact(MemoryFact fact, String text) async {
    try {
      await ref
          .read(fluentApiProvider)
          .patchFact(factId: fact.id, status: 'confirmed', text: text);
      _reload();
    } on ApiException catch (e) {
      _showApiError(e);
    }
  }

  Future<void> _dismissFact(MemoryFact fact) async {
    try {
      await ref
          .read(fluentApiProvider)
          .patchFact(factId: fact.id, status: 'dismissed');
      _reload();
    } on ApiException catch (e) {
      _showApiError(e);
    }
  }

  /// MEJ-08: "borrar" un hecho confirmado no lo elimina de una — lo pasa a
  /// `dismissed` (ya no aparece ni en pendientes ni en confirmados) y ofrece
  /// "Deshacer" (`patchFact` inverso, a `confirmed`) mientras dura el
  /// snackbar.
  Future<void> _deleteFact(MemoryFact fact) async {
    final l10n = AppLocalizations.of(context);
    try {
      await ref
          .read(fluentApiProvider)
          .patchFact(factId: fact.id, status: 'dismissed');
      _reload();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(l10n.memoryFactDeleted),
          action: SnackBarAction(
            label: l10n.commonUndo,
            onPressed: () => _undoDeleteFact(fact),
          ),
        ),
      );
    } on ApiException catch (e) {
      _showApiError(e);
    }
  }

  Future<void> _undoDeleteFact(MemoryFact fact) async {
    try {
      await ref
          .read(fluentApiProvider)
          .patchFact(factId: fact.id, status: 'confirmed');
      _reload();
    } on ApiException catch (e) {
      _showApiError(e);
    }
  }

  Future<void> _editConfirmedFact(MemoryFact fact) async {
    final newText = await showDialog<String>(
      context: context,
      builder: (ctx) => _EditFactDialog(initialText: fact.text),
    );
    if (newText != null && newText.isNotEmpty && newText != fact.text) {
      try {
        await ref
            .read(fluentApiProvider)
            .patchFact(factId: fact.id, text: newText);
        _reload();
      } on ApiException catch (e) {
        _showApiError(e);
      }
    }
  }

  Future<void> _saveBrief() async {
    setState(() => _savingBrief = true);
    try {
      await ref.read(fluentApiProvider).putBrief(_briefController.text.trim());
      if (!mounted) return;
      setState(() => _briefDirty = false);
      _showMessage((l10n) => l10n.memoryBriefSaved);
    } catch (e) {
      _showError(e);
    } finally {
      if (mounted) setState(() => _savingBrief = false);
    }
  }

  Future<void> _forgetAll() async {
    final l10n = AppLocalizations.of(context);
    final firstConfirm = await _confirmDialog(
      title: l10n.memoryForgetAllConfirmTitle1,
      body: l10n.memoryForgetAllConfirmBody1,
    );
    if (firstConfirm != true) return;
    if (!mounted) return;
    final secondConfirm = await _confirmDialog(
      title: l10n.memoryForgetAllConfirmTitle2,
      body: l10n.memoryForgetAllConfirmBody2,
    );
    if (secondConfirm != true) return;

    try {
      await ref.read(fluentApiProvider).forgetAllMemory();
      _reload();
    } catch (e) {
      _showError(e);
    }
  }

  Future<bool?> _confirmDialog({required String title, required String body}) {
    final l10n = AppLocalizations.of(context);
    return showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Text(body),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.memoryForgetAllCancel),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.destructive,
            ),
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.memoryForgetAllConfirm),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(l10n.memoryTitle)),
      body: SafeArea(
        child: FutureBuilder<MemoryResult>(
          future: _future,
          builder: (context, snapshot) {
            return AsyncBody<MemoryResult>(
              snapshot: snapshot,
              onRetry: _reload,
              skeleton: (context) => const _MemorySkeleton(),
              builder: (data) => ListView(
                padding: const EdgeInsets.all(AppSpacing.screenPad),
                children: [
                  if (data.facts.pending.isNotEmpty) ...[
                    Text(
                      l10n.memoryPendingSectionTitle,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    for (final fact in data.facts.pending)
                      _PendingFactTile(
                        key: Key('pending_fact_${fact.id}'),
                        fact: fact,
                        onConfirm: (text) => _confirmFact(fact, text),
                        onDismiss: () => _dismissFact(fact),
                      ),
                    const SizedBox(height: AppSpacing.xl),
                  ],
                  Text(
                    l10n.memoryConfirmedSectionTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  if (data.facts.confirmed.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.sm,
                      ),
                      child: Text(
                        l10n.memoryConfirmedEmpty,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  for (final fact in data.facts.confirmed)
                    Dismissible(
                      key: Key('confirmed_fact_${fact.id}'),
                      direction: DismissDirection.endToStart,
                      onDismissed: (_) => _deleteFact(fact),
                      background: Container(
                        alignment: Alignment.centerRight,
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.lg,
                        ),
                        color: AppColors.destructive,
                        child: const Icon(
                          Icons.delete_outline,
                          color: Colors.white,
                        ),
                      ),
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(fact.text),
                        onTap: () => _editConfirmedFact(fact),
                      ),
                    ),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    l10n.memoryBriefSectionTitle,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    l10n.memoryBriefExplanation,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  TextField(
                    key: const Key('memory_brief_field'),
                    controller: _briefController,
                    maxLines: 5,
                    maxLength: 600,
                    onChanged: (_) => setState(() => _briefDirty = true),
                  ),
                  if (_briefDirty)
                    Align(
                      alignment: Alignment.centerRight,
                      child: ElevatedButton(
                        onPressed: _savingBrief ? null : _saveBrief,
                        child: Text(l10n.memoryBriefSaveButton),
                      ),
                    ),
                  const SizedBox(height: AppSpacing.xl),
                  OutlinedButton(
                    key: const Key('memory_forget_all_button'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.errorText,
                    ),
                    onPressed: _forgetAll,
                    child: Text(l10n.memoryForgetAllButton),
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

/// MEJ-02: forma aproximada (dos secciones de hechos) mientras carga.
class _MemorySkeleton extends StatelessWidget {
  const _MemorySkeleton();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: const [
        SkeletonBox(width: 140, height: 20),
        SizedBox(height: AppSpacing.sm),
        SkeletonListTile(),
        SkeletonListTile(),
        SizedBox(height: AppSpacing.xl),
        SkeletonBox(width: 160, height: 20),
        SizedBox(height: AppSpacing.sm),
        SkeletonListTile(),
        SkeletonListTile(),
        SkeletonListTile(),
      ],
    );
  }
}

class _PendingFactTile extends StatefulWidget {
  const _PendingFactTile({
    super.key,
    required this.fact,
    required this.onConfirm,
    required this.onDismiss,
  });

  final MemoryFact fact;
  final ValueChanged<String> onConfirm;
  final VoidCallback onDismiss;

  @override
  State<_PendingFactTile> createState() => _PendingFactTileState();
}

class _PendingFactTileState extends State<_PendingFactTile> {
  late final _controller = TextEditingController(text: widget.fact.text);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              key: Key('pending_fact_field_${widget.fact.id}'),
              controller: _controller,
              // collapsed: con `border: none` el tema igual le ponía relleno
              // blanco y borde, y cada dato parecía un campo de formulario.
              decoration: const InputDecoration.collapsed(hintText: null),
              maxLines: null,
            ),
          ),
          IconButton(
            key: Key('pending_fact_confirm_${widget.fact.id}'),
            // primaryDark: `success` sobre primarySoft daba 2,76:1.
            icon: const Icon(Icons.check_circle, color: AppColors.primaryDark),
            tooltip: l10n.memoryConfirmFact,
            onPressed: () => widget.onConfirm(_controller.text.trim()),
          ),
          IconButton(
            key: Key('pending_fact_dismiss_${widget.fact.id}'),
            icon: const Icon(Icons.cancel, color: AppColors.textSecondary),
            tooltip: l10n.memoryDismissFact,
            onPressed: widget.onDismiss,
          ),
        ],
      ),
    );
  }
}

/// Diálogo para editar un hecho confirmado. Un `StatefulWidget` propio en
/// vez de un `TextEditingController` creado en el método que abre el
/// diálogo (MEJ-20): así el framework llama a `dispose()` cuando el widget
/// realmente se desmonta (al terminar la animación de cierre del diálogo),
/// no antes — disponer apenas se resuelve el `Future` de `showDialog`
/// tira "TextEditingController was used after being disposed" mientras el
/// diálogo todavía está animando.
class _EditFactDialog extends StatefulWidget {
  const _EditFactDialog({required this.initialText});

  final String initialText;

  @override
  State<_EditFactDialog> createState() => _EditFactDialogState();
}

class _EditFactDialogState extends State<_EditFactDialog> {
  late final _controller = TextEditingController(text: widget.initialText);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return AlertDialog(
      title: Text(l10n.memoryEditFactTitle),
      content: TextField(controller: _controller, autofocus: true, maxLines: 3),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: Text(l10n.memoryEditFactCancel),
        ),
        ElevatedButton(
          onPressed: () => Navigator.of(context).pop(_controller.text.trim()),
          child: Text(l10n.memoryEditFactSave),
        ),
      ],
    );
  }
}

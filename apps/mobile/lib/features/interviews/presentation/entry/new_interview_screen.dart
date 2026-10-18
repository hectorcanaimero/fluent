import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/errors/api_error_snack_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/providers.dart';
import '../../../../core/widgets/async_body.dart';
import '../../../../core/widgets/button_spinner.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../data/interviews_repository.dart';
import 'offer_draft_prefs.dart';
import 'starter_templates.dart';

/// IE-01 (y sus estados 01a vacío, 01b carga, 01c servicio caído, 01d tope
/// alcanzado) e IE-02 (URL no legible), FR-1, FR-2, FR-21, FR-22, FR-33.
class NewInterviewScreen extends ConsumerStatefulWidget {
  const NewInterviewScreen({super.key});

  @override
  ConsumerState<NewInterviewScreen> createState() => _NewInterviewScreenState();
}

class _NewInterviewScreenState extends ConsumerState<NewInterviewScreen> {
  final _offerController = TextEditingController();
  final _offerFocus = FocusNode();
  final _submitFocus = FocusNode();
  late final String? _userId;
  Timer? _saveDebounce;

  /// La entrevista ya se creó y el borrador se borró: `dispose` no tiene
  /// que volver a guardarlo.
  bool _created = false;
  String _type = 'technical';
  bool _submitting = false;

  /// La última URL enviada que la API no pudo leer (IE-02); `null` si lo
  /// enviado no era una URL. "Abrir en LinkedIn" solo aparece si es de
  /// LinkedIn.
  String? _unreadableUrl;
  bool _unreadable = false;

  @override
  void initState() {
    super.initState();
    _userId = ref.read(authControllerProvider).me?.profile.userId;
    _loadDraft();
    // FR-22: cada cambio queda guardado, así un error o salir de la
    // pantalla no pierde lo que el usuario ya escribió o pegó.
    _offerController.addListener(_onOfferChanged);
  }

  Future<void> _loadDraft() async {
    final String? draft;
    try {
      draft = await loadOfferDraft(_userId);
    } catch (_) {
      return;
    }
    // Si la persona ya escribió o pegó algo mientras se leía el borrador,
    // no se lo pisamos.
    if (draft != null && mounted && _offerController.text.isEmpty) {
      _offerController.text = draft;
    }
  }

  void _onOfferChanged() {
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(milliseconds: 500), _saveDraft);
  }

  void _saveDraft() {
    if (_created) return;
    unawaited(
      saveOfferDraft(_userId, _offerController.text).catchError((_) {}),
    );
  }

  @override
  void dispose() {
    _saveDebounce?.cancel();
    _saveDraft();
    _offerController.removeListener(_onOfferChanged);
    _offerController.dispose();
    _offerFocus.dispose();
    _submitFocus.dispose();
    super.dispose();
  }

  /// Tocar una entrevista lista (F14.1.T1) rellena el campo con su
  /// `offerText` y lleva el foco a "Preparar entrevista"; la persona decide
  /// si la manda tal cual o la ajusta primero.
  void _fillFromTemplate(StarterTemplate template) {
    final l10n = AppLocalizations.of(context);
    setState(() {
      _offerController.text = template.offerText(l10n);
      _unreadable = false;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _submitFocus.requestFocus();
    });
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text;
    if (!mounted) return;
    setState(() {
      if (text != null && text.isNotEmpty) _offerController.text = text;
      _unreadable = false;
    });
  }

  /// IE-02 "Pegar el texto de la oferta": si en el portapapeles sigue la
  /// misma URL que no pudimos leer, re-pegarla solo repite el error.
  Future<void> _pasteFromUnreadable() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text?.trim();
    if (!mounted) return;
    if (text != null && text.isNotEmpty && text != _unreadableUrl) {
      setState(() {
        _offerController.text = text;
        _unreadable = false;
      });
      return;
    }
    final l10n = AppLocalizations.of(context);
    setState(() {
      _offerController.clear();
      _unreadable = false;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _offerFocus.requestFocus();
    });
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(l10n.interviewOfferCopyTextHint)));
  }

  Future<void> _openInLinkedIn() async {
    final url = _unreadableUrl;
    if (url == null) return;
    var opened = false;
    try {
      opened = await launchUrl(
        Uri.parse(url),
        mode: LaunchMode.externalApplication,
      );
    } catch (_) {
      // `PlatformException` sin app que lo abra, o URL que no se puede lanzar.
    }
    if (opened || !mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(AppLocalizations.of(context).interviewOpenLinkError),
      ),
    );
  }

  Future<void> _prepare(int remaining) async {
    if (_submitting || remaining <= 0) return;
    final text = _offerController.text.trim();
    if (text.isEmpty) return;
    final l10n = AppLocalizations.of(context);
    setState(() {
      _submitting = true;
      _unreadable = false;
    });
    final isUrl = looksLikeOfferUrl(text);
    try {
      final created = await ref
          .read(interviewsRepositoryProvider)
          .create(
            type: _type,
            offerText: isUrl ? null : text,
            offerUrl: isUrl ? text : null,
          );
      _created = true;
      _saveDebounce?.cancel();
      try {
        await saveOfferDraft(_userId, '');
      } catch (_) {}
      if (!mounted) return;
      context.pushReplacement('/interviews/${created.id}');
    } on ApiException catch (e) {
      if (!mounted) return;
      if (e.code == ApiErrorCode.offerUnreadable) {
        setState(() {
          _unreadable = true;
          _unreadableUrl = isUrl ? text : null;
        });
        return;
      }
      if (e.code == ApiErrorCode.interviewsDailyCap) {
        ref.invalidate(interviewQuotaProvider);
      }
      ScaffoldMessenger.of(context)
          .showSnackBar(apiErrorSnackBar(context, e.code));
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l10n.errorGeneric)));
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final asyncQuota = ref.watch(interviewQuotaProvider);
    final snapshot = asyncQuota.when(
      data: (q) =>
          AsyncSnapshot<InterviewQuota>.withData(ConnectionState.done, q),
      error: (e, st) =>
          AsyncSnapshot<InterviewQuota>.withError(ConnectionState.done, e, st),
      loading: () => const AsyncSnapshot<InterviewQuota>.waiting(),
    );
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.interviewEntryTitle),
        actions: [
          IconButton(
            key: const Key('interview_entry_history_button'),
            icon: const Icon(Icons.history),
            tooltip: l10n.interviewEntryHistoryTooltip,
            // Si se llegó desde el historial, se vuelve a él en vez de
            // apilar historial → nueva → historial → … sin fin.
            onPressed: () => _historyIsBelow(context)
                ? context.pop()
                : context.push('/interviews'),
          ),
        ],
      ),
      body: SafeArea(
        child: AsyncBody<InterviewQuota>(
          snapshot: snapshot,
          onRetry: () => ref.invalidate(interviewQuotaProvider),
          builder: (quota) => _unreadable
              ? _UnreadablePanel(
                  onPasteOfferText: _pasteFromUnreadable,
                  onOpenLinkedIn: isLinkedInUrl(_unreadableUrl)
                      ? _openInLinkedIn
                      : null,
                )
              : _OfferForm(
                  controller: _offerController,
                  focusNode: _offerFocus,
                  submitFocusNode: _submitFocus,
                  type: _type,
                  quota: quota,
                  submitting: _submitting,
                  onTypeChanged: (value) => setState(() => _type = value),
                  onPaste: _paste,
                  onSubmit: () => _prepare(quota.remaining),
                  onTemplateTap: _fillFromTemplate,
                ),
        ),
      ),
    );
  }
}

/// Solo es URL si es un único token http(s) con host: un texto de oferta que
/// empieza con el enlace y sigue con la descripción se manda como texto.
@visibleForTesting
bool looksLikeOfferUrl(String text) {
  final trimmed = text.trim();
  if (trimmed.isEmpty || RegExp(r'\s').hasMatch(trimmed)) return false;
  final uri = Uri.tryParse(trimmed);
  return uri != null &&
      (uri.scheme == 'http' || uri.scheme == 'https') &&
      uri.host.isNotEmpty;
}

@visibleForTesting
bool isLinkedInUrl(String? url) {
  if (url == null) return false;
  final host = Uri.tryParse(url)?.host.toLowerCase() ?? '';
  return host == 'linkedin.com' ||
      host.endsWith('.linkedin.com') ||
      host == 'lnkd.in';
}

class _OfferForm extends StatelessWidget {
  const _OfferForm({
    required this.controller,
    required this.focusNode,
    required this.submitFocusNode,
    required this.type,
    required this.quota,
    required this.submitting,
    required this.onTypeChanged,
    required this.onPaste,
    required this.onSubmit,
    required this.onTemplateTap,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final FocusNode submitFocusNode;
  final String type;
  final InterviewQuota quota;
  final bool submitting;
  final ValueChanged<String> onTypeChanged;
  final VoidCallback onPaste;
  final VoidCallback onSubmit;
  final ValueChanged<StarterTemplate> onTemplateTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final capReached = quota.remaining <= 0;
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        Text(
          capReached
              ? l10n.interviewQuotaExhausted(quota.limit)
              : l10n.interviewQuotaRemaining(quota.remaining, quota.limit),
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        if (quota.freeNotice) ...[
          const SizedBox(height: AppSpacing.xs),
          Text(
            l10n.interviewFreeNotice,
            style: Theme.of(context).textTheme.bodySmall
                ?.copyWith(color: AppColors.textMuted),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        TextField(
          key: const Key('interview_entry_offer_field'),
          controller: controller,
          focusNode: focusNode,
          maxLines: 8,
          minLines: 6,
          enabled: !capReached,
          decoration: InputDecoration(
            labelText: l10n.interviewOfferFieldLabel,
            hintText: l10n.interviewOfferFieldHint,
            alignLabelWithHint: true,
          ),
        ),
        const SizedBox(height: AppSpacing.xs),
        Row(
          children: [
            Expanded(
              child: ValueListenableBuilder<TextEditingValue>(
                valueListenable: controller,
                builder: (context, value, _) => Text(
                  l10n.interviewOfferCharCount(value.text.length),
                  style: Theme.of(context).textTheme.labelSmall,
                ),
              ),
            ),
            TextButton.icon(
              key: const Key('interview_entry_paste_button'),
              onPressed: capReached ? null : onPaste,
              icon: const Icon(Icons.content_paste),
              label: Text(l10n.interviewPasteButton),
            ),
          ],
        ),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: controller,
          builder: (context, value, _) => value.text.isNotEmpty
              ? const SizedBox.shrink()
              : _StarterTemplatesSection(
                  enabled: !capReached,
                  onTap: onTemplateTap,
                ),
        ),
        const SizedBox(height: AppSpacing.lg),
        SegmentedButton<String>(
          segments: [
            ButtonSegment(
              value: 'technical',
              label: Text(l10n.interviewTypeTechnical),
            ),
            ButtonSegment(value: 'mixed', label: Text(l10n.interviewTypeMixed)),
          ],
          selected: {type},
          onSelectionChanged: capReached
              ? null
              : (selection) => onTypeChanged(selection.first),
        ),
        const SizedBox(height: AppSpacing.xl),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: controller,
          builder: (context, value, _) {
            final canSubmit =
                !capReached && !submitting && value.text.trim().isNotEmpty;
            return ElevatedButton(
              key: const Key('interview_entry_submit_button'),
              focusNode: submitFocusNode,
              onPressed: canSubmit ? onSubmit : null,
              child: submitting
                  ? const ButtonSpinner()
                  : Text(l10n.interviewPrepareCta),
            );
          },
        ),
      ],
    );
  }
}

/// F14.1.T1: entrevistas listas para empezar con un toque. Solo se muestra
/// mientras el campo de la oferta está vacío (ver `_OfferForm`).
class _StarterTemplatesSection extends StatelessWidget {
  const _StarterTemplatesSection({required this.enabled, required this.onTap});

  final bool enabled;
  final ValueChanged<StarterTemplate> onTap;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: AppSpacing.lg),
        Text(
          l10n.interviewStarterSectionTitle,
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: AppSpacing.sm),
        for (final template in starterTemplates)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Card(
              margin: EdgeInsets.zero,
              child: InkWell(
                key: Key('interview_entry_starter_card_${template.id}'),
                onTap: enabled ? () => onTap(template) : null,
                borderRadius: BorderRadius.circular(12),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        template.title(l10n),
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        template.description(l10n),
                        style: Theme.of(context).textTheme.bodySmall
                            ?.copyWith(color: AppColors.textMuted),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

/// IE-02: panel sin tono de error para `OFFER_UNREADABLE` (FR-2).
class _UnreadablePanel extends StatelessWidget {
  const _UnreadablePanel({
    required this.onPasteOfferText,
    required this.onOpenLinkedIn,
  });

  final VoidCallback onPasteOfferText;

  /// `null` si la URL no es de LinkedIn: el botón no se muestra.
  final VoidCallback? onOpenLinkedIn;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.link_off, size: 48, color: AppColors.primary),
            const SizedBox(height: AppSpacing.lg),
            Text(
              l10n.interviewOfferUnreadableTitle,
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              l10n.interviewOfferUnreadableBody,
              style: Theme.of(context).textTheme.bodyMedium,
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.xl),
            ElevatedButton(
              key: const Key('interview_entry_unreadable_paste_button'),
              onPressed: onPasteOfferText,
              child: Text(l10n.interviewOfferUnreadablePasteButton),
            ),
            if (onOpenLinkedIn != null) ...[
              const SizedBox(height: AppSpacing.sm),
              OutlinedButton(
                key: const Key('interview_entry_unreadable_linkedin_button'),
                onPressed: onOpenLinkedIn,
                child: Text(l10n.interviewOfferUnreadableLinkedinButton),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// `true` si la ruta justo debajo de esta es el historial (`/interviews`).
bool _historyIsBelow(BuildContext context) {
  final matches = GoRouter.of(context)
      .routerDelegate
      .currentConfiguration
      .matches;
  return context.canPop() &&
      matches.length >= 2 &&
      matches[matches.length - 2].matchedLocation == '/interviews';
}

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../app/theme.dart';
import '../../../../core/api/models.dart';
import '../../../../core/errors/api_error_snack_bar.dart';
import '../../../../core/errors/api_exception.dart';
import '../../../../core/widgets/async_body.dart';
import '../../../../core/widgets/button_spinner.dart';
import '../../../../l10n/gen/app_localizations.dart';
import '../../data/interviews_repository.dart';
import 'offer_draft_prefs.dart';

/// IE-01 (y sus estados 01a vacío, 01b carga, 01c servicio caído, 01d tope
/// alcanzado) e IE-02 (URL no legible), FR-1, FR-2, FR-21, FR-22, FR-33.
class NewInterviewScreen extends ConsumerStatefulWidget {
  const NewInterviewScreen({super.key});

  @override
  ConsumerState<NewInterviewScreen> createState() =>
      _NewInterviewScreenState();
}

class _NewInterviewScreenState extends ConsumerState<NewInterviewScreen> {
  final _offerController = TextEditingController();
  String _type = 'technical';
  bool _submitting = false;

  /// La última URL enviada que la API no pudo leer (IE-02): si no era una
  /// URL, queda `null` y "Abrir en LinkedIn" cae a la página general.
  String? _unreadableUrl;
  bool _unreadable = false;

  @override
  void initState() {
    super.initState();
    _loadDraft();
    // FR-22: cada cambio queda guardado, así un error o salir de la
    // pantalla no pierde lo que el usuario ya escribió o pegó.
    _offerController.addListener(_onOfferChanged);
  }

  Future<void> _loadDraft() async {
    final draft = await loadOfferDraft();
    if (draft != null && mounted) _offerController.text = draft;
  }

  void _onOfferChanged() {
    saveOfferDraft(_offerController.text);
  }

  @override
  void dispose() {
    _offerController.removeListener(_onOfferChanged);
    _offerController.dispose();
    super.dispose();
  }

  Future<void> _paste() async {
    final data = await Clipboard.getData(Clipboard.kTextPlain);
    final text = data?.text;
    setState(() {
      if (text != null && text.isNotEmpty) _offerController.text = text;
      _unreadable = false;
    });
  }

  Future<void> _openInLinkedIn() async {
    final url = _unreadableUrl ?? 'https://www.linkedin.com/jobs/';
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }

  bool _looksLikeUrl(String text) {
    final uri = Uri.tryParse(text);
    return uri != null &&
        (uri.scheme == 'http' || uri.scheme == 'https') &&
        uri.host.isNotEmpty;
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
    final isUrl = _looksLikeUrl(text);
    try {
      final created = await ref
          .read(interviewsRepositoryProvider)
          .create(
            type: _type,
            offerText: isUrl ? null : text,
            offerUrl: isUrl ? text : null,
          );
      await saveOfferDraft('');
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
      data: (q) => AsyncSnapshot<InterviewQuota>.withData(
        ConnectionState.done,
        q,
      ),
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
            onPressed: () => context.push('/interviews'),
          ),
        ],
      ),
      body: SafeArea(
        child: AsyncBody<InterviewQuota>(
          snapshot: snapshot,
          onRetry: () => ref.invalidate(interviewQuotaProvider),
          builder: (quota) => _unreadable
              ? _UnreadablePanel(
                  onPasteOfferText: _paste,
                  onOpenLinkedIn: _openInLinkedIn,
                )
              : _OfferForm(
                  controller: _offerController,
                  type: _type,
                  quota: quota,
                  submitting: _submitting,
                  onTypeChanged: (value) => setState(() => _type = value),
                  onPaste: _paste,
                  onSubmit: () => _prepare(quota.remaining),
                ),
        ),
      ),
    );
  }
}

class _OfferForm extends StatelessWidget {
  const _OfferForm({
    required this.controller,
    required this.type,
    required this.quota,
    required this.submitting,
    required this.onTypeChanged,
    required this.onPaste,
    required this.onSubmit,
  });

  final TextEditingController controller;
  final String type;
  final InterviewQuota quota;
  final bool submitting;
  final ValueChanged<String> onTypeChanged;
  final VoidCallback onPaste;
  final VoidCallback onSubmit;

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
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: AppColors.textMuted,
            ),
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        TextField(
          key: const Key('interview_entry_offer_field'),
          controller: controller,
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
        const SizedBox(height: AppSpacing.lg),
        SegmentedButton<String>(
          segments: [
            ButtonSegment(
              value: 'technical',
              label: Text(l10n.interviewTypeTechnical),
            ),
            ButtonSegment(
              value: 'mixed',
              label: Text(l10n.interviewTypeMixed),
            ),
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

/// IE-02: panel sin tono de error para `OFFER_UNREADABLE` (FR-2).
class _UnreadablePanel extends StatelessWidget {
  const _UnreadablePanel({
    required this.onPasteOfferText,
    required this.onOpenLinkedIn,
  });

  final VoidCallback onPasteOfferText;
  final VoidCallback onOpenLinkedIn;

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
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              key: const Key('interview_entry_unreadable_linkedin_button'),
              onPressed: onOpenLinkedIn,
              child: Text(l10n.interviewOfferUnreadableLinkedinButton),
            ),
          ],
        ),
      ),
    );
  }
}

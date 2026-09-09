import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../app/theme.dart';
import '../../../core/api/models.dart';
import '../../../core/providers.dart';
import '../../../l10n/gen/app_localizations.dart';

/// Selector de nueva sesión (SPEC-06 §4.2): Temas, Roleplay, Noticias.
class NewSessionScreen extends ConsumerStatefulWidget {
  const NewSessionScreen({super.key});

  @override
  ConsumerState<NewSessionScreen> createState() => _NewSessionScreenState();
}

class _NewSessionScreenState extends ConsumerState<NewSessionScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  late Future<SessionSuggestions> _future;
  final _freeTopicController = TextEditingController();
  bool _starting = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _future = ref.read(fluentApiProvider).getSessionSuggestions();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowMicPrimer());
  }

  /// SPEC-06 §5: la primera vez que se entra acá se explica para qué se
  /// usa el micrófono antes de que el sistema operativo muestre su
  /// propio diálogo de permiso (eso lo dispara `SpeechService.initialize`
  /// más adelante, en la pantalla de conversación).
  Future<void> _maybeShowMicPrimer() async {
    if (ref.read(micPrimerShownProvider)) return;
    ref.read(micPrimerShownProvider.notifier).state = true;
    if (!mounted) return;
    final l10n = AppLocalizations.of(context);
    await showDialog<void>(
      context: context,
      builder:
          (ctx) => AlertDialog(
            title: Text(l10n.micPermissionTitle),
            content: Text(l10n.micPermissionBody),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: Text(l10n.micPermissionContinue),
              ),
            ],
          ),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    _freeTopicController.dispose();
    super.dispose();
  }

  Future<void> _start({
    required String kind,
    String? topic,
    String? roleplayId,
    String? newsItemId,
  }) async {
    if (_starting) return;
    final l10n = AppLocalizations.of(context);
    setState(() => _starting = true);
    try {
      final result = await ref
          .read(fluentApiProvider)
          .createSession(kind: kind, topic: topic, roleplayId: roleplayId, newsItemId: newsItemId);
      if (!mounted) return;
      context.pushReplacement('/session/${result.session.id}');
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(l10n.sessionNewErrorGeneric)));
      }
    } finally {
      if (mounted) setState(() => _starting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.sessionNewTitle),
        bottom: TabBar(
          controller: _tabController,
          tabs: [
            Tab(text: l10n.sessionNewTabTopics),
            Tab(text: l10n.sessionNewTabRoleplay),
            Tab(text: l10n.sessionNewTabNews),
          ],
        ),
      ),
      body: FutureBuilder<SessionSuggestions>(
        future: _future,
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final suggestions = snapshot.data!;
          return TabBarView(
            controller: _tabController,
            children: [
              _TopicsTab(
                topics: suggestions.topics,
                freeTopicController: _freeTopicController,
                starting: _starting,
                onTopic: (topic) => _start(kind: 'free_topic', topic: topic),
                // SPEC-04 §3.2: `free_topic` exige un `topic` no vacío, así
                // que "Surprise me" elige uno al azar de las sugerencias en
                // vez de mandar la petición sin tema (eso siempre daría
                // `400 VALIDATION`).
                onSurpriseMe:
                    suggestions.topics.isEmpty
                        ? null
                        : () => _start(
                          kind: 'free_topic',
                          topic: suggestions.topics[Random().nextInt(suggestions.topics.length)],
                        ),
              ),
              _RoleplayTab(
                roleplays: suggestions.roleplays,
                starting: _starting,
                onSelected: (r) => _start(kind: 'roleplay', roleplayId: r.id),
              ),
              _NewsTab(
                news: suggestions.news,
                starting: _starting,
                onSelected: (n) => _start(kind: 'news', newsItemId: n.id),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _TopicsTab extends StatelessWidget {
  const _TopicsTab({
    required this.topics,
    required this.freeTopicController,
    required this.starting,
    required this.onTopic,
    required this.onSurpriseMe,
  });

  final List<String> topics;
  final TextEditingController freeTopicController;
  final bool starting;
  final ValueChanged<String> onTopic;
  final VoidCallback? onSurpriseMe;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final topic in topics)
              ActionChip(
                label: Text(topic),
                backgroundColor: AppColors.primarySoft,
                onPressed: starting ? null : () => onTopic(topic),
              ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        TextField(
          key: const Key('session_new_free_topic_field'),
          controller: freeTopicController,
          decoration: InputDecoration(labelText: l10n.sessionNewFreeTopicLabel),
          onSubmitted: starting ? null : onTopic,
        ),
        const SizedBox(height: AppSpacing.md),
        ElevatedButton(
          onPressed:
              starting || freeTopicController.text.trim().isEmpty
                  ? null
                  : () => onTopic(freeTopicController.text.trim()),
          child: Text(l10n.sessionNewFreeTopicSubmit),
        ),
        const SizedBox(height: AppSpacing.xl),
        OutlinedButton(
          key: const Key('session_new_surprise_me_button'),
          onPressed: starting ? null : onSurpriseMe,
          child: Text(l10n.sessionNewSurpriseMe),
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          l10n.sessionNewSurpriseMeHint,
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
}

class _RoleplayTab extends StatelessWidget {
  const _RoleplayTab({required this.roleplays, required this.starting, required this.onSelected});

  final List<RoleplayOption> roleplays;
  final bool starting;
  final ValueChanged<RoleplayOption> onSelected;

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      crossAxisCount: 2,
      mainAxisSpacing: AppSpacing.md,
      crossAxisSpacing: AppSpacing.md,
      childAspectRatio: 1.1,
      children: [
        for (final r in roleplays)
          _Card(
            key: Key('roleplay_${r.id}'),
            title: r.title,
            onTap: starting ? null : () => onSelected(r),
          ),
      ],
    );
  }
}

class _NewsTab extends StatelessWidget {
  const _NewsTab({required this.news, required this.starting, required this.onSelected});

  final List<NewsItem> news;
  final bool starting;
  final ValueChanged<NewsItem> onSelected;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.screenPad),
      children: [
        for (final item in news)
          Container(
            key: Key('news_${item.id}'),
            margin: const EdgeInsets.only(bottom: AppSpacing.md),
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
                    Text(item.source, style: Theme.of(context).textTheme.labelSmall),
                    if (item.time != null) ...[
                      const SizedBox(width: AppSpacing.sm),
                      Text(item.time!, style: Theme.of(context).textTheme.labelSmall),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(item.title, style: Theme.of(context).textTheme.titleSmall),
                if (item.summary != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  Text(item.summary!, style: Theme.of(context).textTheme.bodySmall),
                ],
                const SizedBox(height: AppSpacing.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: starting ? null : () => onSelected(item),
                    child: Text(l10n.sessionNewTalkAboutButton),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({super.key, required this.title, required this.onTap});

  final String title;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: AppColors.border),
        ),
        alignment: Alignment.center,
        child: Text(title, textAlign: TextAlign.center, style: Theme.of(context).textTheme.titleSmall),
      ),
    );
  }
}

import 'dart:math';

import '../../features/onboarding/data/interests_catalog.dart';
import '../errors/api_exception.dart';
import 'fluent_api.dart';
import 'models.dart';

/// Implementación de [FluentApi] con datos de ejemplo realistas (María,
/// streak 12, grupo "Los Fluentes") para construir todas las pantallas sin
/// depender de la API real. Se activa con `USE_FAKE_API=true` (por defecto
/// durante el desarrollo del PR-06).
///
/// El estado vive en memoria y se reinicia cada vez que se crea una nueva
/// instancia (cada arranque de la app, o cada test).
class FakeApi implements FluentApi {
  FakeApi({this.artificialDelay = const Duration(milliseconds: 120)}) {
    _seed();
  }

  final Duration artificialDelay;
  final Random _random = Random(7);

  late Profile _profile;
  GroupInfo? _group;
  final List<ProviderInfo> _providers = [];
  ModelPreference? _modelPreference;
  bool _onboarded = true;
  String? _activeSessionId;
  final List<String> _pendingActions = const [];

  final List<GroupMember> _members = [];
  final List<MemoryFact> _pendingFacts = [];
  final List<MemoryFact> _confirmedFacts = [];
  late CoachingBrief _brief;

  final Map<String, SessionInfo> _sessions = {};
  final Map<String, List<TurnRecord>> _sessionTurns = {};
  final Map<String, List<Correction>> _sessionCorrections = {};
  int _sessionCounter = 0;
  int _turnCounter = 0;
  int _sessionsCompletedToday = 1;

  void _seed() {
    _profile = const Profile(
      displayName: 'María',
      level: 'B1',
      interests: ['travel', 'technology', 'movies-series', 'music'],
      timezone: 'America/Argentina/Buenos_Aires',
      locale: 'es',
      xp: 720,
      streak: 12,
      lastSessionDay: '2026-09-08',
    );
    _group = const GroupInfo(
      id: 'group-1',
      name: 'Los Fluentes',
      groupStreak: 9,
    );
    _providers.addAll(const [
      ProviderInfo(
        provider: 'openrouter',
        status: 'active',
        connectedAt: '2026-08-20T10:00:00Z',
      ),
      ProviderInfo(provider: 'gemini', status: 'not_connected'),
    ]);
    _modelPreference = const ModelPreference(
      chatProvider: 'openrouter',
      chatModel: 'meta-llama/llama-3.1-8b-instruct:free',
      briefProvider: 'openrouter',
      briefModel: 'meta-llama/llama-3.1-8b-instruct:free',
    );

    _members.addAll(const [
      GroupMember(
        userId: 'user-maria',
        displayName: 'María',
        level: 'B1',
        xp: 720,
        streak: 12,
        lastSessionDay: '2026-09-08',
      ),
      GroupMember(
        userId: 'user-ana',
        displayName: 'Ana',
        level: 'B2',
        xp: 810,
        streak: 15,
        lastSessionDay: '2026-09-08',
      ),
      GroupMember(
        userId: 'user-carlos',
        displayName: 'Carlos',
        level: 'A2',
        xp: 340,
        streak: 4,
        lastSessionDay: '2026-09-07',
      ),
      GroupMember(
        userId: 'user-sofia',
        displayName: 'Sofía',
        level: 'B1',
        xp: 590,
        streak: 8,
        lastSessionDay: '2026-09-08',
      ),
    ]);

    _pendingFacts.addAll(const [
      MemoryFact(
        id: 'fact-1',
        text: 'Tiene una entrevista de trabajo el 12 de septiembre.',
        status: 'pending',
        happensOn: '2026-09-12',
        sourceSession: 'session-past-1',
      ),
      MemoryFact(
        id: 'fact-2',
        text: 'Está planeando un viaje a Bariloche en octubre.',
        status: 'pending',
        sourceSession: 'session-past-2',
      ),
    ]);
    _confirmedFacts.addAll(const [
      MemoryFact(
        id: 'fact-0',
        text: 'Trabaja como diseñadora de producto.',
        status: 'confirmed',
        sourceSession: 'session-past-0',
      ),
    ]);
    _brief = const CoachingBrief(
      text:
          'María holds a conversation well but rushes past tense forms. '
          'Encourage full sentences before moving on. She responds well to '
          'travel and tech topics.',
      levelHint: 'B1',
      recurringErrors: [
        RecurringError(category: 'past_simple', example: 'I go yesterday'),
        RecurringError(
          category: 'present_perfect',
          example: 'I have went there',
        ),
      ],
      updatedAt: '2026-09-07T22:00:00Z',
    );
  }

  Future<void> _delay() =>
      artificialDelay == Duration.zero
          ? Future.value()
          : Future.delayed(artificialDelay);

  Never _fail(ApiErrorCode code, String message, {int statusCode = 400}) {
    throw ApiException(code: code, message: message, statusCode: statusCode);
  }

  // ---- 4.1 Cuenta y grupo -------------------------------------------------

  @override
  Future<MeResponse> getMe() async {
    await _delay();
    return MeResponse(
      profile: _profile,
      group: _group,
      providers: List.unmodifiable(_providers),
      modelPreference: _modelPreference,
      onboarded: _onboarded,
      activeSessionId: _activeSessionId,
      interestsCatalog: kFallbackInterests,
      pendingActions: _pendingActions,
    );
  }

  @override
  Future<Profile> putProfile({
    required String displayName,
    required String level,
    required List<String> interests,
    required String timezone,
    required String locale,
  }) async {
    await _delay();
    if (interests.length < 3 || interests.length > 5) {
      _fail(ApiErrorCode.validation, 'interests must have 3 to 5 items');
    }
    _profile = _profile.copyWith(
      displayName: displayName,
      level: level,
      interests: interests,
      timezone: timezone,
      locale: locale,
    );
    _onboarded = true;
    return _profile;
  }

  @override
  Future<GroupInfo> redeemInvitation(String code) async {
    await _delay();
    if (code.trim().toUpperCase() == 'INVALID') {
      _fail(ApiErrorCode.invitationInvalid, 'invitation code not found');
    }
    if (code.trim().toUpperCase() == 'USED') {
      _fail(ApiErrorCode.invitationUsed, 'invitation code already used');
    }
    _group = const GroupInfo(
      id: 'group-1',
      name: 'Los Fluentes',
      groupStreak: 9,
    );
    return _group!;
  }

  @override
  Future<List<String>> createInvitations({int count = 1}) async {
    await _delay();
    return List.generate(
      count.clamp(1, 10),
      (i) => 'FLUENT-${_random.nextInt(9000) + 1000}',
    );
  }

  @override
  Future<GroupResponse> getGroup() async {
    await _delay();
    return GroupResponse(group: _group!, members: List.unmodifiable(_members));
  }

  /// Gancho de test: si `deleteAccount()` se llamó.
  bool accountDeleted = false;

  @override
  Future<void> deleteAccount() async {
    await _delay();
    accountDeleted = true;
  }

  // ---- 4.2 Proveedores y modelos ------------------------------------------

  @override
  Future<PkceStartResult> startOpenRouterPkce(String callbackUrl) async {
    await _delay();
    return const PkceStartResult(
      authUrl: 'https://openrouter.ai/auth?fake=1',
      codeVerifierId: 'verifier-fake-1',
    );
  }

  @override
  Future<ProviderStatusResult> completeOpenRouterPkce({
    required String code,
    required String codeVerifierId,
  }) async {
    await _delay();
    _setProviderStatus('openrouter', 'active');
    return const ProviderStatusResult(
      status: 'active',
      credits: ProviderCredits(total: 10, used: 1.2),
    );
  }

  @override
  Future<ProviderStatusResult> connectGemini(String apiKey) async {
    await _delay();
    if (apiKey.trim().isEmpty || apiKey.trim().length < 8) {
      _fail(ApiErrorCode.providerKeyInvalid, 'invalid gemini api key');
    }
    _setProviderStatus('gemini', 'active');
    return const ProviderStatusResult(status: 'active');
  }

  @override
  Future<void> disconnectProvider(String provider) async {
    await _delay();
    _setProviderStatus(provider, 'not_connected');
  }

  @override
  Future<ProviderStatusResult> getProviderStatus(String provider) async {
    await _delay();
    final info = _providers.firstWhere(
      (p) => p.provider == provider,
      orElse:
          () => ProviderInfo(provider: provider, status: 'not_connected'),
    );
    return ProviderStatusResult(
      status: info.status,
      credits:
          provider == 'openrouter' && info.status == 'active'
              ? const ProviderCredits(total: 10, used: 1.2)
              : null,
    );
  }

  void _setProviderStatus(String provider, String status) {
    final idx = _providers.indexWhere((p) => p.provider == provider);
    final updated = ProviderInfo(
      provider: provider,
      status: status,
      connectedAt: status == 'active' ? DateTime.now().toIso8601String() : null,
    );
    if (idx == -1) {
      _providers.add(updated);
    } else {
      _providers[idx] = updated;
    }
  }

  @override
  Future<ModelsCatalog> getModels() async {
    await _delay();
    return const ModelsCatalog(
      providers: {
        'openrouter': ModelTierGroups(
          free: [
            ModelOption(
              id: 'meta-llama/llama-3.1-8b-instruct:free',
              name: 'Llama 3.1 8B (free)',
            ),
            ModelOption(
              id: 'google/gemma-2-9b-it:free',
              name: 'Gemma 2 9B (free)',
            ),
          ],
          budget: [
            ModelOption(
              id: 'meta-llama/llama-3.1-70b-instruct',
              name: 'Llama 3.1 70B',
              pricePerMillionUsd: 0.4,
            ),
          ],
          premium: [
            ModelOption(
              id: 'openai/gpt-4o-mini',
              name: 'GPT-4o mini',
              pricePerMillionUsd: 0.6,
            ),
          ],
        ),
        'gemini': ModelTierGroups(
          free: [
            ModelOption(id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash'),
          ],
        ),
      },
      estimatePerSession: {
        'meta-llama/llama-3.1-8b-instruct:free': 0,
        'google/gemma-2-9b-it:free': 0,
        'meta-llama/llama-3.1-70b-instruct': 0.004,
        'openai/gpt-4o-mini': 0.006,
        'gemini-1.5-flash': 0,
      },
    );
  }

  @override
  Future<ModelPreference> putModelPreference({
    required String chatProvider,
    required String chatModel,
    required String briefProvider,
    required String briefModel,
  }) async {
    await _delay();
    final providerConnected = _providers.any(
      (p) => p.provider == chatProvider && p.status == 'active',
    );
    if (!providerConnected) {
      _fail(ApiErrorCode.modelNotAvailable, 'provider not connected', statusCode: 400);
    }
    _modelPreference = ModelPreference(
      chatProvider: chatProvider,
      chatModel: chatModel,
      briefProvider: briefProvider,
      briefModel: briefModel,
    );
    return _modelPreference!;
  }

  // ---- 4.3 Sesiones ---------------------------------------------------------

  /// Gancho para tests: fuerza `bossPending` en la próxima llamada a
  /// [getSessionSuggestions] sin tener que simular 7 sesiones reales.
  bool bossPending = false;

  @override
  Future<SessionSuggestions> getSessionSuggestions() async {
    await _delay();
    return SessionSuggestions(
      topics: const [
        'Your last trip',
        'A movie you loved',
        'Working from home',
        'Weekend plans',
        'A recipe you know',
        'Learning something new',
      ],
      roleplays: const [
        RoleplayOption(id: 'roleplay-airport', title: 'Checking in at the airport'),
        RoleplayOption(id: 'roleplay-restaurant', title: 'Ordering at a restaurant'),
        RoleplayOption(id: 'roleplay-interview', title: 'Job interview'),
        RoleplayOption(id: 'roleplay-doctor', title: "Doctor's appointment"),
      ],
      news: const [
        NewsItem(
          id: 'news-1',
          title: 'Cities expand bike lanes to cut car traffic',
          source: 'The Guardian',
          summary:
              'More cities are adding protected bike lanes as commuters look for cheaper, faster ways to get around.',
          time: '20 min ago',
        ),
        NewsItem(
          id: 'news-2',
          title: 'New study links short walks to better focus',
          source: 'BBC',
          summary: 'Researchers found a 10-minute walk improved attention span in the afternoon.',
          time: '1 h ago',
        ),
        NewsItem(
          id: 'news-3',
          title: 'Small teams are shipping AI features faster',
          source: 'TechCrunch',
          summary: 'Startups report shorter cycles building with off-the-shelf models.',
          time: '3 h ago',
        ),
        NewsItem(
          id: 'news-4',
          title: 'Airlines add more direct routes to South America',
          source: 'Reuters',
          summary: 'New direct flights are opening between North America and several capitals.',
          time: '5 h ago',
        ),
      ],
      bossPending: bossPending,
    );
  }

  @override
  Future<CreateSessionResult> createSession({
    required String kind,
    String? topic,
    String? roleplayId,
    String? newsItemId,
  }) async {
    await _delay();
    if (_activeSessionId != null) {
      throw ApiException(
        code: ApiErrorCode.sessionAlreadyActive,
        message: 'a session is already active',
        statusCode: 409,
        activeSessionId: _activeSessionId,
      );
    }
    final providerConnected = _providers.any((p) => p.status == 'active');
    if (!providerConnected) {
      _fail(ApiErrorCode.providerNotConnected, 'no provider connected', statusCode: 409);
    }
    _sessionCounter++;
    final id = 'session-$_sessionCounter';
    final resolvedTopic = topic ?? roleplayId ?? newsItemId ?? 'Free talk';
    final session = SessionInfo(
      id: id,
      kind: kind,
      topic: resolvedTopic,
      startedAt: DateTime.now().toIso8601String(),
    );
    _sessions[id] = session;
    _sessionTurns[id] = [];
    _sessionCorrections[id] = [];
    _activeSessionId = id;
    _turnCounter = 0;

    final useCallback = _confirmedFacts.isNotEmpty && _random.nextDouble() < 0.4;
    final opening =
        useCallback
            ? "Hey María! Last time you mentioned you're planning a trip. "
                "Let's talk about ${resolvedTopic.toLowerCase()} — how does that sound?"
            : "Hi María, ready to talk about ${resolvedTopic.toLowerCase()}? Tell me more.";
    _sessionTurns[id]!.add(TurnRecord(idx: 0, role: 'assistant', text: opening));

    return CreateSessionResult(
      session: session,
      opening: SessionOpening(text: opening, callbackUsed: useCallback),
    );
  }

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
  }) async {
    await _delay();
    final session = _sessions[sessionId];
    if (session == null || session.endedAt != null) {
      _fail(ApiErrorCode.sessionNotActive, 'session is not active', statusCode: 409);
    }
    _turnCounter++;
    _sessionTurns[sessionId]!.add(
      TurnRecord(idx: _turnCounter, role: 'user', text: text),
    );

    final hasMistake = _random.nextDouble() < 0.5;
    final corrections = <Correction>[];
    if (hasMistake) {
      corrections.add(
        const Correction(
          original: 'I go there yesterday',
          corrected: 'I went there yesterday',
          category: 'past_simple',
          note: 'Usá el pasado simple para acciones terminadas.',
        ),
      );
      _sessionCorrections[sessionId]!.addAll(corrections);
    }

    final reply =
        "That's interesting! Can you tell me a bit more about why you feel that way?";
    _sessionTurns[sessionId]!.add(
      TurnRecord(idx: _turnCounter, role: 'assistant', text: reply),
    );

    return TurnResult(
      turnIdx: _turnCounter,
      reply: reply,
      corrections: corrections,
      modelUsed: _modelPreference?.chatModel,
      degraded: false,
    );
  }

  @override
  Future<SessionEndResult> endSession({
    required String sessionId,
    required String reason,
  }) async {
    await _delay();
    final session = _sessions[sessionId];
    if (session == null) {
      _fail(ApiErrorCode.sessionNotActive, 'unknown session', statusCode: 409);
    }
    _sessions[sessionId] = session.copyWith(
      endedAt: DateTime.now().toIso8601String(),
      xpEarned: 85,
    );
    _activeSessionId = null;
    _sessionsCompletedToday++;
    final isDoubleDay = _sessionsCompletedToday >= 2;
    final newStreak = _profile.streak + (isDoubleDay ? 1 : 0);
    _profile = _profile.copyWith(xp: _profile.xp + 85, streak: newStreak);

    return SessionEndResult(
      summary: SessionSummary(
        xpEarned: 85,
        streak: newStreak,
        isDoubleDay: isDoubleDay,
        correctionsCount: _sessionCorrections[sessionId]!.length,
        durationSec: 9 * 60 + 40,
        nextIsBoss: newStreak % 7 == 0,
      ),
    );
  }

  @override
  Future<SessionListResult> getSessions({int limit = 20, String? cursor}) async {
    await _delay();
    final items = _sessions.values.toList().reversed.take(limit).toList();
    return SessionListResult(items: items);
  }

  @override
  Future<SessionDetailResult> getSession(String sessionId) async {
    await _delay();
    final session = _sessions[sessionId];
    if (session == null) {
      _fail(ApiErrorCode.sessionNotActive, 'unknown session', statusCode: 404);
    }
    return SessionDetailResult(
      session: session,
      turns: List.unmodifiable(_sessionTurns[sessionId] ?? const []),
      corrections: List.unmodifiable(_sessionCorrections[sessionId] ?? const []),
    );
  }

  // ---- 4.4 Memoria ----------------------------------------------------------

  @override
  Future<MemoryResult> getMemory() async {
    await _delay();
    return MemoryResult(
      facts: FactsBucket(
        pending: List.unmodifiable(_pendingFacts),
        confirmed: List.unmodifiable(_confirmedFacts),
      ),
      brief: _brief,
    );
  }

  @override
  Future<MemoryFact> patchFact({
    required String factId,
    String? status,
    String? text,
  }) async {
    await _delay();
    final pendingIdx = _pendingFacts.indexWhere((f) => f.id == factId);
    final confirmedIdx = _confirmedFacts.indexWhere((f) => f.id == factId);

    MemoryFact current;
    if (pendingIdx != -1) {
      current = _pendingFacts[pendingIdx];
    } else if (confirmedIdx != -1) {
      current = _confirmedFacts[confirmedIdx];
    } else {
      _fail(ApiErrorCode.validation, 'unknown fact', statusCode: 404);
    }

    final updated = current.copyWith(
      text: text ?? current.text,
      status: status ?? current.status,
    );

    if (pendingIdx != -1) _pendingFacts.removeAt(pendingIdx);
    if (confirmedIdx != -1) _confirmedFacts.removeAt(confirmedIdx);

    if (updated.status == 'confirmed') {
      _confirmedFacts.add(updated);
    } else if (updated.status == 'dismissed') {
      // se descarta: no vuelve a ninguna lista
    } else {
      _pendingFacts.add(updated);
    }
    return updated;
  }

  @override
  Future<void> deleteFact(String factId) async {
    await _delay();
    _pendingFacts.removeWhere((f) => f.id == factId);
    _confirmedFacts.removeWhere((f) => f.id == factId);
  }

  @override
  Future<CoachingBrief> putBrief(String text) async {
    await _delay();
    if (text.length > 600) {
      _fail(ApiErrorCode.validation, 'brief must be at most 600 characters');
    }
    _brief = _brief.copyWith(
      text: text,
      updatedAt: DateTime.now().toIso8601String(),
    );
    return _brief;
  }

  @override
  Future<void> forgetAllMemory() async {
    await _delay();
    _pendingFacts.clear();
    _confirmedFacts.clear();
    _brief = _brief.copyWith(text: '', recurringErrors: const []);
  }

  // ---- 4.5 Social y progreso --------------------------------------------

  @override
  Future<ProgressResult> getProgress() async {
    await _delay();
    return ProgressResult(
      xp: _profile.xp,
      level: const LevelInfo(name: 'Conversationalist', min: 440, next: 1000),
      streak: _profile.streak,
      longestStreak: 21,
      sessionsThisWeek: 6,
      correctionsTrend: const [
        CorrectionTrendItem(category: 'past_simple', count30d: 14, count7d: 3),
        CorrectionTrendItem(category: 'present_perfect', count30d: 9, count7d: 1),
        CorrectionTrendItem(category: 'prepositions', count30d: 6, count7d: 2),
      ],
    );
  }

  @override
  Future<LeaderboardResult> getLeaderboard({String? week}) async {
    await _delay();
    final rows =
        _members
            .map(
              (m) => LeaderboardRow(
                userId: m.userId,
                displayName: m.displayName,
                xpWeek: m.xp % 400 + 120,
                sessionsWeek: 4 + (m.streak % 3),
                streak: m.streak,
              ),
            )
            .toList()
          ..sort((a, b) => b.xpWeek.compareTo(a.xpWeek));
    return LeaderboardResult(
      weekStart: '2026-09-07',
      rows: rows,
      groupStreak: _group?.groupStreak ?? 0,
    );
  }

  @override
  Future<List<ChallengeItem>> getChallenges() async {
    await _delay();
    return const [
      ChallengeItem(
        fromUserId: 'user-ana',
        displayName: 'Ana',
        topic: 'traveling solo',
        kind: 'topic',
        sessionId: 'challenge-travel',
      ),
      ChallengeItem(
        fromUserId: 'user-sofia',
        displayName: 'Sofía',
        topic: 'a job interview roleplay',
        kind: 'roleplay',
        sessionId: 'challenge-interview',
      ),
    ];
  }

  @override
  Future<WeeklySummaryResult?> getWeeklySummary({String? week}) async {
    await _delay();
    return const WeeklySummaryResult(
      text:
          '🎉 This week: María led with 720 XP and a 12-day streak! '
          'Los Fluentes practiced 22 sessions together. Keep it up! 💪',
      weekStart: '2026-09-07',
    );
  }
}

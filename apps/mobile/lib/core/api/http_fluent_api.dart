import '../http/api_client.dart';
import 'fluent_api.dart';
import 'models.dart';

/// Implementación real de [FluentApi] contra `{API_URL}/v1` (SPEC-02 §4).
/// Se activa cuando `USE_FAKE_API=false`. La conexión de punta a punta y el
/// pulido de errores quedan para T9, cuando la API esté desplegada.
class HttpFluentApi implements FluentApi {
  HttpFluentApi(this._client);

  final ApiClient _client;

  @override
  Future<MeResponse> getMe() => _client.guard(() async {
    final res = await _client.dio.get('/me');
    return MeResponse.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<Profile> putProfile({
    required String displayName,
    required String level,
    required List<String> interests,
    required String timezone,
    required String locale,
  }) => _client.guard(() async {
    final res = await _client.dio.put(
      '/me/profile',
      data: {
        'displayName': displayName,
        'level': level,
        'interests': interests,
        'timezone': timezone,
        'locale': locale,
      },
    );
    return Profile.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<GroupInfo> redeemInvitation(String code) => _client.guard(() async {
    final res = await _client.dio.post(
      '/invitations/redeem',
      data: {'code': code},
    );
    final data = res.data as Map<String, dynamic>;
    return GroupInfo.fromJson(data['group'] as Map<String, dynamic>);
  });

  @override
  Future<List<String>> createInvitations({int count = 1}) => _client.guard(() async {
    final res = await _client.dio.post(
      '/admin/invitations',
      data: {'count': count},
    );
    final data = res.data as Map<String, dynamic>;
    return (data['codes'] as List).cast<String>();
  });

  @override
  Future<GroupResponse> getGroup() => _client.guard(() async {
    final res = await _client.dio.get('/group');
    return GroupResponse.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<void> deleteAccount() => _client.guard(() async {
    await _client.dio.delete('/me');
  });

  @override
  Future<PkceStartResult> startOpenRouterPkce(String callbackUrl) => _client.guard(() async {
    final res = await _client.dio.post(
      '/providers/openrouter/pkce/start',
      data: {'callbackUrl': callbackUrl},
    );
    return PkceStartResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<ProviderStatusResult> completeOpenRouterPkce({
    required String code,
    required String codeVerifierId,
  }) => _client.guard(() async {
    final res = await _client.dio.post(
      '/providers/openrouter/pkce/complete',
      data: {'code': code, 'codeVerifierId': codeVerifierId},
    );
    return ProviderStatusResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<ProviderStatusResult> connectGemini(String apiKey) => _client.guard(() async {
    final res = await _client.dio.post(
      '/providers/gemini',
      data: {'apiKey': apiKey},
    );
    return ProviderStatusResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<void> disconnectProvider(String provider) => _client.guard(() async {
    await _client.dio.delete('/providers/$provider');
  });

  @override
  Future<ProviderStatusResult> getProviderStatus(String provider) => _client.guard(() async {
    final res = await _client.dio.get('/providers/$provider/status');
    return ProviderStatusResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<ModelsCatalog> getModels() => _client.guard(() async {
    final res = await _client.dio.get('/models');
    return ModelsCatalog.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<ModelPreference> putModelPreference({
    required String chatProvider,
    required String chatModel,
    required String briefProvider,
    required String briefModel,
  }) => _client.guard(() async {
    final res = await _client.dio.put(
      '/me/models',
      data: {
        'chatProvider': chatProvider,
        'chatModel': chatModel,
        'briefProvider': briefProvider,
        'briefModel': briefModel,
      },
    );
    return ModelPreference.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<SessionSuggestions> getSessionSuggestions() => _client.guard(() async {
    final res = await _client.dio.get('/sessions/suggestions');
    return SessionSuggestions.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<CreateSessionResult> createSession({
    required String kind,
    String? topic,
    String? roleplayId,
    String? newsItemId,
  }) => _client.guard(() async {
    final res = await _client.dio.post(
      '/sessions',
      data: {
        'kind': kind,
        'topic': ?topic,
        'roleplayId': ?roleplayId,
        'newsItemId': ?newsItemId,
      },
    );
    return CreateSessionResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
  }) => _client.guard(() async {
    final res = await _client.dio.post(
      '/sessions/$sessionId/turns',
      data: {'text': text},
    );
    return TurnResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<SessionEndResult> endSession({
    required String sessionId,
    required String reason,
  }) => _client.guard(() async {
    final res = await _client.dio.post(
      '/sessions/$sessionId/end',
      data: {'reason': reason},
    );
    return SessionEndResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<SessionListResult> getSessions({int limit = 20, String? cursor}) => _client.guard(() async {
    final res = await _client.dio.get(
      '/sessions',
      queryParameters: {'limit': limit, 'cursor': ?cursor},
    );
    return SessionListResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<SessionDetailResult> getSession(String sessionId) => _client.guard(() async {
    final res = await _client.dio.get('/sessions/$sessionId');
    return SessionDetailResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<MemoryResult> getMemory() => _client.guard(() async {
    final res = await _client.dio.get('/memory');
    return MemoryResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<MemoryFact> patchFact({
    required String factId,
    String? status,
    String? text,
  }) => _client.guard(() async {
    final res = await _client.dio.patch(
      '/memory/facts/$factId',
      data: {'status': ?status, 'text': ?text},
    );
    return MemoryFact.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<void> deleteFact(String factId) => _client.guard(() async {
    await _client.dio.delete('/memory/facts/$factId');
  });

  @override
  Future<CoachingBrief> putBrief(String text) => _client.guard(() async {
    final res = await _client.dio.put('/memory/brief', data: {'text': text});
    return CoachingBrief.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<void> forgetAllMemory() => _client.guard(() async {
    await _client.dio.delete('/memory');
  });

  @override
  Future<ProgressResult> getProgress() => _client.guard(() async {
    final res = await _client.dio.get('/progress');
    return ProgressResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<LeaderboardResult> getLeaderboard({String? week}) => _client.guard(() async {
    final res = await _client.dio.get(
      '/leaderboard',
      queryParameters: {'week': ?week},
    );
    return LeaderboardResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<List<ChallengeItem>> getChallenges() => _client.guard(() async {
    final res = await _client.dio.get('/challenges');
    final data = res.data as Map<String, dynamic>;
    return (data['items'] as List)
        .map((e) => ChallengeItem.fromJson(e as Map<String, dynamic>))
        .toList();
  });

  @override
  Future<WeeklySummaryResult?> getWeeklySummary({String? week}) => _client.guard(() async {
    try {
      final res = await _client.dio.get(
        '/weekly-summary',
        queryParameters: {'week': ?week},
      );
      return WeeklySummaryResult.fromJson(res.data as Map<String, dynamic>);
    } on Exception catch (e) {
      if (e.toString().contains('NOT_READY')) return null;
      rethrow;
    }
  });
}

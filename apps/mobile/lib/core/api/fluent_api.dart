import 'models.dart';

/// Contrato de la API de Fluent (SPEC-02 §4). Todas las pantallas dependen
/// de esta interfaz, nunca de una implementación concreta. `FakeApi` la
/// implementa con datos de ejemplo para construir la UI; `HttpFluentApi` la
/// implementa contra la API real (se activa al apagar `USE_FAKE_API` en T9).
abstract class FluentApi {
  // 4.1 Cuenta y grupo
  Future<MeResponse> getMe();
  Future<Profile> putProfile({
    required String displayName,
    required String level,
    required List<String> interests,
    required String timezone,
    required String locale,
  });
  Future<GroupInfo> redeemInvitation(String code);
  Future<List<String>> createInvitations({int count = 1});
  Future<GroupResponse> getGroup();

  // 4.2 Proveedores y modelos
  Future<PkceStartResult> startOpenRouterPkce(String callbackUrl);
  Future<ProviderStatusResult> completeOpenRouterPkce({
    required String code,
    required String codeVerifierId,
  });
  Future<ProviderStatusResult> connectGemini(String apiKey);
  Future<void> disconnectProvider(String provider);
  Future<ProviderStatusResult> getProviderStatus(String provider);
  Future<ModelsCatalog> getModels();
  Future<ModelPreference> putModelPreference({
    required String chatProvider,
    required String chatModel,
    required String briefProvider,
    required String briefModel,
  });

  // 4.3 Sesiones
  Future<SessionSuggestions> getSessionSuggestions();
  Future<CreateSessionResult> createSession({
    required String kind,
    String? topic,
    String? roleplayId,
    String? newsItemId,
  });
  Future<TurnResult> sendTurn({required String sessionId, required String text});
  Future<SessionEndResult> endSession({
    required String sessionId,
    required String reason,
  });
  Future<SessionListResult> getSessions({int limit = 20, String? cursor});
  Future<SessionDetailResult> getSession(String sessionId);

  // 4.4 Memoria
  Future<MemoryResult> getMemory();
  Future<MemoryFact> patchFact({
    required String factId,
    String? status,
    String? text,
  });
  Future<void> deleteFact(String factId);
  Future<CoachingBrief> putBrief(String text);
  Future<void> forgetAllMemory();

  // 4.5 Social y progreso
  Future<ProgressResult> getProgress();
  Future<LeaderboardResult> getLeaderboard({String? week});
  Future<List<ChallengeItem>> getChallenges();
  Future<WeeklySummaryResult?> getWeeklySummary({String? week});
}

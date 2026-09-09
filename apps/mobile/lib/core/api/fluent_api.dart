import 'models.dart';

/// Contrato de la API de Fluent (SPEC-02 §4). Todas las pantallas dependen
/// de esta interfaz, nunca de una implementación concreta. `FakeApi` la
/// implementa con datos de ejemplo para construir la UI; `HttpFluentApi` la
/// implementa contra la API real (por defecto desde T9, `USE_FAKE_API=false`).
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

  /// Borra la cuenta en cascada (SPEC-06 §9). Después de esto la app debe
  /// cerrar sesión contra InsForge; ese paso lo hace quien llame, no esta
  /// interfaz.
  Future<void> deleteAccount();

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
    /// SPEC-07 §7: solo se manda al aceptar un desafío del grupo; la API la
    /// guarda en `sessions.challenge_from_user_id` para el bono de XP.
    String? challengeFromUserId,
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

import 'package:dio/dio.dart' show CancelToken;

import 'models.dart';
import 'turn_stream_event.dart';

/// Contrato de la API de Fluent (SPEC-02 §4). Todas las pantallas dependen
/// de esta interfaz, nunca de una implementación concreta. `FakeApi` la
/// implementa con datos de ejemplo para construir la UI; `HttpFluentApi` la
/// implementa contra la API real (por defecto desde T9, `USE_FAKE_API=false`).
abstract class FluentApi {
  // 4.1 Cuenta y grupo
  Future<MeResponse> getMe();

  /// MEJ-14: la respuesta incluye `xpAwarded` (+20, una sola vez) cuando
  /// esta llamada completa el onboarding — ver [PutProfileResult].
  Future<PutProfileResult> putProfile({
    required String displayName,
    required String level,
    required List<String> interests,
    required String timezone,
    required String locale,
  });
  Future<GroupInfo> redeemInvitation(String code);
  Future<List<String>> createInvitations({int count = 1});

  /// MEJ-41: `POST /groups/invitations` — a diferencia de
  /// [createInvitations] (solo el owner, `/admin/invitations`), cualquier
  /// miembro puede invitar. Tope de 5 invitaciones sin usar por miembro
  /// (`ApiErrorCode.invitationLimitReached`); sin grupo,
  /// `ApiErrorCode.groupRequired`.
  Future<GroupInvitationResult> createGroupInvitation();
  Future<GroupResponse> getGroup();

  /// Borra la cuenta en cascada (SPEC-06 §9). Después de esto la app debe
  /// cerrar sesión contra InsForge; ese paso lo hace quien llame, no esta
  /// interfaz.
  Future<void> deleteAccount();

  // 4.2 Proveedores y modelos
  Future<PkceStartResult> startOpenRouterPkce(String callbackUrl);
  Future<ProviderStatusResult> completeOpenRouterPkce({
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
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,

    /// MAL-08: la pantalla de conversación cancela este token en su
    /// `dispose()` para no dejar el turno en vuelo si el usuario navega
    /// hacia atrás a mitad de un envío.
    CancelToken? cancelToken,
  });

  /// `POST /sessions/:id/turns/stream` (SPEC-04 §4, RF-3.8). Mismo turno que
  /// [sendTurn], pero el texto del tutor llega por eventos SSE en vez de en
  /// un único cuerpo JSON; ver `turn_stream_event.dart`. Quien consuma este
  /// stream debe tratar el evento `TurnStreamDone` como la fuente de verdad
  /// y caer a [sendTurn] si el stream se corta sin llegar a emitirlo.
  ///
  /// MAL-08: si no llega ningún evento dentro de la ventana de espera (un
  /// proxy que se cuelga sin cortar la conexión), la implementación debe
  /// emitir un `TurnStreamError` con `ApiException(code: streamTimeout)` en
  /// vez de dejar el stream abierto para siempre.
  Stream<TurnStreamEvent> sendTurnStream({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  });
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

  /// Catálogo de insignias con las ganadas por el usuario (ronda 4).
  Future<List<BadgeItem>> getBadges();
  Future<LeaderboardResult> getLeaderboard({String? week});
  Future<List<ChallengeItem>> getChallenges();
  Future<WeeklySummaryResult?> getWeeklySummary({String? week});
}

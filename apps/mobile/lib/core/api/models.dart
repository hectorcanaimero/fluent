import 'package:freezed_annotation/freezed_annotation.dart';

part 'models.freezed.dart';
part 'models.g.dart';

/// Modelos de datos que reflejan las respuestas de la API descritas en
/// SPEC-02 §4. Los nombres de campo respetan el `camelCase` del contrato.

@freezed
abstract class Profile with _$Profile {
  const factory Profile({
    required String displayName,
    required String level,
    required List<String> interests,
    required String timezone,
    required String locale,
    required int xp,
    required int streak,
    String? lastSessionDay,

    /// Foto del login social (https); `null` muestra la inicial.
    String? avatarUrl,

    /// MEJ-20: `GET /me` todavía no lo manda (`ProfileDto` de la API no
    /// tiene `userId`); se lee igual para poder comparar contra
    /// `GroupMember.userId` en vez de por `displayName` en cuanto la API lo
    /// agregue. Mientras tanto queda `null` y `yourGroupPosition` cae al
    /// viejo criterio.
    String? userId,
  }) = _Profile;

  factory Profile.fromJson(Map<String, dynamic> json) =>
      _$ProfileFromJson(json);
}

@freezed
abstract class PutProfileResult with _$PutProfileResult {
  const factory PutProfileResult({
    required Profile profile,

    /// MEJ-14: XP otorgado por completar el onboarding (+20, una sola vez,
    /// SPEC-07). `null` mientras la API no lo mande — la UI no debe
    /// mostrar nada en ese caso, igual que `ProgressResult.grace` (MAL-27).
    int? xpAwarded,
  }) = _PutProfileResult;

  factory PutProfileResult.fromJson(Map<String, dynamic> json) =>
      _$PutProfileResultFromJson(json);
}

@freezed
abstract class GroupInfo with _$GroupInfo {
  const factory GroupInfo({
    required String id,
    required String name,
    @Default(0) int groupStreak,

    /// Grupo al que entra todo usuario nuevo; un código de invitación lo
    /// saca de ahí y lo lleva al grupo de un amigo.
    @Default(false) bool isDefault,
  }) = _GroupInfo;

  factory GroupInfo.fromJson(Map<String, dynamic> json) =>
      _$GroupInfoFromJson(json);
}

@freezed
abstract class ModelPreference with _$ModelPreference {
  const factory ModelPreference({
    String? chatProvider,
    String? chatModel,
    String? briefProvider,
    String? briefModel,
  }) = _ModelPreference;

  factory ModelPreference.fromJson(Map<String, dynamic> json) =>
      _$ModelPreferenceFromJson(json);
}

@freezed
abstract class MeResponse with _$MeResponse {
  const factory MeResponse({
    required Profile profile,
    GroupInfo? group,
    ModelPreference? modelPreference,
    required bool onboarded,
    String? activeSessionId,
    @Default(<String>[]) List<String> interestsCatalog,
    @Default(<String>[]) List<String> pendingActions,

    /// MAL-24: `true` si no hay proveedor propio conectado y todavía no se
    /// usó la sesión de cortesía (con la credencial del owner del grupo,
    /// modelos gratis). `false` por defecto mientras la API no lo mande.
    @Default(false) bool courtesySessionAvailable,

    /// Plan de la cuenta: `free` o `pro`.
    @Default('free') String plan,

    /// Vencimiento del plan Pro; `null` si no vence o es Free.
    DateTime? planExpiresAt,
  }) = _MeResponse;

  factory MeResponse.fromJson(Map<String, dynamic> json) =>
      _$MeResponseFromJson(json);
}

extension MeResponsePlan on MeResponse {
  bool get isPro =>
      plan == 'pro' &&
      (planExpiresAt == null || planExpiresAt!.isAfter(DateTime.now()));
}

@freezed
abstract class GroupMember with _$GroupMember {
  const factory GroupMember({
    required String userId,
    required String displayName,
    required String level,
    required int xp,
    required int streak,
    String? lastSessionDay,

    /// Foto del login social del miembro; `null` muestra la inicial.
    String? avatarUrl,
  }) = _GroupMember;

  factory GroupMember.fromJson(Map<String, dynamic> json) =>
      _$GroupMemberFromJson(json);
}

@freezed
abstract class GroupResponse with _$GroupResponse {
  const factory GroupResponse({
    required GroupInfo group,
    required List<GroupMember> members,
  }) = _GroupResponse;

  factory GroupResponse.fromJson(Map<String, dynamic> json) =>
      _$GroupResponseFromJson(json);
}

/// MEJ-41: `POST /groups/invitations`, disponible para cualquier miembro
/// (no solo el owner, a diferencia de `createInvitations`/`/admin/invitations`).
@freezed
abstract class GroupInvitationResult with _$GroupInvitationResult {
  const factory GroupInvitationResult({
    required String code,
    required String expiresAt,
  }) = _GroupInvitationResult;

  factory GroupInvitationResult.fromJson(Map<String, dynamic> json) =>
      _$GroupInvitationResultFromJson(json);
}

@freezed
abstract class ModelOption with _$ModelOption {
  const factory ModelOption({
    required String id,
    required String name,
    double? pricePerMillionUsd,
  }) = _ModelOption;

  factory ModelOption.fromJson(Map<String, dynamic> json) =>
      _$ModelOptionFromJson(json);
}

@freezed
abstract class ModelTierGroups with _$ModelTierGroups {
  const factory ModelTierGroups({
    @Default(<ModelOption>[]) List<ModelOption> free,
    @Default(<ModelOption>[]) List<ModelOption> budget,
    @Default(<ModelOption>[]) List<ModelOption> premium,
  }) = _ModelTierGroups;

  factory ModelTierGroups.fromJson(Map<String, dynamic> json) =>
      _$ModelTierGroupsFromJson(json);
}

@freezed
abstract class ModelsCatalog with _$ModelsCatalog {
  const factory ModelsCatalog({
    required Map<String, ModelTierGroups> providers,
    @Default(<String, double>{}) Map<String, double> estimatePerSession,
  }) = _ModelsCatalog;

  factory ModelsCatalog.fromJson(Map<String, dynamic> json) =>
      _$ModelsCatalogFromJson(json);
}

@freezed
abstract class RoleplayOption with _$RoleplayOption {
  const factory RoleplayOption({required String id, required String title}) =
      _RoleplayOption;

  factory RoleplayOption.fromJson(Map<String, dynamic> json) =>
      _$RoleplayOptionFromJson(json);
}

@freezed
abstract class NewsItem with _$NewsItem {
  const factory NewsItem({
    required String id,
    required String title,
    required String source,
    String? summary,
    String? time,
  }) = _NewsItem;

  factory NewsItem.fromJson(Map<String, dynamic> json) =>
      _$NewsItemFromJson(json);
}

@freezed
abstract class SessionSuggestions with _$SessionSuggestions {
  const factory SessionSuggestions({
    @Default(<String>[]) List<String> topics,
    @Default(<RoleplayOption>[]) List<RoleplayOption> roleplays,
    @Default(<NewsItem>[]) List<NewsItem> news,
    @Default(false) bool bossPending,
  }) = _SessionSuggestions;

  factory SessionSuggestions.fromJson(Map<String, dynamic> json) =>
      _$SessionSuggestionsFromJson(json);
}

@freezed
abstract class SessionInfo with _$SessionInfo {
  const factory SessionInfo({
    required String id,
    required String kind,
    String? topic,
    required String startedAt,
    String? endedAt,
    int? xpEarned,
    String? modelUsed,

    /// MAL-24: `true` cuando la sesión se abrió con la sesión de cortesía
    /// (credencial del owner del grupo, sin proveedor propio conectado).
    @Default(false) bool courtesy,
  }) = _SessionInfo;

  factory SessionInfo.fromJson(Map<String, dynamic> json) =>
      _$SessionInfoFromJson(json);
}

@freezed
abstract class SessionOpening with _$SessionOpening {
  const factory SessionOpening({
    required String text,
    @Default(false) bool callbackUsed,
  }) = _SessionOpening;

  factory SessionOpening.fromJson(Map<String, dynamic> json) =>
      _$SessionOpeningFromJson(json);
}

@freezed
abstract class CreateSessionResult with _$CreateSessionResult {
  const factory CreateSessionResult({
    required SessionInfo session,
    required SessionOpening opening,
  }) = _CreateSessionResult;

  factory CreateSessionResult.fromJson(Map<String, dynamic> json) =>
      _$CreateSessionResultFromJson(json);
}

@freezed
abstract class Correction with _$Correction {
  const factory Correction({
    required String original,
    required String corrected,
    required String category,
    required String note,
  }) = _Correction;

  factory Correction.fromJson(Map<String, dynamic> json) =>
      _$CorrectionFromJson(json);
}

@freezed
abstract class TurnResult with _$TurnResult {
  const factory TurnResult({
    required int turnIdx,
    required String reply,
    @Default(<Correction>[]) List<Correction> corrections,
    String? modelUsed,
    @Default(false) bool degraded,

    /// Solo `true` cuando la cadena de modelos se agotó (SPEC-03 §6): la API
    /// no manda el campo en el resto de los casos, así que el `false` por
    /// defecto cubre esa ausencia (SPEC-02 §4.3, `docs/specs/SPEC-04-sesion-de-conversacion.md` §4).
    @Default(false) bool unavailable,
  }) = _TurnResult;

  factory TurnResult.fromJson(Map<String, dynamic> json) =>
      _$TurnResultFromJson(json);
}

@freezed
abstract class SessionSummary with _$SessionSummary {
  const factory SessionSummary({
    required int xpEarned,
    required int streak,
    @Default(false) bool isDoubleDay,
    required int correctionsCount,
    required int durationSec,
    @Default(false) bool nextIsBoss,

    /// Ids de las insignias ganadas al cerrar esta sesión (ronda 4).
    @Default(<String>[]) List<String> newBadges,
  }) = _SessionSummary;

  factory SessionSummary.fromJson(Map<String, dynamic> json) =>
      _$SessionSummaryFromJson(json);
}

@freezed
abstract class SessionEndResult with _$SessionEndResult {
  const factory SessionEndResult({required SessionSummary summary}) =
      _SessionEndResult;

  factory SessionEndResult.fromJson(Map<String, dynamic> json) =>
      _$SessionEndResultFromJson(json);
}

@freezed
abstract class SessionListResult with _$SessionListResult {
  const factory SessionListResult({
    required List<SessionInfo> items,
    String? nextCursor,
  }) = _SessionListResult;

  factory SessionListResult.fromJson(Map<String, dynamic> json) =>
      _$SessionListResultFromJson(json);
}

@freezed
abstract class TurnRecord with _$TurnRecord {
  const factory TurnRecord({
    required int idx,
    required String role,
    required String text,
  }) = _TurnRecord;

  factory TurnRecord.fromJson(Map<String, dynamic> json) =>
      _$TurnRecordFromJson(json);
}

@freezed
abstract class SessionDetailResult with _$SessionDetailResult {
  const factory SessionDetailResult({
    required SessionInfo session,
    required List<TurnRecord> turns,
    required List<Correction> corrections,
  }) = _SessionDetailResult;

  factory SessionDetailResult.fromJson(Map<String, dynamic> json) =>
      _$SessionDetailResultFromJson(json);
}

@freezed
abstract class MemoryFact with _$MemoryFact {
  const factory MemoryFact({
    required String id,
    required String text,
    required String status,
    String? happensOn,
    String? sourceSession,
    String? lastUsedAt,
  }) = _MemoryFact;

  factory MemoryFact.fromJson(Map<String, dynamic> json) =>
      _$MemoryFactFromJson(json);
}

@freezed
abstract class FactsBucket with _$FactsBucket {
  const factory FactsBucket({
    @Default(<MemoryFact>[]) List<MemoryFact> pending,
    @Default(<MemoryFact>[]) List<MemoryFact> confirmed,
  }) = _FactsBucket;

  factory FactsBucket.fromJson(Map<String, dynamic> json) =>
      _$FactsBucketFromJson(json);
}

@freezed
abstract class RecurringError with _$RecurringError {
  const factory RecurringError({
    required String category,
    required String example,
  }) = _RecurringError;

  factory RecurringError.fromJson(Map<String, dynamic> json) =>
      _$RecurringErrorFromJson(json);
}

@freezed
abstract class CoachingBrief with _$CoachingBrief {
  const factory CoachingBrief({
    required String text,
    String? levelHint,
    @Default(<RecurringError>[]) List<RecurringError> recurringErrors,
    String? updatedAt,
  }) = _CoachingBrief;

  factory CoachingBrief.fromJson(Map<String, dynamic> json) =>
      _$CoachingBriefFromJson(json);
}

@freezed
abstract class MemoryResult with _$MemoryResult {
  const factory MemoryResult({
    required FactsBucket facts,
    required CoachingBrief brief,
  }) = _MemoryResult;

  factory MemoryResult.fromJson(Map<String, dynamic> json) =>
      _$MemoryResultFromJson(json);
}

@freezed
abstract class LevelInfo with _$LevelInfo {
  const factory LevelInfo({required String name, required int min, int? next}) =
      _LevelInfo;

  factory LevelInfo.fromJson(Map<String, dynamic> json) =>
      _$LevelInfoFromJson(json);
}

@freezed
abstract class CorrectionTrendItem with _$CorrectionTrendItem {
  const factory CorrectionTrendItem({
    required String category,
    required int count30d,
    required int count7d,
  }) = _CorrectionTrendItem;

  factory CorrectionTrendItem.fromJson(Map<String, dynamic> json) =>
      _$CorrectionTrendItemFromJson(json);
}

@freezed
abstract class ProgressResult with _$ProgressResult {
  const factory ProgressResult({
    required int xp,
    required LevelInfo level,
    required int streak,
    required int longestStreak,
    required int sessionsThisWeek,
    @Default(<CorrectionTrendItem>[])
    List<CorrectionTrendItem> correctionsTrend,

    /// MAL-27: `"available"` o `"used"` (semana ISO del usuario). La API
    /// todavía no lo manda (lo agrega Opus en esta misma ola) — `null`
    /// cubre esa ausencia; la UI no debe mostrar nada en ese caso.
    String? grace,
  }) = _ProgressResult;

  factory ProgressResult.fromJson(Map<String, dynamic> json) =>
      _$ProgressResultFromJson(json);
}

@freezed
abstract class LeaderboardRow with _$LeaderboardRow {
  const factory LeaderboardRow({
    required String userId,
    required String displayName,
    required int xpWeek,
    required int sessionsWeek,
    required int streak,

    /// Foto del login social del miembro; `null` muestra la inicial.
    String? avatarUrl,
  }) = _LeaderboardRow;

  factory LeaderboardRow.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardRowFromJson(json);
}

@freezed
abstract class LeaderboardResult with _$LeaderboardResult {
  const factory LeaderboardResult({
    required String weekStart,
    required List<LeaderboardRow> rows,
    @Default(0) int groupStreak,
  }) = _LeaderboardResult;

  factory LeaderboardResult.fromJson(Map<String, dynamic> json) =>
      _$LeaderboardResultFromJson(json);
}

@freezed
abstract class ChallengeItem with _$ChallengeItem {
  const factory ChallengeItem({
    required String fromUserId,
    required String displayName,
    required String topic,
    required String kind,
    required String sessionId,

    /// Foto del miembro que originó el desafío; `null` muestra la inicial.
    String? avatarUrl,
  }) = _ChallengeItem;

  factory ChallengeItem.fromJson(Map<String, dynamic> json) =>
      _$ChallengeItemFromJson(json);
}

@freezed
abstract class WeeklySummaryResult with _$WeeklySummaryResult {
  const factory WeeklySummaryResult({
    required String text,
    required String weekStart,
  }) = _WeeklySummaryResult;

  factory WeeklySummaryResult.fromJson(Map<String, dynamic> json) =>
      _$WeeklySummaryResultFromJson(json);
}

/// Insignia de logros (`GET /me/badges`). El nombre y la condición viven en
/// l10n (ver `badge_labels.dart`); la imagen, en el bucket `badges` de
/// InsForge, así se puede cambiar sin publicar la app.
@freezed
abstract class BadgeItem with _$BadgeItem {
  const factory BadgeItem({
    required String id,

    /// `level`, `streak`, `sessions` o `special`.
    required String category,
    required String imageUrl,

    /// ISO 8601; `null` si todavía está bloqueada.
    String? earnedAt,

    /// Avance hacia la insignia (niveles, rachas, sesiones); `null` en las
    /// especiales.
    int? progressCurrent,
    int? progressTarget,
  }) = _BadgeItem;

  factory BadgeItem.fromJson(Map<String, dynamic> json) =>
      _$BadgeItemFromJson(json);
}

extension BadgeState on BadgeItem {
  bool get isEarned => earnedAt != null;
}

/* ============================================================================
   Simulador de entrevistas (I2, docs/arch/003-simulador-entrevistas.md).
   ========================================================================== */

@freezed
abstract class CompanyInfo with _$CompanyInfo {
  const factory CompanyInfo({
    required String name,
    String? industry,
    String? city,
    String? workMode,
  }) = _CompanyInfo;

  factory CompanyInfo.fromJson(Map<String, dynamic> json) =>
      _$CompanyInfoFromJson(json);
}

/// `GET /interviews/quota` (FR-21, FR-33).
@freezed
abstract class InterviewQuota with _$InterviewQuota {
  const factory InterviewQuota({
    required int remaining,
    required int limit,
    @Default(false) bool requiresPro,
    @Default(true) bool freeNotice,
  }) = _InterviewQuota;

  factory InterviewQuota.fromJson(Map<String, dynamic> json) =>
      _$InterviewQuotaFromJson(json);
}

/// Fila del historial (`GET /interviews`, IE-09, FR-31).
@freezed
abstract class InterviewSummary with _$InterviewSummary {
  const factory InterviewSummary({
    required String id,
    required String type,
    required String status,
    required String createdAt,
    String? role,
    String? area,
    CompanyInfo? company,

    /// `true` si viene de `POST /interviews/:id/reinterview` (FR-19, IE-08).
    @Default(false) bool isReinterview,

    /// Sesiones del ciclo de estudio ya hechas (0–5); `null` si todavía no
    /// se creó el ciclo (`POST /interviews/:id/cycle`).
    int? cycleCompletedSessions,
  }) = _InterviewSummary;

  factory InterviewSummary.fromJson(Map<String, dynamic> json) =>
      _$InterviewSummaryFromJson(json);
}

/// `GET /interviews/:id` (IE-03, IE-04): estado, paso de preparación y, una
/// vez `ready`, la ficha del plan sin exponer las preguntas (FR-7).
@freezed
abstract class InterviewDetail with _$InterviewDetail {
  const factory InterviewDetail({
    required String id,
    required String type,
    required String status,
    required String createdAt,

    /// `reading | researching | designing | done`, solo mientras `preparing`.
    String? prepStep,
    CompanyInfo? company,
    String? role,
    String? area,
    String? seniority,
    int? questionCount,
    int? estimatedMin,

    /// Nombres de las competencias de la rúbrica (nunca las preguntas).
    @Default(<String>[]) List<String> competencies,

    /// Presente en `prep_failed` / `feedback_failed`.
    String? errorCode,
    @Default(false) bool isReinterview,
  }) = _InterviewDetail;

  factory InterviewDetail.fromJson(Map<String, dynamic> json) =>
      _$InterviewDetailFromJson(json);
}

/// `POST /interviews/:id/session` y `POST
/// /interviews/:id/cycle/sessions/:idx/start`: abren o retoman una sesión y
/// devuelven con qué progreso. `answeredCount`/`totalQuestions` solo
/// aplican a la sesión de entrevista, no a las del ciclo de estudio.
@freezed
abstract class InterviewSessionStart with _$InterviewSessionStart {
  const factory InterviewSessionStart({
    required String sessionId,
    int? answeredCount,
    int? totalQuestions,
  }) = _InterviewSessionStart;

  factory InterviewSessionStart.fromJson(Map<String, dynamic> json) =>
      _$InterviewSessionStartFromJson(json);
}

@freezed
abstract class CompetencyFeedback with _$CompetencyFeedback {
  const factory CompetencyFeedback({
    required String competencyId,
    required String observedLevel,
    required String expectedLevel,

    /// Cita literal del candidato (I1: subcadena del transcript).
    required String evidence,
    required String missing,
    required String study,
    required bool verified,
  }) = _CompetencyFeedback;

  factory CompetencyFeedback.fromJson(Map<String, dynamic> json) =>
      _$CompetencyFeedbackFromJson(json);
}

@freezed
abstract class EnglishAspect with _$EnglishAspect {
  const factory EnglishAspect({required String rating, required String note}) =
      _EnglishAspect;

  factory EnglishAspect.fromJson(Map<String, dynamic> json) =>
      _$EnglishAspectFromJson(json);
}

@freezed
abstract class EnglishErrorItem with _$EnglishErrorItem {
  const factory EnglishErrorItem({
    required String original,
    required String corrected,
    required String explanation,
  }) = _EnglishErrorItem;

  factory EnglishErrorItem.fromJson(Map<String, dynamic> json) =>
      _$EnglishErrorItemFromJson(json);
}

@freezed
abstract class EnglishFeedback with _$EnglishFeedback {
  const factory EnglishFeedback({
    required EnglishAspect clarity,
    required EnglishAspect vocabulary,
    @Default(<EnglishErrorItem>[]) List<EnglishErrorItem> errors,
  }) = _EnglishFeedback;

  factory EnglishFeedback.fromJson(Map<String, dynamic> json) =>
      _$EnglishFeedbackFromJson(json);
}

@freezed
abstract class CompetencyComparison with _$CompetencyComparison {
  const factory CompetencyComparison({
    required String competencyId,
    required String before,
    required String after,
    required String trend,
  }) = _CompetencyComparison;

  factory CompetencyComparison.fromJson(Map<String, dynamic> json) =>
      _$CompetencyComparisonFromJson(json);
}

@freezed
abstract class StudyPlanItemDto with _$StudyPlanItemDto {
  const factory StudyPlanItemDto({
    required int idx,
    required String focus,
    required String title,
    required String format,
    required int estMin,
    required String brief,
  }) = _StudyPlanItemDto;

  factory StudyPlanItemDto.fromJson(Map<String, dynamic> json) =>
      _$StudyPlanItemDtoFromJson(json);
}

/// `GET /interviews/:id/feedback` (FR-12, FR-26, FR-27); `409 TOO_SHORT` si
/// hubo menos de 4 respuestas.
@freezed
abstract class InterviewFeedback with _$InterviewFeedback {
  const factory InterviewFeedback({
    required String summary,
    @Default(<CompetencyFeedback>[]) List<CompetencyFeedback> competencies,
    required EnglishFeedback english,

    /// Solo presente en una re-entrevista (FR-19, IE-08).
    List<CompetencyComparison>? comparison,

    /// Exactamente 5 items (invariante de I1).
    @Default(<StudyPlanItemDto>[]) List<StudyPlanItemDto> studyPlan,
  }) = _InterviewFeedback;

  factory InterviewFeedback.fromJson(Map<String, dynamic> json) =>
      _$InterviewFeedbackFromJson(json);
}

/// Sesión del ciclo de estudio (`study_cycle_sessions`), con el estado que
/// ya resuelve la API: `locked | available | done`.
@freezed
abstract class StudyCycleSession with _$StudyCycleSession {
  const factory StudyCycleSession({
    required int idx,
    required String focus,
    required String title,
    required String format,
    required int estMin,
    required String status,
    String? doneAt,
  }) = _StudyCycleSession;

  factory StudyCycleSession.fromJson(Map<String, dynamic> json) =>
      _$StudyCycleSessionFromJson(json);
}

/// `POST`/`GET /interviews/:id/cycle` (FR-17, IE-07).
@freezed
abstract class StudyCycle with _$StudyCycle {
  const factory StudyCycle({
    required String id,
    required String status,
    @Default(<StudyCycleSession>[]) List<StudyCycleSession> sessions,
  }) = _StudyCycle;

  factory StudyCycle.fromJson(Map<String, dynamic> json) =>
      _$StudyCycleFromJson(json);
}

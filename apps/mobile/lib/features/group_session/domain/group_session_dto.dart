import 'package:freezed_annotation/freezed_annotation.dart';

part 'group_session_dto.freezed.dart';
part 'group_session_dto.g.dart';

/// Modelos de la sala grupal (F6, docs/arch/002-sesion-grupal.md §Interfaces).
/// Los nombres y formas calcan el bloque `ts` de esa sección campo a campo.

@freezed
abstract class GroupInitiatorDto with _$GroupInitiatorDto {
  const factory GroupInitiatorDto({required String id, required String name}) =
      _GroupInitiatorDto;

  factory GroupInitiatorDto.fromJson(Map<String, dynamic> json) =>
      _$GroupInitiatorDtoFromJson(json);
}

@freezed
abstract class ParticipantDto with _$ParticipantDto {
  const factory ParticipantDto({
    required String userId,
    required String name,
    String? avatarUrl,
    required bool active,
    required bool shareCorrections,
  }) = _ParticipantDto;

  factory ParticipantDto.fromJson(Map<String, dynamic> json) =>
      _$ParticipantDtoFromJson(json);
}

@freezed
abstract class GroupSessionDto with _$GroupSessionDto {
  const factory GroupSessionDto({
    required String id,
    required String kind,

    /// Nullable: `group_sessions.topic` no tiene `not null` (una sala de
    /// roleplay o noticia puede no llevar tema libre).
    String? topic,
    required GroupInitiatorDto initiator,
    required String status,
    required String startedAt,
    required String endsAt,
    required List<ParticipantDto> participants,
  }) = _GroupSessionDto;

  factory GroupSessionDto.fromJson(Map<String, dynamic> json) =>
      _$GroupSessionDtoFromJson(json);
}

@freezed
abstract class GroupMessageDto with _$GroupMessageDto {
  const factory GroupMessageDto({
    required int id,
    required String role,
    String? authorId,
    required String text,
    String? systemEvent,
    required bool hasAudio,
    int? audioMs,
    required String createdAt,

    /// Presente solo en mensajes propios enviados por esta app: permite
    /// sustituir el mensaje optimista por el confirmado sin duplicarlo
    /// (F6.5.T1, dedup del controller).
    String? clientId,
  }) = _GroupMessageDto;

  factory GroupMessageDto.fromJson(Map<String, dynamic> json) =>
      _$GroupMessageDtoFromJson(json);
}

@freezed
abstract class GroupCorrectionDto with _$GroupCorrectionDto {
  const factory GroupCorrectionDto({
    required int messageId,
    required String authorId,
    required String original,
    required String corrected,
    required String category,
    required String note,
  }) = _GroupCorrectionDto;

  factory GroupCorrectionDto.fromJson(Map<String, dynamic> json) =>
      _$GroupCorrectionDtoFromJson(json);
}

@freezed
abstract class GroupXpEntryDto with _$GroupXpEntryDto {
  const factory GroupXpEntryDto({required String userId, required int xp}) =
      _GroupXpEntryDto;

  factory GroupXpEntryDto.fromJson(Map<String, dynamic> json) =>
      _$GroupXpEntryDtoFromJson(json);
}

@freezed
abstract class GroupRecapHighlightDto with _$GroupRecapHighlightDto {
  const factory GroupRecapHighlightDto({
    required String userId,
    required String quote,
  }) = _GroupRecapHighlightDto;

  factory GroupRecapHighlightDto.fromJson(Map<String, dynamic> json) =>
      _$GroupRecapHighlightDtoFromJson(json);
}

/// `GroupRecapOutput` (docs/arch/002-sesion-grupal.md línea ~269), expuesto
/// al cliente como `recap` en el stream y en `GroupSessionDetailDto`.
@freezed
abstract class GroupRecapDto with _$GroupRecapDto {
  const factory GroupRecapDto({
    required List<String> topics,
    required List<GroupRecapHighlightDto> highlights,
  }) = _GroupRecapDto;

  factory GroupRecapDto.fromJson(Map<String, dynamic> json) =>
      _$GroupRecapDtoFromJson(json);
}

@freezed
abstract class GroupSessionDetailDto with _$GroupSessionDetailDto {
  const factory GroupSessionDetailDto({
    required String id,
    required String kind,
    String? topic,
    required GroupInitiatorDto initiator,
    required String status,
    required String startedAt,
    required String endsAt,
    required List<ParticipantDto> participants,
    required List<GroupMessageDto> messages,

    /// Solo las correcciones visibles para quien pidió el detalle (propias,
    /// más las de quienes comparten).
    required List<GroupCorrectionDto> corrections,
    GroupRecapDto? recap,
    List<GroupXpEntryDto>? xp,
  }) = _GroupSessionDetailDto;

  factory GroupSessionDetailDto.fromJson(Map<String, dynamic> json) =>
      _$GroupSessionDetailDtoFromJson(json);
}

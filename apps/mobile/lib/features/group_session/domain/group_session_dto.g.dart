// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'group_session_dto.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_GroupInitiatorDto _$GroupInitiatorDtoFromJson(Map<String, dynamic> json) =>
    _GroupInitiatorDto(id: json['id'] as String, name: json['name'] as String);

Map<String, dynamic> _$GroupInitiatorDtoToJson(_GroupInitiatorDto instance) =>
    <String, dynamic>{'id': instance.id, 'name': instance.name};

_ParticipantDto _$ParticipantDtoFromJson(Map<String, dynamic> json) =>
    _ParticipantDto(
      userId: json['userId'] as String,
      name: json['name'] as String,
      avatarUrl: json['avatarUrl'] as String?,
      active: json['active'] as bool,
      shareCorrections: json['shareCorrections'] as bool,
    );

Map<String, dynamic> _$ParticipantDtoToJson(_ParticipantDto instance) =>
    <String, dynamic>{
      'userId': instance.userId,
      'name': instance.name,
      'avatarUrl': instance.avatarUrl,
      'active': instance.active,
      'shareCorrections': instance.shareCorrections,
    };

_GroupSessionDto _$GroupSessionDtoFromJson(Map<String, dynamic> json) =>
    _GroupSessionDto(
      id: json['id'] as String,
      kind: json['kind'] as String,
      topic: json['topic'] as String?,
      initiator: GroupInitiatorDto.fromJson(
        json['initiator'] as Map<String, dynamic>,
      ),
      status: json['status'] as String,
      startedAt: json['startedAt'] as String,
      endsAt: json['endsAt'] as String,
      participants: (json['participants'] as List<dynamic>)
          .map((e) => ParticipantDto.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$GroupSessionDtoToJson(_GroupSessionDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': instance.kind,
      'topic': instance.topic,
      'initiator': instance.initiator,
      'status': instance.status,
      'startedAt': instance.startedAt,
      'endsAt': instance.endsAt,
      'participants': instance.participants,
    };

_GroupMessageDto _$GroupMessageDtoFromJson(Map<String, dynamic> json) =>
    _GroupMessageDto(
      id: (json['id'] as num).toInt(),
      role: json['role'] as String,
      authorId: json['authorId'] as String?,
      text: json['text'] as String,
      systemEvent: json['systemEvent'] as String?,
      hasAudio: json['hasAudio'] as bool,
      audioMs: (json['audioMs'] as num?)?.toInt(),
      createdAt: json['createdAt'] as String,
      clientId: json['clientId'] as String?,
    );

Map<String, dynamic> _$GroupMessageDtoToJson(_GroupMessageDto instance) =>
    <String, dynamic>{
      'id': instance.id,
      'role': instance.role,
      'authorId': instance.authorId,
      'text': instance.text,
      'systemEvent': instance.systemEvent,
      'hasAudio': instance.hasAudio,
      'audioMs': instance.audioMs,
      'createdAt': instance.createdAt,
      'clientId': instance.clientId,
    };

_GroupCorrectionDto _$GroupCorrectionDtoFromJson(Map<String, dynamic> json) =>
    _GroupCorrectionDto(
      messageId: (json['messageId'] as num).toInt(),
      authorId: json['authorId'] as String,
      original: json['original'] as String,
      corrected: json['corrected'] as String,
      category: json['category'] as String,
      note: json['note'] as String,
    );

Map<String, dynamic> _$GroupCorrectionDtoToJson(_GroupCorrectionDto instance) =>
    <String, dynamic>{
      'messageId': instance.messageId,
      'authorId': instance.authorId,
      'original': instance.original,
      'corrected': instance.corrected,
      'category': instance.category,
      'note': instance.note,
    };

_GroupXpEntryDto _$GroupXpEntryDtoFromJson(Map<String, dynamic> json) =>
    _GroupXpEntryDto(
      userId: json['userId'] as String,
      xp: (json['xp'] as num).toInt(),
    );

Map<String, dynamic> _$GroupXpEntryDtoToJson(_GroupXpEntryDto instance) =>
    <String, dynamic>{'userId': instance.userId, 'xp': instance.xp};

_GroupRecapHighlightDto _$GroupRecapHighlightDtoFromJson(
  Map<String, dynamic> json,
) => _GroupRecapHighlightDto(
  userId: json['userId'] as String,
  quote: json['quote'] as String,
);

Map<String, dynamic> _$GroupRecapHighlightDtoToJson(
  _GroupRecapHighlightDto instance,
) => <String, dynamic>{'userId': instance.userId, 'quote': instance.quote};

_GroupRecapDto _$GroupRecapDtoFromJson(
  Map<String, dynamic> json,
) => _GroupRecapDto(
  topics: (json['topics'] as List<dynamic>).map((e) => e as String).toList(),
  highlights: (json['highlights'] as List<dynamic>)
      .map((e) => GroupRecapHighlightDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$GroupRecapDtoToJson(_GroupRecapDto instance) =>
    <String, dynamic>{
      'topics': instance.topics,
      'highlights': instance.highlights,
    };

_GroupSessionDetailDto _$GroupSessionDetailDtoFromJson(
  Map<String, dynamic> json,
) => _GroupSessionDetailDto(
  id: json['id'] as String,
  kind: json['kind'] as String,
  topic: json['topic'] as String?,
  initiator: GroupInitiatorDto.fromJson(
    json['initiator'] as Map<String, dynamic>,
  ),
  status: json['status'] as String,
  startedAt: json['startedAt'] as String,
  endsAt: json['endsAt'] as String,
  participants: (json['participants'] as List<dynamic>)
      .map((e) => ParticipantDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  messages: (json['messages'] as List<dynamic>)
      .map((e) => GroupMessageDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  corrections: (json['corrections'] as List<dynamic>)
      .map((e) => GroupCorrectionDto.fromJson(e as Map<String, dynamic>))
      .toList(),
  recap: json['recap'] == null
      ? null
      : GroupRecapDto.fromJson(json['recap'] as Map<String, dynamic>),
  xp: (json['xp'] as List<dynamic>?)
      ?.map((e) => GroupXpEntryDto.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$GroupSessionDetailDtoToJson(
  _GroupSessionDetailDto instance,
) => <String, dynamic>{
  'id': instance.id,
  'kind': instance.kind,
  'topic': instance.topic,
  'initiator': instance.initiator,
  'status': instance.status,
  'startedAt': instance.startedAt,
  'endsAt': instance.endsAt,
  'participants': instance.participants,
  'messages': instance.messages,
  'corrections': instance.corrections,
  'recap': instance.recap,
  'xp': instance.xp,
};

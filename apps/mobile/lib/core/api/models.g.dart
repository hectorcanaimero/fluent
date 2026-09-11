// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'models.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_Profile _$ProfileFromJson(Map<String, dynamic> json) => _Profile(
  displayName: json['displayName'] as String,
  level: json['level'] as String,
  interests: (json['interests'] as List<dynamic>)
      .map((e) => e as String)
      .toList(),
  timezone: json['timezone'] as String,
  locale: json['locale'] as String,
  xp: (json['xp'] as num).toInt(),
  streak: (json['streak'] as num).toInt(),
  lastSessionDay: json['lastSessionDay'] as String?,
  userId: json['userId'] as String?,
);

Map<String, dynamic> _$ProfileToJson(_Profile instance) => <String, dynamic>{
  'displayName': instance.displayName,
  'level': instance.level,
  'interests': instance.interests,
  'timezone': instance.timezone,
  'locale': instance.locale,
  'xp': instance.xp,
  'streak': instance.streak,
  'lastSessionDay': instance.lastSessionDay,
  'userId': instance.userId,
};

_GroupInfo _$GroupInfoFromJson(Map<String, dynamic> json) => _GroupInfo(
  id: json['id'] as String,
  name: json['name'] as String,
  groupStreak: (json['groupStreak'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$GroupInfoToJson(_GroupInfo instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'groupStreak': instance.groupStreak,
    };

_ProviderInfo _$ProviderInfoFromJson(Map<String, dynamic> json) =>
    _ProviderInfo(
      provider: json['provider'] as String,
      status: json['status'] as String,
      connectedAt: json['connectedAt'] as String?,
    );

Map<String, dynamic> _$ProviderInfoToJson(_ProviderInfo instance) =>
    <String, dynamic>{
      'provider': instance.provider,
      'status': instance.status,
      'connectedAt': instance.connectedAt,
    };

_ModelPreference _$ModelPreferenceFromJson(Map<String, dynamic> json) =>
    _ModelPreference(
      chatProvider: json['chatProvider'] as String?,
      chatModel: json['chatModel'] as String?,
      briefProvider: json['briefProvider'] as String?,
      briefModel: json['briefModel'] as String?,
    );

Map<String, dynamic> _$ModelPreferenceToJson(_ModelPreference instance) =>
    <String, dynamic>{
      'chatProvider': instance.chatProvider,
      'chatModel': instance.chatModel,
      'briefProvider': instance.briefProvider,
      'briefModel': instance.briefModel,
    };

_MeResponse _$MeResponseFromJson(Map<String, dynamic> json) => _MeResponse(
  profile: Profile.fromJson(json['profile'] as Map<String, dynamic>),
  group: json['group'] == null
      ? null
      : GroupInfo.fromJson(json['group'] as Map<String, dynamic>),
  providers:
      (json['providers'] as List<dynamic>?)
          ?.map((e) => ProviderInfo.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <ProviderInfo>[],
  modelPreference: json['modelPreference'] == null
      ? null
      : ModelPreference.fromJson(
          json['modelPreference'] as Map<String, dynamic>,
        ),
  onboarded: json['onboarded'] as bool,
  activeSessionId: json['activeSessionId'] as String?,
  interestsCatalog:
      (json['interestsCatalog'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList() ??
      const <String>[],
  pendingActions:
      (json['pendingActions'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList() ??
      const <String>[],
);

Map<String, dynamic> _$MeResponseToJson(_MeResponse instance) =>
    <String, dynamic>{
      'profile': instance.profile,
      'group': instance.group,
      'providers': instance.providers,
      'modelPreference': instance.modelPreference,
      'onboarded': instance.onboarded,
      'activeSessionId': instance.activeSessionId,
      'interestsCatalog': instance.interestsCatalog,
      'pendingActions': instance.pendingActions,
    };

_GroupMember _$GroupMemberFromJson(Map<String, dynamic> json) => _GroupMember(
  userId: json['userId'] as String,
  displayName: json['displayName'] as String,
  level: json['level'] as String,
  xp: (json['xp'] as num).toInt(),
  streak: (json['streak'] as num).toInt(),
  lastSessionDay: json['lastSessionDay'] as String?,
);

Map<String, dynamic> _$GroupMemberToJson(_GroupMember instance) =>
    <String, dynamic>{
      'userId': instance.userId,
      'displayName': instance.displayName,
      'level': instance.level,
      'xp': instance.xp,
      'streak': instance.streak,
      'lastSessionDay': instance.lastSessionDay,
    };

_GroupResponse _$GroupResponseFromJson(Map<String, dynamic> json) =>
    _GroupResponse(
      group: GroupInfo.fromJson(json['group'] as Map<String, dynamic>),
      members: (json['members'] as List<dynamic>)
          .map((e) => GroupMember.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$GroupResponseToJson(_GroupResponse instance) =>
    <String, dynamic>{'group': instance.group, 'members': instance.members};

_PkceStartResult _$PkceStartResultFromJson(Map<String, dynamic> json) =>
    _PkceStartResult(
      authUrl: json['authUrl'] as String,
      codeVerifierId: json['codeVerifierId'] as String,
    );

Map<String, dynamic> _$PkceStartResultToJson(_PkceStartResult instance) =>
    <String, dynamic>{
      'authUrl': instance.authUrl,
      'codeVerifierId': instance.codeVerifierId,
    };

_ProviderCredits _$ProviderCreditsFromJson(Map<String, dynamic> json) =>
    _ProviderCredits(
      total: (json['total'] as num).toDouble(),
      used: (json['used'] as num).toDouble(),
    );

Map<String, dynamic> _$ProviderCreditsToJson(_ProviderCredits instance) =>
    <String, dynamic>{'total': instance.total, 'used': instance.used};

_ProviderStatusResult _$ProviderStatusResultFromJson(
  Map<String, dynamic> json,
) => _ProviderStatusResult(
  status: json['status'] as String,
  lastError: json['lastError'] as String?,
  credits: json['credits'] == null
      ? null
      : ProviderCredits.fromJson(json['credits'] as Map<String, dynamic>),
);

Map<String, dynamic> _$ProviderStatusResultToJson(
  _ProviderStatusResult instance,
) => <String, dynamic>{
  'status': instance.status,
  'lastError': instance.lastError,
  'credits': instance.credits,
};

_ModelOption _$ModelOptionFromJson(Map<String, dynamic> json) => _ModelOption(
  id: json['id'] as String,
  name: json['name'] as String,
  pricePerMillionUsd: (json['pricePerMillionUsd'] as num?)?.toDouble(),
);

Map<String, dynamic> _$ModelOptionToJson(_ModelOption instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'pricePerMillionUsd': instance.pricePerMillionUsd,
    };

_ModelTierGroups _$ModelTierGroupsFromJson(Map<String, dynamic> json) =>
    _ModelTierGroups(
      free:
          (json['free'] as List<dynamic>?)
              ?.map((e) => ModelOption.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ModelOption>[],
      budget:
          (json['budget'] as List<dynamic>?)
              ?.map((e) => ModelOption.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ModelOption>[],
      premium:
          (json['premium'] as List<dynamic>?)
              ?.map((e) => ModelOption.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <ModelOption>[],
    );

Map<String, dynamic> _$ModelTierGroupsToJson(_ModelTierGroups instance) =>
    <String, dynamic>{
      'free': instance.free,
      'budget': instance.budget,
      'premium': instance.premium,
    };

_ModelsCatalog _$ModelsCatalogFromJson(Map<String, dynamic> json) =>
    _ModelsCatalog(
      providers: (json['providers'] as Map<String, dynamic>).map(
        (k, e) =>
            MapEntry(k, ModelTierGroups.fromJson(e as Map<String, dynamic>)),
      ),
      estimatePerSession:
          (json['estimatePerSession'] as Map<String, dynamic>?)?.map(
            (k, e) => MapEntry(k, (e as num).toDouble()),
          ) ??
          const <String, double>{},
    );

Map<String, dynamic> _$ModelsCatalogToJson(_ModelsCatalog instance) =>
    <String, dynamic>{
      'providers': instance.providers,
      'estimatePerSession': instance.estimatePerSession,
    };

_RoleplayOption _$RoleplayOptionFromJson(Map<String, dynamic> json) =>
    _RoleplayOption(id: json['id'] as String, title: json['title'] as String);

Map<String, dynamic> _$RoleplayOptionToJson(_RoleplayOption instance) =>
    <String, dynamic>{'id': instance.id, 'title': instance.title};

_NewsItem _$NewsItemFromJson(Map<String, dynamic> json) => _NewsItem(
  id: json['id'] as String,
  title: json['title'] as String,
  source: json['source'] as String,
  summary: json['summary'] as String?,
  time: json['time'] as String?,
);

Map<String, dynamic> _$NewsItemToJson(_NewsItem instance) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'source': instance.source,
  'summary': instance.summary,
  'time': instance.time,
};

_SessionSuggestions _$SessionSuggestionsFromJson(Map<String, dynamic> json) =>
    _SessionSuggestions(
      topics:
          (json['topics'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const <String>[],
      roleplays:
          (json['roleplays'] as List<dynamic>?)
              ?.map((e) => RoleplayOption.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <RoleplayOption>[],
      news:
          (json['news'] as List<dynamic>?)
              ?.map((e) => NewsItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <NewsItem>[],
      bossPending: json['bossPending'] as bool? ?? false,
    );

Map<String, dynamic> _$SessionSuggestionsToJson(_SessionSuggestions instance) =>
    <String, dynamic>{
      'topics': instance.topics,
      'roleplays': instance.roleplays,
      'news': instance.news,
      'bossPending': instance.bossPending,
    };

_SessionInfo _$SessionInfoFromJson(Map<String, dynamic> json) => _SessionInfo(
  id: json['id'] as String,
  kind: json['kind'] as String,
  topic: json['topic'] as String?,
  startedAt: json['startedAt'] as String,
  endedAt: json['endedAt'] as String?,
  xpEarned: (json['xpEarned'] as num?)?.toInt(),
  modelUsed: json['modelUsed'] as String?,
);

Map<String, dynamic> _$SessionInfoToJson(_SessionInfo instance) =>
    <String, dynamic>{
      'id': instance.id,
      'kind': instance.kind,
      'topic': instance.topic,
      'startedAt': instance.startedAt,
      'endedAt': instance.endedAt,
      'xpEarned': instance.xpEarned,
      'modelUsed': instance.modelUsed,
    };

_SessionOpening _$SessionOpeningFromJson(Map<String, dynamic> json) =>
    _SessionOpening(
      text: json['text'] as String,
      callbackUsed: json['callbackUsed'] as bool? ?? false,
    );

Map<String, dynamic> _$SessionOpeningToJson(_SessionOpening instance) =>
    <String, dynamic>{
      'text': instance.text,
      'callbackUsed': instance.callbackUsed,
    };

_CreateSessionResult _$CreateSessionResultFromJson(Map<String, dynamic> json) =>
    _CreateSessionResult(
      session: SessionInfo.fromJson(json['session'] as Map<String, dynamic>),
      opening: SessionOpening.fromJson(json['opening'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$CreateSessionResultToJson(
  _CreateSessionResult instance,
) => <String, dynamic>{
  'session': instance.session,
  'opening': instance.opening,
};

_Correction _$CorrectionFromJson(Map<String, dynamic> json) => _Correction(
  original: json['original'] as String,
  corrected: json['corrected'] as String,
  category: json['category'] as String,
  note: json['note'] as String,
);

Map<String, dynamic> _$CorrectionToJson(_Correction instance) =>
    <String, dynamic>{
      'original': instance.original,
      'corrected': instance.corrected,
      'category': instance.category,
      'note': instance.note,
    };

_TurnResult _$TurnResultFromJson(Map<String, dynamic> json) => _TurnResult(
  turnIdx: (json['turnIdx'] as num).toInt(),
  reply: json['reply'] as String,
  corrections:
      (json['corrections'] as List<dynamic>?)
          ?.map((e) => Correction.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <Correction>[],
  modelUsed: json['modelUsed'] as String?,
  degraded: json['degraded'] as bool? ?? false,
  unavailable: json['unavailable'] as bool? ?? false,
);

Map<String, dynamic> _$TurnResultToJson(_TurnResult instance) =>
    <String, dynamic>{
      'turnIdx': instance.turnIdx,
      'reply': instance.reply,
      'corrections': instance.corrections,
      'modelUsed': instance.modelUsed,
      'degraded': instance.degraded,
      'unavailable': instance.unavailable,
    };

_SessionSummary _$SessionSummaryFromJson(Map<String, dynamic> json) =>
    _SessionSummary(
      xpEarned: (json['xpEarned'] as num).toInt(),
      streak: (json['streak'] as num).toInt(),
      isDoubleDay: json['isDoubleDay'] as bool? ?? false,
      correctionsCount: (json['correctionsCount'] as num).toInt(),
      durationSec: (json['durationSec'] as num).toInt(),
      nextIsBoss: json['nextIsBoss'] as bool? ?? false,
    );

Map<String, dynamic> _$SessionSummaryToJson(_SessionSummary instance) =>
    <String, dynamic>{
      'xpEarned': instance.xpEarned,
      'streak': instance.streak,
      'isDoubleDay': instance.isDoubleDay,
      'correctionsCount': instance.correctionsCount,
      'durationSec': instance.durationSec,
      'nextIsBoss': instance.nextIsBoss,
    };

_SessionEndResult _$SessionEndResultFromJson(Map<String, dynamic> json) =>
    _SessionEndResult(
      summary: SessionSummary.fromJson(json['summary'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$SessionEndResultToJson(_SessionEndResult instance) =>
    <String, dynamic>{'summary': instance.summary};

_SessionListResult _$SessionListResultFromJson(Map<String, dynamic> json) =>
    _SessionListResult(
      items: (json['items'] as List<dynamic>)
          .map((e) => SessionInfo.fromJson(e as Map<String, dynamic>))
          .toList(),
      nextCursor: json['nextCursor'] as String?,
    );

Map<String, dynamic> _$SessionListResultToJson(_SessionListResult instance) =>
    <String, dynamic>{
      'items': instance.items,
      'nextCursor': instance.nextCursor,
    };

_TurnRecord _$TurnRecordFromJson(Map<String, dynamic> json) => _TurnRecord(
  idx: (json['idx'] as num).toInt(),
  role: json['role'] as String,
  text: json['text'] as String,
);

Map<String, dynamic> _$TurnRecordToJson(_TurnRecord instance) =>
    <String, dynamic>{
      'idx': instance.idx,
      'role': instance.role,
      'text': instance.text,
    };

_SessionDetailResult _$SessionDetailResultFromJson(Map<String, dynamic> json) =>
    _SessionDetailResult(
      session: SessionInfo.fromJson(json['session'] as Map<String, dynamic>),
      turns: (json['turns'] as List<dynamic>)
          .map((e) => TurnRecord.fromJson(e as Map<String, dynamic>))
          .toList(),
      corrections: (json['corrections'] as List<dynamic>)
          .map((e) => Correction.fromJson(e as Map<String, dynamic>))
          .toList(),
    );

Map<String, dynamic> _$SessionDetailResultToJson(
  _SessionDetailResult instance,
) => <String, dynamic>{
  'session': instance.session,
  'turns': instance.turns,
  'corrections': instance.corrections,
};

_MemoryFact _$MemoryFactFromJson(Map<String, dynamic> json) => _MemoryFact(
  id: json['id'] as String,
  text: json['text'] as String,
  status: json['status'] as String,
  happensOn: json['happensOn'] as String?,
  sourceSession: json['sourceSession'] as String?,
  lastUsedAt: json['lastUsedAt'] as String?,
);

Map<String, dynamic> _$MemoryFactToJson(_MemoryFact instance) =>
    <String, dynamic>{
      'id': instance.id,
      'text': instance.text,
      'status': instance.status,
      'happensOn': instance.happensOn,
      'sourceSession': instance.sourceSession,
      'lastUsedAt': instance.lastUsedAt,
    };

_FactsBucket _$FactsBucketFromJson(Map<String, dynamic> json) => _FactsBucket(
  pending:
      (json['pending'] as List<dynamic>?)
          ?.map((e) => MemoryFact.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <MemoryFact>[],
  confirmed:
      (json['confirmed'] as List<dynamic>?)
          ?.map((e) => MemoryFact.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const <MemoryFact>[],
);

Map<String, dynamic> _$FactsBucketToJson(_FactsBucket instance) =>
    <String, dynamic>{
      'pending': instance.pending,
      'confirmed': instance.confirmed,
    };

_RecurringError _$RecurringErrorFromJson(Map<String, dynamic> json) =>
    _RecurringError(
      category: json['category'] as String,
      example: json['example'] as String,
    );

Map<String, dynamic> _$RecurringErrorToJson(_RecurringError instance) =>
    <String, dynamic>{
      'category': instance.category,
      'example': instance.example,
    };

_CoachingBrief _$CoachingBriefFromJson(Map<String, dynamic> json) =>
    _CoachingBrief(
      text: json['text'] as String,
      levelHint: json['levelHint'] as String?,
      recurringErrors:
          (json['recurringErrors'] as List<dynamic>?)
              ?.map((e) => RecurringError.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const <RecurringError>[],
      updatedAt: json['updatedAt'] as String?,
    );

Map<String, dynamic> _$CoachingBriefToJson(_CoachingBrief instance) =>
    <String, dynamic>{
      'text': instance.text,
      'levelHint': instance.levelHint,
      'recurringErrors': instance.recurringErrors,
      'updatedAt': instance.updatedAt,
    };

_MemoryResult _$MemoryResultFromJson(Map<String, dynamic> json) =>
    _MemoryResult(
      facts: FactsBucket.fromJson(json['facts'] as Map<String, dynamic>),
      brief: CoachingBrief.fromJson(json['brief'] as Map<String, dynamic>),
    );

Map<String, dynamic> _$MemoryResultToJson(_MemoryResult instance) =>
    <String, dynamic>{'facts': instance.facts, 'brief': instance.brief};

_LevelInfo _$LevelInfoFromJson(Map<String, dynamic> json) => _LevelInfo(
  name: json['name'] as String,
  min: (json['min'] as num).toInt(),
  next: (json['next'] as num?)?.toInt(),
);

Map<String, dynamic> _$LevelInfoToJson(_LevelInfo instance) =>
    <String, dynamic>{
      'name': instance.name,
      'min': instance.min,
      'next': instance.next,
    };

_CorrectionTrendItem _$CorrectionTrendItemFromJson(Map<String, dynamic> json) =>
    _CorrectionTrendItem(
      category: json['category'] as String,
      count30d: (json['count30d'] as num).toInt(),
      count7d: (json['count7d'] as num).toInt(),
    );

Map<String, dynamic> _$CorrectionTrendItemToJson(
  _CorrectionTrendItem instance,
) => <String, dynamic>{
  'category': instance.category,
  'count30d': instance.count30d,
  'count7d': instance.count7d,
};

_ProgressResult _$ProgressResultFromJson(Map<String, dynamic> json) =>
    _ProgressResult(
      xp: (json['xp'] as num).toInt(),
      level: LevelInfo.fromJson(json['level'] as Map<String, dynamic>),
      streak: (json['streak'] as num).toInt(),
      longestStreak: (json['longestStreak'] as num).toInt(),
      sessionsThisWeek: (json['sessionsThisWeek'] as num).toInt(),
      correctionsTrend:
          (json['correctionsTrend'] as List<dynamic>?)
              ?.map(
                (e) => CorrectionTrendItem.fromJson(e as Map<String, dynamic>),
              )
              .toList() ??
          const <CorrectionTrendItem>[],
      grace: json['grace'] as String?,
    );

Map<String, dynamic> _$ProgressResultToJson(_ProgressResult instance) =>
    <String, dynamic>{
      'xp': instance.xp,
      'level': instance.level,
      'streak': instance.streak,
      'longestStreak': instance.longestStreak,
      'sessionsThisWeek': instance.sessionsThisWeek,
      'correctionsTrend': instance.correctionsTrend,
      'grace': instance.grace,
    };

_LeaderboardRow _$LeaderboardRowFromJson(Map<String, dynamic> json) =>
    _LeaderboardRow(
      userId: json['userId'] as String,
      displayName: json['displayName'] as String,
      xpWeek: (json['xpWeek'] as num).toInt(),
      sessionsWeek: (json['sessionsWeek'] as num).toInt(),
      streak: (json['streak'] as num).toInt(),
    );

Map<String, dynamic> _$LeaderboardRowToJson(_LeaderboardRow instance) =>
    <String, dynamic>{
      'userId': instance.userId,
      'displayName': instance.displayName,
      'xpWeek': instance.xpWeek,
      'sessionsWeek': instance.sessionsWeek,
      'streak': instance.streak,
    };

_LeaderboardResult _$LeaderboardResultFromJson(Map<String, dynamic> json) =>
    _LeaderboardResult(
      weekStart: json['weekStart'] as String,
      rows: (json['rows'] as List<dynamic>)
          .map((e) => LeaderboardRow.fromJson(e as Map<String, dynamic>))
          .toList(),
      groupStreak: (json['groupStreak'] as num?)?.toInt() ?? 0,
    );

Map<String, dynamic> _$LeaderboardResultToJson(_LeaderboardResult instance) =>
    <String, dynamic>{
      'weekStart': instance.weekStart,
      'rows': instance.rows,
      'groupStreak': instance.groupStreak,
    };

_ChallengeItem _$ChallengeItemFromJson(Map<String, dynamic> json) =>
    _ChallengeItem(
      fromUserId: json['fromUserId'] as String,
      displayName: json['displayName'] as String,
      topic: json['topic'] as String,
      kind: json['kind'] as String,
      sessionId: json['sessionId'] as String,
    );

Map<String, dynamic> _$ChallengeItemToJson(_ChallengeItem instance) =>
    <String, dynamic>{
      'fromUserId': instance.fromUserId,
      'displayName': instance.displayName,
      'topic': instance.topic,
      'kind': instance.kind,
      'sessionId': instance.sessionId,
    };

_WeeklySummaryResult _$WeeklySummaryResultFromJson(Map<String, dynamic> json) =>
    _WeeklySummaryResult(
      text: json['text'] as String,
      weekStart: json['weekStart'] as String,
    );

Map<String, dynamic> _$WeeklySummaryResultToJson(
  _WeeklySummaryResult instance,
) => <String, dynamic>{'text': instance.text, 'weekStart': instance.weekStart};

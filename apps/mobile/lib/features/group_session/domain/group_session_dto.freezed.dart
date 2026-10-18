// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'group_session_dto.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$GroupInitiatorDto {

 String get id; String get name;
/// Create a copy of GroupInitiatorDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupInitiatorDtoCopyWith<GroupInitiatorDto> get copyWith => _$GroupInitiatorDtoCopyWithImpl<GroupInitiatorDto>(this as GroupInitiatorDto, _$identity);

  /// Serializes this GroupInitiatorDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupInitiatorDto;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupInitiatorDto&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.name, _this.name) || other.name == _this.name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupInitiatorDto;
  return Object.hash(runtimeType,_this.id,_this.name);
}

@override
String toString() {
  final _this = this as GroupInitiatorDto;
  return 'GroupInitiatorDto(id: ${_this.id}, name: ${_this.name})';
}


}

/// @nodoc
abstract mixin class $GroupInitiatorDtoCopyWith<$Res>  {
  factory $GroupInitiatorDtoCopyWith(GroupInitiatorDto value, $Res Function(GroupInitiatorDto) _then) = _$GroupInitiatorDtoCopyWithImpl;
@useResult
$Res call({
 String id, String name
});




}
/// @nodoc
class _$GroupInitiatorDtoCopyWithImpl<$Res>
    implements $GroupInitiatorDtoCopyWith<$Res> {
  _$GroupInitiatorDtoCopyWithImpl(this._self, this._then);

  final GroupInitiatorDto _self;
  final $Res Function(GroupInitiatorDto) _then;

/// Create a copy of GroupInitiatorDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,}) {
  return _then(GroupInitiatorDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [GroupInitiatorDto].
extension GroupInitiatorDtoPatterns on GroupInitiatorDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupInitiatorDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupInitiatorDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupInitiatorDto value)  $default,){
final _that = this;
switch (_that) {
case _GroupInitiatorDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupInitiatorDto value)?  $default,){
final _that = this;
switch (_that) {
case _GroupInitiatorDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupInitiatorDto() when $default != null:
return $default(_that.id,_that.name);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name)  $default,) {final _that = this;
switch (_that) {
case _GroupInitiatorDto():
return $default(_that.id,_that.name);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name)?  $default,) {final _that = this;
switch (_that) {
case _GroupInitiatorDto() when $default != null:
return $default(_that.id,_that.name);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupInitiatorDto implements GroupInitiatorDto {
  const _GroupInitiatorDto({required this.id, required this.name});
  factory _GroupInitiatorDto.fromJson(Map<String, dynamic> json) => _$GroupInitiatorDtoFromJson(json);

@override final  String id;
@override final  String name;

/// Create a copy of GroupInitiatorDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupInitiatorDtoCopyWith<_GroupInitiatorDto> get copyWith => __$GroupInitiatorDtoCopyWithImpl<_GroupInitiatorDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupInitiatorDtoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupInitiatorDto&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,name);
}

@override
String toString() {
    return 'GroupInitiatorDto(id: $id, name: $name)';
}


}

/// @nodoc
abstract mixin class _$GroupInitiatorDtoCopyWith<$Res> implements $GroupInitiatorDtoCopyWith<$Res> {
  factory _$GroupInitiatorDtoCopyWith(_GroupInitiatorDto value, $Res Function(_GroupInitiatorDto) _then) = __$GroupInitiatorDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String name
});




}
/// @nodoc
class __$GroupInitiatorDtoCopyWithImpl<$Res>
    implements _$GroupInitiatorDtoCopyWith<$Res> {
  __$GroupInitiatorDtoCopyWithImpl(this._self, this._then);

  final _GroupInitiatorDto _self;
  final $Res Function(_GroupInitiatorDto) _then;

/// Create a copy of GroupInitiatorDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,}) {
  return _then(_GroupInitiatorDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ParticipantDto {

 String get userId; String get name; String? get avatarUrl; bool get active; bool get shareCorrections;
/// Create a copy of ParticipantDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ParticipantDtoCopyWith<ParticipantDto> get copyWith => _$ParticipantDtoCopyWithImpl<ParticipantDto>(this as ParticipantDto, _$identity);

  /// Serializes this ParticipantDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ParticipantDto;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ParticipantDto&&(identical(other.userId, _this.userId) || other.userId == _this.userId)&&(identical(other.name, _this.name) || other.name == _this.name)&&(identical(other.avatarUrl, _this.avatarUrl) || other.avatarUrl == _this.avatarUrl)&&(identical(other.active, _this.active) || other.active == _this.active)&&(identical(other.shareCorrections, _this.shareCorrections) || other.shareCorrections == _this.shareCorrections));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ParticipantDto;
  return Object.hash(runtimeType,_this.userId,_this.name,_this.avatarUrl,_this.active,_this.shareCorrections);
}

@override
String toString() {
  final _this = this as ParticipantDto;
  return 'ParticipantDto(userId: ${_this.userId}, name: ${_this.name}, avatarUrl: ${_this.avatarUrl}, active: ${_this.active}, shareCorrections: ${_this.shareCorrections})';
}


}

/// @nodoc
abstract mixin class $ParticipantDtoCopyWith<$Res>  {
  factory $ParticipantDtoCopyWith(ParticipantDto value, $Res Function(ParticipantDto) _then) = _$ParticipantDtoCopyWithImpl;
@useResult
$Res call({
 String userId, String name, String? avatarUrl, bool active, bool shareCorrections
});




}
/// @nodoc
class _$ParticipantDtoCopyWithImpl<$Res>
    implements $ParticipantDtoCopyWith<$Res> {
  _$ParticipantDtoCopyWithImpl(this._self, this._then);

  final ParticipantDto _self;
  final $Res Function(ParticipantDto) _then;

/// Create a copy of ParticipantDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? userId = null,Object? name = null,Object? avatarUrl = freezed,Object? active = null,Object? shareCorrections = null,}) {
  return _then(ParticipantDto(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,avatarUrl: freezed == avatarUrl ? _self.avatarUrl : avatarUrl // ignore: cast_nullable_to_non_nullable
as String?,active: null == active ? _self.active : active // ignore: cast_nullable_to_non_nullable
as bool,shareCorrections: null == shareCorrections ? _self.shareCorrections : shareCorrections // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [ParticipantDto].
extension ParticipantDtoPatterns on ParticipantDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ParticipantDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ParticipantDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ParticipantDto value)  $default,){
final _that = this;
switch (_that) {
case _ParticipantDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ParticipantDto value)?  $default,){
final _that = this;
switch (_that) {
case _ParticipantDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String userId,  String name,  String? avatarUrl,  bool active,  bool shareCorrections)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ParticipantDto() when $default != null:
return $default(_that.userId,_that.name,_that.avatarUrl,_that.active,_that.shareCorrections);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String userId,  String name,  String? avatarUrl,  bool active,  bool shareCorrections)  $default,) {final _that = this;
switch (_that) {
case _ParticipantDto():
return $default(_that.userId,_that.name,_that.avatarUrl,_that.active,_that.shareCorrections);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String userId,  String name,  String? avatarUrl,  bool active,  bool shareCorrections)?  $default,) {final _that = this;
switch (_that) {
case _ParticipantDto() when $default != null:
return $default(_that.userId,_that.name,_that.avatarUrl,_that.active,_that.shareCorrections);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ParticipantDto implements ParticipantDto {
  const _ParticipantDto({required this.userId, required this.name, this.avatarUrl, required this.active, required this.shareCorrections});
  factory _ParticipantDto.fromJson(Map<String, dynamic> json) => _$ParticipantDtoFromJson(json);

@override final  String userId;
@override final  String name;
@override final  String? avatarUrl;
@override final  bool active;
@override final  bool shareCorrections;

/// Create a copy of ParticipantDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ParticipantDtoCopyWith<_ParticipantDto> get copyWith => __$ParticipantDtoCopyWithImpl<_ParticipantDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ParticipantDtoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ParticipantDto&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.name, name) || other.name == name)&&(identical(other.avatarUrl, avatarUrl) || other.avatarUrl == avatarUrl)&&(identical(other.active, active) || other.active == active)&&(identical(other.shareCorrections, shareCorrections) || other.shareCorrections == shareCorrections));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,userId,name,avatarUrl,active,shareCorrections);
}

@override
String toString() {
    return 'ParticipantDto(userId: $userId, name: $name, avatarUrl: $avatarUrl, active: $active, shareCorrections: $shareCorrections)';
}


}

/// @nodoc
abstract mixin class _$ParticipantDtoCopyWith<$Res> implements $ParticipantDtoCopyWith<$Res> {
  factory _$ParticipantDtoCopyWith(_ParticipantDto value, $Res Function(_ParticipantDto) _then) = __$ParticipantDtoCopyWithImpl;
@override @useResult
$Res call({
 String userId, String name, String? avatarUrl, bool active, bool shareCorrections
});




}
/// @nodoc
class __$ParticipantDtoCopyWithImpl<$Res>
    implements _$ParticipantDtoCopyWith<$Res> {
  __$ParticipantDtoCopyWithImpl(this._self, this._then);

  final _ParticipantDto _self;
  final $Res Function(_ParticipantDto) _then;

/// Create a copy of ParticipantDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? userId = null,Object? name = null,Object? avatarUrl = freezed,Object? active = null,Object? shareCorrections = null,}) {
  return _then(_ParticipantDto(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,avatarUrl: freezed == avatarUrl ? _self.avatarUrl : avatarUrl // ignore: cast_nullable_to_non_nullable
as String?,active: null == active ? _self.active : active // ignore: cast_nullable_to_non_nullable
as bool,shareCorrections: null == shareCorrections ? _self.shareCorrections : shareCorrections // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$GroupSessionDto {

 String get id; String get kind;/// Nullable: `group_sessions.topic` no tiene `not null` (una sala de
/// roleplay o noticia puede no llevar tema libre).
 String? get topic; GroupInitiatorDto get initiator; String get status; String get startedAt; String get endsAt; List<ParticipantDto> get participants;
/// Create a copy of GroupSessionDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupSessionDtoCopyWith<GroupSessionDto> get copyWith => _$GroupSessionDtoCopyWithImpl<GroupSessionDto>(this as GroupSessionDto, _$identity);

  /// Serializes this GroupSessionDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupSessionDto;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupSessionDto&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.kind, _this.kind) || other.kind == _this.kind)&&(identical(other.topic, _this.topic) || other.topic == _this.topic)&&(identical(other.initiator, _this.initiator) || other.initiator == _this.initiator)&&(identical(other.status, _this.status) || other.status == _this.status)&&(identical(other.startedAt, _this.startedAt) || other.startedAt == _this.startedAt)&&(identical(other.endsAt, _this.endsAt) || other.endsAt == _this.endsAt)&&const DeepCollectionEquality().equals(other.participants, _this.participants));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupSessionDto;
  return Object.hash(runtimeType,_this.id,_this.kind,_this.topic,_this.initiator,_this.status,_this.startedAt,_this.endsAt,const DeepCollectionEquality().hash(_this.participants));
}

@override
String toString() {
  final _this = this as GroupSessionDto;
  return 'GroupSessionDto(id: ${_this.id}, kind: ${_this.kind}, topic: ${_this.topic}, initiator: ${_this.initiator}, status: ${_this.status}, startedAt: ${_this.startedAt}, endsAt: ${_this.endsAt}, participants: ${_this.participants})';
}


}

/// @nodoc
abstract mixin class $GroupSessionDtoCopyWith<$Res>  {
  factory $GroupSessionDtoCopyWith(GroupSessionDto value, $Res Function(GroupSessionDto) _then) = _$GroupSessionDtoCopyWithImpl;
@useResult
$Res call({
 String id, String kind, String? topic, GroupInitiatorDto initiator, String status, String startedAt, String endsAt, List<ParticipantDto> participants
});


$GroupInitiatorDtoCopyWith<$Res> get initiator;

}
/// @nodoc
class _$GroupSessionDtoCopyWithImpl<$Res>
    implements $GroupSessionDtoCopyWith<$Res> {
  _$GroupSessionDtoCopyWithImpl(this._self, this._then);

  final GroupSessionDto _self;
  final $Res Function(GroupSessionDto) _then;

/// Create a copy of GroupSessionDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? kind = null,Object? topic = freezed,Object? initiator = null,Object? status = null,Object? startedAt = null,Object? endsAt = null,Object? participants = null,}) {
  return _then(GroupSessionDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,topic: freezed == topic ? _self.topic : topic // ignore: cast_nullable_to_non_nullable
as String?,initiator: null == initiator ? _self.initiator : initiator // ignore: cast_nullable_to_non_nullable
as GroupInitiatorDto,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,startedAt: null == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as String,endsAt: null == endsAt ? _self.endsAt : endsAt // ignore: cast_nullable_to_non_nullable
as String,participants: null == participants ? _self.participants : participants // ignore: cast_nullable_to_non_nullable
as List<ParticipantDto>,
  ));
}
/// Create a copy of GroupSessionDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupInitiatorDtoCopyWith<$Res> get initiator {
  
  return $GroupInitiatorDtoCopyWith<$Res>(_self.initiator, (value) {
    return _then(_self.copyWith(initiator: value));
  });
}
}


/// Adds pattern-matching-related methods to [GroupSessionDto].
extension GroupSessionDtoPatterns on GroupSessionDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupSessionDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupSessionDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupSessionDto value)  $default,){
final _that = this;
switch (_that) {
case _GroupSessionDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupSessionDto value)?  $default,){
final _that = this;
switch (_that) {
case _GroupSessionDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String kind,  String? topic,  GroupInitiatorDto initiator,  String status,  String startedAt,  String endsAt,  List<ParticipantDto> participants)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupSessionDto() when $default != null:
return $default(_that.id,_that.kind,_that.topic,_that.initiator,_that.status,_that.startedAt,_that.endsAt,_that.participants);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String kind,  String? topic,  GroupInitiatorDto initiator,  String status,  String startedAt,  String endsAt,  List<ParticipantDto> participants)  $default,) {final _that = this;
switch (_that) {
case _GroupSessionDto():
return $default(_that.id,_that.kind,_that.topic,_that.initiator,_that.status,_that.startedAt,_that.endsAt,_that.participants);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String kind,  String? topic,  GroupInitiatorDto initiator,  String status,  String startedAt,  String endsAt,  List<ParticipantDto> participants)?  $default,) {final _that = this;
switch (_that) {
case _GroupSessionDto() when $default != null:
return $default(_that.id,_that.kind,_that.topic,_that.initiator,_that.status,_that.startedAt,_that.endsAt,_that.participants);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupSessionDto implements GroupSessionDto {
  const _GroupSessionDto({required this.id, required this.kind, this.topic, required this.initiator, required this.status, required this.startedAt, required this.endsAt, required  List<ParticipantDto> participants}): _participants = participants;
  factory _GroupSessionDto.fromJson(Map<String, dynamic> json) => _$GroupSessionDtoFromJson(json);

@override final  String id;
@override final  String kind;
/// Nullable: `group_sessions.topic` no tiene `not null` (una sala de
/// roleplay o noticia puede no llevar tema libre).
@override final  String? topic;
@override final  GroupInitiatorDto initiator;
@override final  String status;
@override final  String startedAt;
@override final  String endsAt;
 final  List<ParticipantDto> _participants;
@override List<ParticipantDto> get participants {
  if (_participants is EqualUnmodifiableListView) return _participants;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_participants);
}


/// Create a copy of GroupSessionDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupSessionDtoCopyWith<_GroupSessionDto> get copyWith => __$GroupSessionDtoCopyWithImpl<_GroupSessionDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupSessionDtoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupSessionDto&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.topic, topic) || other.topic == topic)&&(identical(other.initiator, initiator) || other.initiator == initiator)&&(identical(other.status, status) || other.status == status)&&(identical(other.startedAt, startedAt) || other.startedAt == startedAt)&&(identical(other.endsAt, endsAt) || other.endsAt == endsAt)&&const DeepCollectionEquality().equals(other.participants, _participants));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,kind,topic,initiator,status,startedAt,endsAt,const DeepCollectionEquality().hash(_participants));
}

@override
String toString() {
    return 'GroupSessionDto(id: $id, kind: $kind, topic: $topic, initiator: $initiator, status: $status, startedAt: $startedAt, endsAt: $endsAt, participants: $participants)';
}


}

/// @nodoc
abstract mixin class _$GroupSessionDtoCopyWith<$Res> implements $GroupSessionDtoCopyWith<$Res> {
  factory _$GroupSessionDtoCopyWith(_GroupSessionDto value, $Res Function(_GroupSessionDto) _then) = __$GroupSessionDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String kind, String? topic, GroupInitiatorDto initiator, String status, String startedAt, String endsAt, List<ParticipantDto> participants
});


@override $GroupInitiatorDtoCopyWith<$Res> get initiator;

}
/// @nodoc
class __$GroupSessionDtoCopyWithImpl<$Res>
    implements _$GroupSessionDtoCopyWith<$Res> {
  __$GroupSessionDtoCopyWithImpl(this._self, this._then);

  final _GroupSessionDto _self;
  final $Res Function(_GroupSessionDto) _then;

/// Create a copy of GroupSessionDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? kind = null,Object? topic = freezed,Object? initiator = null,Object? status = null,Object? startedAt = null,Object? endsAt = null,Object? participants = null,}) {
  return _then(_GroupSessionDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,topic: freezed == topic ? _self.topic : topic // ignore: cast_nullable_to_non_nullable
as String?,initiator: null == initiator ? _self.initiator : initiator // ignore: cast_nullable_to_non_nullable
as GroupInitiatorDto,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,startedAt: null == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as String,endsAt: null == endsAt ? _self.endsAt : endsAt // ignore: cast_nullable_to_non_nullable
as String,participants: null == participants ? _self._participants : participants // ignore: cast_nullable_to_non_nullable
as List<ParticipantDto>,
  ));
}

/// Create a copy of GroupSessionDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupInitiatorDtoCopyWith<$Res> get initiator {
  
  return $GroupInitiatorDtoCopyWith<$Res>(_self.initiator, (value) {
    return _then(_self.copyWith(initiator: value));
  });
}
}


/// @nodoc
mixin _$GroupMessageDto {

 int get id; String get role; String? get authorId; String get text; String? get systemEvent; bool get hasAudio; int? get audioMs; String get createdAt;/// Presente solo en mensajes propios enviados por esta app: permite
/// sustituir el mensaje optimista por el confirmado sin duplicarlo
/// (F6.5.T1, dedup del controller).
 String? get clientId;
/// Create a copy of GroupMessageDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupMessageDtoCopyWith<GroupMessageDto> get copyWith => _$GroupMessageDtoCopyWithImpl<GroupMessageDto>(this as GroupMessageDto, _$identity);

  /// Serializes this GroupMessageDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupMessageDto;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupMessageDto&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.role, _this.role) || other.role == _this.role)&&(identical(other.authorId, _this.authorId) || other.authorId == _this.authorId)&&(identical(other.text, _this.text) || other.text == _this.text)&&(identical(other.systemEvent, _this.systemEvent) || other.systemEvent == _this.systemEvent)&&(identical(other.hasAudio, _this.hasAudio) || other.hasAudio == _this.hasAudio)&&(identical(other.audioMs, _this.audioMs) || other.audioMs == _this.audioMs)&&(identical(other.createdAt, _this.createdAt) || other.createdAt == _this.createdAt)&&(identical(other.clientId, _this.clientId) || other.clientId == _this.clientId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupMessageDto;
  return Object.hash(runtimeType,_this.id,_this.role,_this.authorId,_this.text,_this.systemEvent,_this.hasAudio,_this.audioMs,_this.createdAt,_this.clientId);
}

@override
String toString() {
  final _this = this as GroupMessageDto;
  return 'GroupMessageDto(id: ${_this.id}, role: ${_this.role}, authorId: ${_this.authorId}, text: ${_this.text}, systemEvent: ${_this.systemEvent}, hasAudio: ${_this.hasAudio}, audioMs: ${_this.audioMs}, createdAt: ${_this.createdAt}, clientId: ${_this.clientId})';
}


}

/// @nodoc
abstract mixin class $GroupMessageDtoCopyWith<$Res>  {
  factory $GroupMessageDtoCopyWith(GroupMessageDto value, $Res Function(GroupMessageDto) _then) = _$GroupMessageDtoCopyWithImpl;
@useResult
$Res call({
 int id, String role, String? authorId, String text, String? systemEvent, bool hasAudio, int? audioMs, String createdAt, String? clientId
});




}
/// @nodoc
class _$GroupMessageDtoCopyWithImpl<$Res>
    implements $GroupMessageDtoCopyWith<$Res> {
  _$GroupMessageDtoCopyWithImpl(this._self, this._then);

  final GroupMessageDto _self;
  final $Res Function(GroupMessageDto) _then;

/// Create a copy of GroupMessageDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? role = null,Object? authorId = freezed,Object? text = null,Object? systemEvent = freezed,Object? hasAudio = null,Object? audioMs = freezed,Object? createdAt = null,Object? clientId = freezed,}) {
  return _then(GroupMessageDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,authorId: freezed == authorId ? _self.authorId : authorId // ignore: cast_nullable_to_non_nullable
as String?,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,systemEvent: freezed == systemEvent ? _self.systemEvent : systemEvent // ignore: cast_nullable_to_non_nullable
as String?,hasAudio: null == hasAudio ? _self.hasAudio : hasAudio // ignore: cast_nullable_to_non_nullable
as bool,audioMs: freezed == audioMs ? _self.audioMs : audioMs // ignore: cast_nullable_to_non_nullable
as int?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,clientId: freezed == clientId ? _self.clientId : clientId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [GroupMessageDto].
extension GroupMessageDtoPatterns on GroupMessageDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupMessageDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupMessageDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupMessageDto value)  $default,){
final _that = this;
switch (_that) {
case _GroupMessageDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupMessageDto value)?  $default,){
final _that = this;
switch (_that) {
case _GroupMessageDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int id,  String role,  String? authorId,  String text,  String? systemEvent,  bool hasAudio,  int? audioMs,  String createdAt,  String? clientId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupMessageDto() when $default != null:
return $default(_that.id,_that.role,_that.authorId,_that.text,_that.systemEvent,_that.hasAudio,_that.audioMs,_that.createdAt,_that.clientId);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int id,  String role,  String? authorId,  String text,  String? systemEvent,  bool hasAudio,  int? audioMs,  String createdAt,  String? clientId)  $default,) {final _that = this;
switch (_that) {
case _GroupMessageDto():
return $default(_that.id,_that.role,_that.authorId,_that.text,_that.systemEvent,_that.hasAudio,_that.audioMs,_that.createdAt,_that.clientId);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int id,  String role,  String? authorId,  String text,  String? systemEvent,  bool hasAudio,  int? audioMs,  String createdAt,  String? clientId)?  $default,) {final _that = this;
switch (_that) {
case _GroupMessageDto() when $default != null:
return $default(_that.id,_that.role,_that.authorId,_that.text,_that.systemEvent,_that.hasAudio,_that.audioMs,_that.createdAt,_that.clientId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupMessageDto implements GroupMessageDto {
  const _GroupMessageDto({required this.id, required this.role, this.authorId, required this.text, this.systemEvent, required this.hasAudio, this.audioMs, required this.createdAt, this.clientId});
  factory _GroupMessageDto.fromJson(Map<String, dynamic> json) => _$GroupMessageDtoFromJson(json);

@override final  int id;
@override final  String role;
@override final  String? authorId;
@override final  String text;
@override final  String? systemEvent;
@override final  bool hasAudio;
@override final  int? audioMs;
@override final  String createdAt;
/// Presente solo en mensajes propios enviados por esta app: permite
/// sustituir el mensaje optimista por el confirmado sin duplicarlo
/// (F6.5.T1, dedup del controller).
@override final  String? clientId;

/// Create a copy of GroupMessageDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupMessageDtoCopyWith<_GroupMessageDto> get copyWith => __$GroupMessageDtoCopyWithImpl<_GroupMessageDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupMessageDtoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupMessageDto&&(identical(other.id, id) || other.id == id)&&(identical(other.role, role) || other.role == role)&&(identical(other.authorId, authorId) || other.authorId == authorId)&&(identical(other.text, text) || other.text == text)&&(identical(other.systemEvent, systemEvent) || other.systemEvent == systemEvent)&&(identical(other.hasAudio, hasAudio) || other.hasAudio == hasAudio)&&(identical(other.audioMs, audioMs) || other.audioMs == audioMs)&&(identical(other.createdAt, createdAt) || other.createdAt == createdAt)&&(identical(other.clientId, clientId) || other.clientId == clientId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,role,authorId,text,systemEvent,hasAudio,audioMs,createdAt,clientId);
}

@override
String toString() {
    return 'GroupMessageDto(id: $id, role: $role, authorId: $authorId, text: $text, systemEvent: $systemEvent, hasAudio: $hasAudio, audioMs: $audioMs, createdAt: $createdAt, clientId: $clientId)';
}


}

/// @nodoc
abstract mixin class _$GroupMessageDtoCopyWith<$Res> implements $GroupMessageDtoCopyWith<$Res> {
  factory _$GroupMessageDtoCopyWith(_GroupMessageDto value, $Res Function(_GroupMessageDto) _then) = __$GroupMessageDtoCopyWithImpl;
@override @useResult
$Res call({
 int id, String role, String? authorId, String text, String? systemEvent, bool hasAudio, int? audioMs, String createdAt, String? clientId
});




}
/// @nodoc
class __$GroupMessageDtoCopyWithImpl<$Res>
    implements _$GroupMessageDtoCopyWith<$Res> {
  __$GroupMessageDtoCopyWithImpl(this._self, this._then);

  final _GroupMessageDto _self;
  final $Res Function(_GroupMessageDto) _then;

/// Create a copy of GroupMessageDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? role = null,Object? authorId = freezed,Object? text = null,Object? systemEvent = freezed,Object? hasAudio = null,Object? audioMs = freezed,Object? createdAt = null,Object? clientId = freezed,}) {
  return _then(_GroupMessageDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as int,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,authorId: freezed == authorId ? _self.authorId : authorId // ignore: cast_nullable_to_non_nullable
as String?,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,systemEvent: freezed == systemEvent ? _self.systemEvent : systemEvent // ignore: cast_nullable_to_non_nullable
as String?,hasAudio: null == hasAudio ? _self.hasAudio : hasAudio // ignore: cast_nullable_to_non_nullable
as bool,audioMs: freezed == audioMs ? _self.audioMs : audioMs // ignore: cast_nullable_to_non_nullable
as int?,createdAt: null == createdAt ? _self.createdAt : createdAt // ignore: cast_nullable_to_non_nullable
as String,clientId: freezed == clientId ? _self.clientId : clientId // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$GroupCorrectionDto {

 int get messageId; String get authorId; String get original; String get corrected; String get category; String get note;
/// Create a copy of GroupCorrectionDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupCorrectionDtoCopyWith<GroupCorrectionDto> get copyWith => _$GroupCorrectionDtoCopyWithImpl<GroupCorrectionDto>(this as GroupCorrectionDto, _$identity);

  /// Serializes this GroupCorrectionDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupCorrectionDto;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupCorrectionDto&&(identical(other.messageId, _this.messageId) || other.messageId == _this.messageId)&&(identical(other.authorId, _this.authorId) || other.authorId == _this.authorId)&&(identical(other.original, _this.original) || other.original == _this.original)&&(identical(other.corrected, _this.corrected) || other.corrected == _this.corrected)&&(identical(other.category, _this.category) || other.category == _this.category)&&(identical(other.note, _this.note) || other.note == _this.note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupCorrectionDto;
  return Object.hash(runtimeType,_this.messageId,_this.authorId,_this.original,_this.corrected,_this.category,_this.note);
}

@override
String toString() {
  final _this = this as GroupCorrectionDto;
  return 'GroupCorrectionDto(messageId: ${_this.messageId}, authorId: ${_this.authorId}, original: ${_this.original}, corrected: ${_this.corrected}, category: ${_this.category}, note: ${_this.note})';
}


}

/// @nodoc
abstract mixin class $GroupCorrectionDtoCopyWith<$Res>  {
  factory $GroupCorrectionDtoCopyWith(GroupCorrectionDto value, $Res Function(GroupCorrectionDto) _then) = _$GroupCorrectionDtoCopyWithImpl;
@useResult
$Res call({
 int messageId, String authorId, String original, String corrected, String category, String note
});




}
/// @nodoc
class _$GroupCorrectionDtoCopyWithImpl<$Res>
    implements $GroupCorrectionDtoCopyWith<$Res> {
  _$GroupCorrectionDtoCopyWithImpl(this._self, this._then);

  final GroupCorrectionDto _self;
  final $Res Function(GroupCorrectionDto) _then;

/// Create a copy of GroupCorrectionDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? messageId = null,Object? authorId = null,Object? original = null,Object? corrected = null,Object? category = null,Object? note = null,}) {
  return _then(GroupCorrectionDto(
messageId: null == messageId ? _self.messageId : messageId // ignore: cast_nullable_to_non_nullable
as int,authorId: null == authorId ? _self.authorId : authorId // ignore: cast_nullable_to_non_nullable
as String,original: null == original ? _self.original : original // ignore: cast_nullable_to_non_nullable
as String,corrected: null == corrected ? _self.corrected : corrected // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,note: null == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [GroupCorrectionDto].
extension GroupCorrectionDtoPatterns on GroupCorrectionDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupCorrectionDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupCorrectionDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupCorrectionDto value)  $default,){
final _that = this;
switch (_that) {
case _GroupCorrectionDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupCorrectionDto value)?  $default,){
final _that = this;
switch (_that) {
case _GroupCorrectionDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int messageId,  String authorId,  String original,  String corrected,  String category,  String note)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupCorrectionDto() when $default != null:
return $default(_that.messageId,_that.authorId,_that.original,_that.corrected,_that.category,_that.note);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int messageId,  String authorId,  String original,  String corrected,  String category,  String note)  $default,) {final _that = this;
switch (_that) {
case _GroupCorrectionDto():
return $default(_that.messageId,_that.authorId,_that.original,_that.corrected,_that.category,_that.note);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int messageId,  String authorId,  String original,  String corrected,  String category,  String note)?  $default,) {final _that = this;
switch (_that) {
case _GroupCorrectionDto() when $default != null:
return $default(_that.messageId,_that.authorId,_that.original,_that.corrected,_that.category,_that.note);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupCorrectionDto implements GroupCorrectionDto {
  const _GroupCorrectionDto({required this.messageId, required this.authorId, required this.original, required this.corrected, required this.category, required this.note});
  factory _GroupCorrectionDto.fromJson(Map<String, dynamic> json) => _$GroupCorrectionDtoFromJson(json);

@override final  int messageId;
@override final  String authorId;
@override final  String original;
@override final  String corrected;
@override final  String category;
@override final  String note;

/// Create a copy of GroupCorrectionDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupCorrectionDtoCopyWith<_GroupCorrectionDto> get copyWith => __$GroupCorrectionDtoCopyWithImpl<_GroupCorrectionDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupCorrectionDtoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupCorrectionDto&&(identical(other.messageId, messageId) || other.messageId == messageId)&&(identical(other.authorId, authorId) || other.authorId == authorId)&&(identical(other.original, original) || other.original == original)&&(identical(other.corrected, corrected) || other.corrected == corrected)&&(identical(other.category, category) || other.category == category)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,messageId,authorId,original,corrected,category,note);
}

@override
String toString() {
    return 'GroupCorrectionDto(messageId: $messageId, authorId: $authorId, original: $original, corrected: $corrected, category: $category, note: $note)';
}


}

/// @nodoc
abstract mixin class _$GroupCorrectionDtoCopyWith<$Res> implements $GroupCorrectionDtoCopyWith<$Res> {
  factory _$GroupCorrectionDtoCopyWith(_GroupCorrectionDto value, $Res Function(_GroupCorrectionDto) _then) = __$GroupCorrectionDtoCopyWithImpl;
@override @useResult
$Res call({
 int messageId, String authorId, String original, String corrected, String category, String note
});




}
/// @nodoc
class __$GroupCorrectionDtoCopyWithImpl<$Res>
    implements _$GroupCorrectionDtoCopyWith<$Res> {
  __$GroupCorrectionDtoCopyWithImpl(this._self, this._then);

  final _GroupCorrectionDto _self;
  final $Res Function(_GroupCorrectionDto) _then;

/// Create a copy of GroupCorrectionDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? messageId = null,Object? authorId = null,Object? original = null,Object? corrected = null,Object? category = null,Object? note = null,}) {
  return _then(_GroupCorrectionDto(
messageId: null == messageId ? _self.messageId : messageId // ignore: cast_nullable_to_non_nullable
as int,authorId: null == authorId ? _self.authorId : authorId // ignore: cast_nullable_to_non_nullable
as String,original: null == original ? _self.original : original // ignore: cast_nullable_to_non_nullable
as String,corrected: null == corrected ? _self.corrected : corrected // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,note: null == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$GroupXpEntryDto {

 String get userId; int get xp;
/// Create a copy of GroupXpEntryDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupXpEntryDtoCopyWith<GroupXpEntryDto> get copyWith => _$GroupXpEntryDtoCopyWithImpl<GroupXpEntryDto>(this as GroupXpEntryDto, _$identity);

  /// Serializes this GroupXpEntryDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupXpEntryDto;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupXpEntryDto&&(identical(other.userId, _this.userId) || other.userId == _this.userId)&&(identical(other.xp, _this.xp) || other.xp == _this.xp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupXpEntryDto;
  return Object.hash(runtimeType,_this.userId,_this.xp);
}

@override
String toString() {
  final _this = this as GroupXpEntryDto;
  return 'GroupXpEntryDto(userId: ${_this.userId}, xp: ${_this.xp})';
}


}

/// @nodoc
abstract mixin class $GroupXpEntryDtoCopyWith<$Res>  {
  factory $GroupXpEntryDtoCopyWith(GroupXpEntryDto value, $Res Function(GroupXpEntryDto) _then) = _$GroupXpEntryDtoCopyWithImpl;
@useResult
$Res call({
 String userId, int xp
});




}
/// @nodoc
class _$GroupXpEntryDtoCopyWithImpl<$Res>
    implements $GroupXpEntryDtoCopyWith<$Res> {
  _$GroupXpEntryDtoCopyWithImpl(this._self, this._then);

  final GroupXpEntryDto _self;
  final $Res Function(GroupXpEntryDto) _then;

/// Create a copy of GroupXpEntryDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? userId = null,Object? xp = null,}) {
  return _then(GroupXpEntryDto(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,xp: null == xp ? _self.xp : xp // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [GroupXpEntryDto].
extension GroupXpEntryDtoPatterns on GroupXpEntryDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupXpEntryDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupXpEntryDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupXpEntryDto value)  $default,){
final _that = this;
switch (_that) {
case _GroupXpEntryDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupXpEntryDto value)?  $default,){
final _that = this;
switch (_that) {
case _GroupXpEntryDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String userId,  int xp)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupXpEntryDto() when $default != null:
return $default(_that.userId,_that.xp);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String userId,  int xp)  $default,) {final _that = this;
switch (_that) {
case _GroupXpEntryDto():
return $default(_that.userId,_that.xp);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String userId,  int xp)?  $default,) {final _that = this;
switch (_that) {
case _GroupXpEntryDto() when $default != null:
return $default(_that.userId,_that.xp);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupXpEntryDto implements GroupXpEntryDto {
  const _GroupXpEntryDto({required this.userId, required this.xp});
  factory _GroupXpEntryDto.fromJson(Map<String, dynamic> json) => _$GroupXpEntryDtoFromJson(json);

@override final  String userId;
@override final  int xp;

/// Create a copy of GroupXpEntryDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupXpEntryDtoCopyWith<_GroupXpEntryDto> get copyWith => __$GroupXpEntryDtoCopyWithImpl<_GroupXpEntryDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupXpEntryDtoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupXpEntryDto&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.xp, xp) || other.xp == xp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,userId,xp);
}

@override
String toString() {
    return 'GroupXpEntryDto(userId: $userId, xp: $xp)';
}


}

/// @nodoc
abstract mixin class _$GroupXpEntryDtoCopyWith<$Res> implements $GroupXpEntryDtoCopyWith<$Res> {
  factory _$GroupXpEntryDtoCopyWith(_GroupXpEntryDto value, $Res Function(_GroupXpEntryDto) _then) = __$GroupXpEntryDtoCopyWithImpl;
@override @useResult
$Res call({
 String userId, int xp
});




}
/// @nodoc
class __$GroupXpEntryDtoCopyWithImpl<$Res>
    implements _$GroupXpEntryDtoCopyWith<$Res> {
  __$GroupXpEntryDtoCopyWithImpl(this._self, this._then);

  final _GroupXpEntryDto _self;
  final $Res Function(_GroupXpEntryDto) _then;

/// Create a copy of GroupXpEntryDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? userId = null,Object? xp = null,}) {
  return _then(_GroupXpEntryDto(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,xp: null == xp ? _self.xp : xp // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$GroupRecapHighlightDto {

 String get userId; String get quote;
/// Create a copy of GroupRecapHighlightDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupRecapHighlightDtoCopyWith<GroupRecapHighlightDto> get copyWith => _$GroupRecapHighlightDtoCopyWithImpl<GroupRecapHighlightDto>(this as GroupRecapHighlightDto, _$identity);

  /// Serializes this GroupRecapHighlightDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupRecapHighlightDto;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupRecapHighlightDto&&(identical(other.userId, _this.userId) || other.userId == _this.userId)&&(identical(other.quote, _this.quote) || other.quote == _this.quote));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupRecapHighlightDto;
  return Object.hash(runtimeType,_this.userId,_this.quote);
}

@override
String toString() {
  final _this = this as GroupRecapHighlightDto;
  return 'GroupRecapHighlightDto(userId: ${_this.userId}, quote: ${_this.quote})';
}


}

/// @nodoc
abstract mixin class $GroupRecapHighlightDtoCopyWith<$Res>  {
  factory $GroupRecapHighlightDtoCopyWith(GroupRecapHighlightDto value, $Res Function(GroupRecapHighlightDto) _then) = _$GroupRecapHighlightDtoCopyWithImpl;
@useResult
$Res call({
 String userId, String quote
});




}
/// @nodoc
class _$GroupRecapHighlightDtoCopyWithImpl<$Res>
    implements $GroupRecapHighlightDtoCopyWith<$Res> {
  _$GroupRecapHighlightDtoCopyWithImpl(this._self, this._then);

  final GroupRecapHighlightDto _self;
  final $Res Function(GroupRecapHighlightDto) _then;

/// Create a copy of GroupRecapHighlightDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? userId = null,Object? quote = null,}) {
  return _then(GroupRecapHighlightDto(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,quote: null == quote ? _self.quote : quote // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [GroupRecapHighlightDto].
extension GroupRecapHighlightDtoPatterns on GroupRecapHighlightDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupRecapHighlightDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupRecapHighlightDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupRecapHighlightDto value)  $default,){
final _that = this;
switch (_that) {
case _GroupRecapHighlightDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupRecapHighlightDto value)?  $default,){
final _that = this;
switch (_that) {
case _GroupRecapHighlightDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String userId,  String quote)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupRecapHighlightDto() when $default != null:
return $default(_that.userId,_that.quote);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String userId,  String quote)  $default,) {final _that = this;
switch (_that) {
case _GroupRecapHighlightDto():
return $default(_that.userId,_that.quote);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String userId,  String quote)?  $default,) {final _that = this;
switch (_that) {
case _GroupRecapHighlightDto() when $default != null:
return $default(_that.userId,_that.quote);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupRecapHighlightDto implements GroupRecapHighlightDto {
  const _GroupRecapHighlightDto({required this.userId, required this.quote});
  factory _GroupRecapHighlightDto.fromJson(Map<String, dynamic> json) => _$GroupRecapHighlightDtoFromJson(json);

@override final  String userId;
@override final  String quote;

/// Create a copy of GroupRecapHighlightDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupRecapHighlightDtoCopyWith<_GroupRecapHighlightDto> get copyWith => __$GroupRecapHighlightDtoCopyWithImpl<_GroupRecapHighlightDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupRecapHighlightDtoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupRecapHighlightDto&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.quote, quote) || other.quote == quote));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,userId,quote);
}

@override
String toString() {
    return 'GroupRecapHighlightDto(userId: $userId, quote: $quote)';
}


}

/// @nodoc
abstract mixin class _$GroupRecapHighlightDtoCopyWith<$Res> implements $GroupRecapHighlightDtoCopyWith<$Res> {
  factory _$GroupRecapHighlightDtoCopyWith(_GroupRecapHighlightDto value, $Res Function(_GroupRecapHighlightDto) _then) = __$GroupRecapHighlightDtoCopyWithImpl;
@override @useResult
$Res call({
 String userId, String quote
});




}
/// @nodoc
class __$GroupRecapHighlightDtoCopyWithImpl<$Res>
    implements _$GroupRecapHighlightDtoCopyWith<$Res> {
  __$GroupRecapHighlightDtoCopyWithImpl(this._self, this._then);

  final _GroupRecapHighlightDto _self;
  final $Res Function(_GroupRecapHighlightDto) _then;

/// Create a copy of GroupRecapHighlightDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? userId = null,Object? quote = null,}) {
  return _then(_GroupRecapHighlightDto(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,quote: null == quote ? _self.quote : quote // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$GroupRecapDto {

 List<String> get topics; List<GroupRecapHighlightDto> get highlights;
/// Create a copy of GroupRecapDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupRecapDtoCopyWith<GroupRecapDto> get copyWith => _$GroupRecapDtoCopyWithImpl<GroupRecapDto>(this as GroupRecapDto, _$identity);

  /// Serializes this GroupRecapDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupRecapDto;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupRecapDto&&const DeepCollectionEquality().equals(other.topics, _this.topics)&&const DeepCollectionEquality().equals(other.highlights, _this.highlights));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupRecapDto;
  return Object.hash(runtimeType,const DeepCollectionEquality().hash(_this.topics),const DeepCollectionEquality().hash(_this.highlights));
}

@override
String toString() {
  final _this = this as GroupRecapDto;
  return 'GroupRecapDto(topics: ${_this.topics}, highlights: ${_this.highlights})';
}


}

/// @nodoc
abstract mixin class $GroupRecapDtoCopyWith<$Res>  {
  factory $GroupRecapDtoCopyWith(GroupRecapDto value, $Res Function(GroupRecapDto) _then) = _$GroupRecapDtoCopyWithImpl;
@useResult
$Res call({
 List<String> topics, List<GroupRecapHighlightDto> highlights
});




}
/// @nodoc
class _$GroupRecapDtoCopyWithImpl<$Res>
    implements $GroupRecapDtoCopyWith<$Res> {
  _$GroupRecapDtoCopyWithImpl(this._self, this._then);

  final GroupRecapDto _self;
  final $Res Function(GroupRecapDto) _then;

/// Create a copy of GroupRecapDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? topics = null,Object? highlights = null,}) {
  return _then(GroupRecapDto(
topics: null == topics ? _self.topics : topics // ignore: cast_nullable_to_non_nullable
as List<String>,highlights: null == highlights ? _self.highlights : highlights // ignore: cast_nullable_to_non_nullable
as List<GroupRecapHighlightDto>,
  ));
}

}


/// Adds pattern-matching-related methods to [GroupRecapDto].
extension GroupRecapDtoPatterns on GroupRecapDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupRecapDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupRecapDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupRecapDto value)  $default,){
final _that = this;
switch (_that) {
case _GroupRecapDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupRecapDto value)?  $default,){
final _that = this;
switch (_that) {
case _GroupRecapDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<String> topics,  List<GroupRecapHighlightDto> highlights)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupRecapDto() when $default != null:
return $default(_that.topics,_that.highlights);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<String> topics,  List<GroupRecapHighlightDto> highlights)  $default,) {final _that = this;
switch (_that) {
case _GroupRecapDto():
return $default(_that.topics,_that.highlights);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<String> topics,  List<GroupRecapHighlightDto> highlights)?  $default,) {final _that = this;
switch (_that) {
case _GroupRecapDto() when $default != null:
return $default(_that.topics,_that.highlights);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupRecapDto implements GroupRecapDto {
  const _GroupRecapDto({required  List<String> topics, required  List<GroupRecapHighlightDto> highlights}): _topics = topics,_highlights = highlights;
  factory _GroupRecapDto.fromJson(Map<String, dynamic> json) => _$GroupRecapDtoFromJson(json);

 final  List<String> _topics;
@override List<String> get topics {
  if (_topics is EqualUnmodifiableListView) return _topics;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_topics);
}

 final  List<GroupRecapHighlightDto> _highlights;
@override List<GroupRecapHighlightDto> get highlights {
  if (_highlights is EqualUnmodifiableListView) return _highlights;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_highlights);
}


/// Create a copy of GroupRecapDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupRecapDtoCopyWith<_GroupRecapDto> get copyWith => __$GroupRecapDtoCopyWithImpl<_GroupRecapDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupRecapDtoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupRecapDto&&const DeepCollectionEquality().equals(other.topics, _topics)&&const DeepCollectionEquality().equals(other.highlights, _highlights));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,const DeepCollectionEquality().hash(_topics),const DeepCollectionEquality().hash(_highlights));
}

@override
String toString() {
    return 'GroupRecapDto(topics: $topics, highlights: $highlights)';
}


}

/// @nodoc
abstract mixin class _$GroupRecapDtoCopyWith<$Res> implements $GroupRecapDtoCopyWith<$Res> {
  factory _$GroupRecapDtoCopyWith(_GroupRecapDto value, $Res Function(_GroupRecapDto) _then) = __$GroupRecapDtoCopyWithImpl;
@override @useResult
$Res call({
 List<String> topics, List<GroupRecapHighlightDto> highlights
});




}
/// @nodoc
class __$GroupRecapDtoCopyWithImpl<$Res>
    implements _$GroupRecapDtoCopyWith<$Res> {
  __$GroupRecapDtoCopyWithImpl(this._self, this._then);

  final _GroupRecapDto _self;
  final $Res Function(_GroupRecapDto) _then;

/// Create a copy of GroupRecapDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? topics = null,Object? highlights = null,}) {
  return _then(_GroupRecapDto(
topics: null == topics ? _self._topics : topics // ignore: cast_nullable_to_non_nullable
as List<String>,highlights: null == highlights ? _self._highlights : highlights // ignore: cast_nullable_to_non_nullable
as List<GroupRecapHighlightDto>,
  ));
}


}


/// @nodoc
mixin _$GroupSessionDetailDto {

 String get id; String get kind; String? get topic; GroupInitiatorDto get initiator; String get status; String get startedAt; String get endsAt; List<ParticipantDto> get participants; List<GroupMessageDto> get messages;/// Solo las correcciones visibles para quien pidió el detalle (propias,
/// más las de quienes comparten).
 List<GroupCorrectionDto> get corrections; GroupRecapDto? get recap; List<GroupXpEntryDto>? get xp;
/// Create a copy of GroupSessionDetailDto
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupSessionDetailDtoCopyWith<GroupSessionDetailDto> get copyWith => _$GroupSessionDetailDtoCopyWithImpl<GroupSessionDetailDto>(this as GroupSessionDetailDto, _$identity);

  /// Serializes this GroupSessionDetailDto to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupSessionDetailDto;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupSessionDetailDto&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.kind, _this.kind) || other.kind == _this.kind)&&(identical(other.topic, _this.topic) || other.topic == _this.topic)&&(identical(other.initiator, _this.initiator) || other.initiator == _this.initiator)&&(identical(other.status, _this.status) || other.status == _this.status)&&(identical(other.startedAt, _this.startedAt) || other.startedAt == _this.startedAt)&&(identical(other.endsAt, _this.endsAt) || other.endsAt == _this.endsAt)&&const DeepCollectionEquality().equals(other.participants, _this.participants)&&const DeepCollectionEquality().equals(other.messages, _this.messages)&&const DeepCollectionEquality().equals(other.corrections, _this.corrections)&&(identical(other.recap, _this.recap) || other.recap == _this.recap)&&const DeepCollectionEquality().equals(other.xp, _this.xp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupSessionDetailDto;
  return Object.hash(runtimeType,_this.id,_this.kind,_this.topic,_this.initiator,_this.status,_this.startedAt,_this.endsAt,const DeepCollectionEquality().hash(_this.participants),const DeepCollectionEquality().hash(_this.messages),const DeepCollectionEquality().hash(_this.corrections),_this.recap,const DeepCollectionEquality().hash(_this.xp));
}

@override
String toString() {
  final _this = this as GroupSessionDetailDto;
  return 'GroupSessionDetailDto(id: ${_this.id}, kind: ${_this.kind}, topic: ${_this.topic}, initiator: ${_this.initiator}, status: ${_this.status}, startedAt: ${_this.startedAt}, endsAt: ${_this.endsAt}, participants: ${_this.participants}, messages: ${_this.messages}, corrections: ${_this.corrections}, recap: ${_this.recap}, xp: ${_this.xp})';
}


}

/// @nodoc
abstract mixin class $GroupSessionDetailDtoCopyWith<$Res>  {
  factory $GroupSessionDetailDtoCopyWith(GroupSessionDetailDto value, $Res Function(GroupSessionDetailDto) _then) = _$GroupSessionDetailDtoCopyWithImpl;
@useResult
$Res call({
 String id, String kind, String? topic, GroupInitiatorDto initiator, String status, String startedAt, String endsAt, List<ParticipantDto> participants, List<GroupMessageDto> messages, List<GroupCorrectionDto> corrections, GroupRecapDto? recap, List<GroupXpEntryDto>? xp
});


$GroupInitiatorDtoCopyWith<$Res> get initiator;$GroupRecapDtoCopyWith<$Res>? get recap;

}
/// @nodoc
class _$GroupSessionDetailDtoCopyWithImpl<$Res>
    implements $GroupSessionDetailDtoCopyWith<$Res> {
  _$GroupSessionDetailDtoCopyWithImpl(this._self, this._then);

  final GroupSessionDetailDto _self;
  final $Res Function(GroupSessionDetailDto) _then;

/// Create a copy of GroupSessionDetailDto
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? kind = null,Object? topic = freezed,Object? initiator = null,Object? status = null,Object? startedAt = null,Object? endsAt = null,Object? participants = null,Object? messages = null,Object? corrections = null,Object? recap = freezed,Object? xp = freezed,}) {
  return _then(GroupSessionDetailDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,topic: freezed == topic ? _self.topic : topic // ignore: cast_nullable_to_non_nullable
as String?,initiator: null == initiator ? _self.initiator : initiator // ignore: cast_nullable_to_non_nullable
as GroupInitiatorDto,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,startedAt: null == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as String,endsAt: null == endsAt ? _self.endsAt : endsAt // ignore: cast_nullable_to_non_nullable
as String,participants: null == participants ? _self.participants : participants // ignore: cast_nullable_to_non_nullable
as List<ParticipantDto>,messages: null == messages ? _self.messages : messages // ignore: cast_nullable_to_non_nullable
as List<GroupMessageDto>,corrections: null == corrections ? _self.corrections : corrections // ignore: cast_nullable_to_non_nullable
as List<GroupCorrectionDto>,recap: freezed == recap ? _self.recap : recap // ignore: cast_nullable_to_non_nullable
as GroupRecapDto?,xp: freezed == xp ? _self.xp : xp // ignore: cast_nullable_to_non_nullable
as List<GroupXpEntryDto>?,
  ));
}
/// Create a copy of GroupSessionDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupInitiatorDtoCopyWith<$Res> get initiator {
  
  return $GroupInitiatorDtoCopyWith<$Res>(_self.initiator, (value) {
    return _then(_self.copyWith(initiator: value));
  });
}/// Create a copy of GroupSessionDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupRecapDtoCopyWith<$Res>? get recap {
    if (_self.recap == null) {
    return null;
  }

  return $GroupRecapDtoCopyWith<$Res>(_self.recap!, (value) {
    return _then(_self.copyWith(recap: value));
  });
}
}


/// Adds pattern-matching-related methods to [GroupSessionDetailDto].
extension GroupSessionDetailDtoPatterns on GroupSessionDetailDto {
/// A variant of `map` that fallback to returning `orElse`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupSessionDetailDto value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupSessionDetailDto() when $default != null:
return $default(_that);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// Callbacks receives the raw object, upcasted.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case final Subclass2 value:
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupSessionDetailDto value)  $default,){
final _that = this;
switch (_that) {
case _GroupSessionDetailDto():
return $default(_that);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `map` that fallback to returning `null`.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case final Subclass value:
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupSessionDetailDto value)?  $default,){
final _that = this;
switch (_that) {
case _GroupSessionDetailDto() when $default != null:
return $default(_that);case _:
  return null;

}
}
/// A variant of `when` that fallback to an `orElse` callback.
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return orElse();
/// }
/// ```

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String kind,  String? topic,  GroupInitiatorDto initiator,  String status,  String startedAt,  String endsAt,  List<ParticipantDto> participants,  List<GroupMessageDto> messages,  List<GroupCorrectionDto> corrections,  GroupRecapDto? recap,  List<GroupXpEntryDto>? xp)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupSessionDetailDto() when $default != null:
return $default(_that.id,_that.kind,_that.topic,_that.initiator,_that.status,_that.startedAt,_that.endsAt,_that.participants,_that.messages,_that.corrections,_that.recap,_that.xp);case _:
  return orElse();

}
}
/// A `switch`-like method, using callbacks.
///
/// As opposed to `map`, this offers destructuring.
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case Subclass2(:final field2):
///     return ...;
/// }
/// ```

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String kind,  String? topic,  GroupInitiatorDto initiator,  String status,  String startedAt,  String endsAt,  List<ParticipantDto> participants,  List<GroupMessageDto> messages,  List<GroupCorrectionDto> corrections,  GroupRecapDto? recap,  List<GroupXpEntryDto>? xp)  $default,) {final _that = this;
switch (_that) {
case _GroupSessionDetailDto():
return $default(_that.id,_that.kind,_that.topic,_that.initiator,_that.status,_that.startedAt,_that.endsAt,_that.participants,_that.messages,_that.corrections,_that.recap,_that.xp);case _:
  throw StateError('Unexpected subclass');

}
}
/// A variant of `when` that fallback to returning `null`
///
/// It is equivalent to doing:
/// ```dart
/// switch (sealedClass) {
///   case Subclass(:final field):
///     return ...;
///   case _:
///     return null;
/// }
/// ```

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String kind,  String? topic,  GroupInitiatorDto initiator,  String status,  String startedAt,  String endsAt,  List<ParticipantDto> participants,  List<GroupMessageDto> messages,  List<GroupCorrectionDto> corrections,  GroupRecapDto? recap,  List<GroupXpEntryDto>? xp)?  $default,) {final _that = this;
switch (_that) {
case _GroupSessionDetailDto() when $default != null:
return $default(_that.id,_that.kind,_that.topic,_that.initiator,_that.status,_that.startedAt,_that.endsAt,_that.participants,_that.messages,_that.corrections,_that.recap,_that.xp);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupSessionDetailDto implements GroupSessionDetailDto {
  const _GroupSessionDetailDto({required this.id, required this.kind, this.topic, required this.initiator, required this.status, required this.startedAt, required this.endsAt, required  List<ParticipantDto> participants, required  List<GroupMessageDto> messages, required  List<GroupCorrectionDto> corrections, this.recap,  List<GroupXpEntryDto>? xp}): _participants = participants,_messages = messages,_corrections = corrections,_xp = xp;
  factory _GroupSessionDetailDto.fromJson(Map<String, dynamic> json) => _$GroupSessionDetailDtoFromJson(json);

@override final  String id;
@override final  String kind;
@override final  String? topic;
@override final  GroupInitiatorDto initiator;
@override final  String status;
@override final  String startedAt;
@override final  String endsAt;
 final  List<ParticipantDto> _participants;
@override List<ParticipantDto> get participants {
  if (_participants is EqualUnmodifiableListView) return _participants;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_participants);
}

 final  List<GroupMessageDto> _messages;
@override List<GroupMessageDto> get messages {
  if (_messages is EqualUnmodifiableListView) return _messages;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_messages);
}

/// Solo las correcciones visibles para quien pidió el detalle (propias,
/// más las de quienes comparten).
 final  List<GroupCorrectionDto> _corrections;
/// Solo las correcciones visibles para quien pidió el detalle (propias,
/// más las de quienes comparten).
@override List<GroupCorrectionDto> get corrections {
  if (_corrections is EqualUnmodifiableListView) return _corrections;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_corrections);
}

@override final  GroupRecapDto? recap;
 final  List<GroupXpEntryDto>? _xp;
@override List<GroupXpEntryDto>? get xp {
  final value = _xp;
  if (value == null) return null;
  if (_xp is EqualUnmodifiableListView) return _xp;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(value);
}


/// Create a copy of GroupSessionDetailDto
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupSessionDetailDtoCopyWith<_GroupSessionDetailDto> get copyWith => __$GroupSessionDetailDtoCopyWithImpl<_GroupSessionDetailDto>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupSessionDetailDtoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupSessionDetailDto&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.topic, topic) || other.topic == topic)&&(identical(other.initiator, initiator) || other.initiator == initiator)&&(identical(other.status, status) || other.status == status)&&(identical(other.startedAt, startedAt) || other.startedAt == startedAt)&&(identical(other.endsAt, endsAt) || other.endsAt == endsAt)&&const DeepCollectionEquality().equals(other.participants, _participants)&&const DeepCollectionEquality().equals(other.messages, _messages)&&const DeepCollectionEquality().equals(other.corrections, _corrections)&&(identical(other.recap, recap) || other.recap == recap)&&const DeepCollectionEquality().equals(other.xp, _xp));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,kind,topic,initiator,status,startedAt,endsAt,const DeepCollectionEquality().hash(_participants),const DeepCollectionEquality().hash(_messages),const DeepCollectionEquality().hash(_corrections),recap,const DeepCollectionEquality().hash(_xp));
}

@override
String toString() {
    return 'GroupSessionDetailDto(id: $id, kind: $kind, topic: $topic, initiator: $initiator, status: $status, startedAt: $startedAt, endsAt: $endsAt, participants: $participants, messages: $messages, corrections: $corrections, recap: $recap, xp: $xp)';
}


}

/// @nodoc
abstract mixin class _$GroupSessionDetailDtoCopyWith<$Res> implements $GroupSessionDetailDtoCopyWith<$Res> {
  factory _$GroupSessionDetailDtoCopyWith(_GroupSessionDetailDto value, $Res Function(_GroupSessionDetailDto) _then) = __$GroupSessionDetailDtoCopyWithImpl;
@override @useResult
$Res call({
 String id, String kind, String? topic, GroupInitiatorDto initiator, String status, String startedAt, String endsAt, List<ParticipantDto> participants, List<GroupMessageDto> messages, List<GroupCorrectionDto> corrections, GroupRecapDto? recap, List<GroupXpEntryDto>? xp
});


@override $GroupInitiatorDtoCopyWith<$Res> get initiator;@override $GroupRecapDtoCopyWith<$Res>? get recap;

}
/// @nodoc
class __$GroupSessionDetailDtoCopyWithImpl<$Res>
    implements _$GroupSessionDetailDtoCopyWith<$Res> {
  __$GroupSessionDetailDtoCopyWithImpl(this._self, this._then);

  final _GroupSessionDetailDto _self;
  final $Res Function(_GroupSessionDetailDto) _then;

/// Create a copy of GroupSessionDetailDto
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? kind = null,Object? topic = freezed,Object? initiator = null,Object? status = null,Object? startedAt = null,Object? endsAt = null,Object? participants = null,Object? messages = null,Object? corrections = null,Object? recap = freezed,Object? xp = freezed,}) {
  return _then(_GroupSessionDetailDto(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,topic: freezed == topic ? _self.topic : topic // ignore: cast_nullable_to_non_nullable
as String?,initiator: null == initiator ? _self.initiator : initiator // ignore: cast_nullable_to_non_nullable
as GroupInitiatorDto,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,startedAt: null == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as String,endsAt: null == endsAt ? _self.endsAt : endsAt // ignore: cast_nullable_to_non_nullable
as String,participants: null == participants ? _self._participants : participants // ignore: cast_nullable_to_non_nullable
as List<ParticipantDto>,messages: null == messages ? _self._messages : messages // ignore: cast_nullable_to_non_nullable
as List<GroupMessageDto>,corrections: null == corrections ? _self._corrections : corrections // ignore: cast_nullable_to_non_nullable
as List<GroupCorrectionDto>,recap: freezed == recap ? _self.recap : recap // ignore: cast_nullable_to_non_nullable
as GroupRecapDto?,xp: freezed == xp ? _self._xp : xp // ignore: cast_nullable_to_non_nullable
as List<GroupXpEntryDto>?,
  ));
}

/// Create a copy of GroupSessionDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupInitiatorDtoCopyWith<$Res> get initiator {
  
  return $GroupInitiatorDtoCopyWith<$Res>(_self.initiator, (value) {
    return _then(_self.copyWith(initiator: value));
  });
}/// Create a copy of GroupSessionDetailDto
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupRecapDtoCopyWith<$Res>? get recap {
    if (_self.recap == null) {
    return null;
  }

  return $GroupRecapDtoCopyWith<$Res>(_self.recap!, (value) {
    return _then(_self.copyWith(recap: value));
  });
}
}

// dart format on

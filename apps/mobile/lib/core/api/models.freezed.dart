// GENERATED CODE - DO NOT MODIFY BY HAND
// coverage:ignore-file
// ignore_for_file: type=lint, type=warning, deprecated_member_use, deprecated_member_use_from_same_package
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'models.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

// GENERATED CODE - DO NOT MODIFY BY HAND
// dart format off
T _$identity<T>(T value) => value;

/// @nodoc
mixin _$Profile {

 String get displayName; String get level; List<String> get interests; String get timezone; String get locale; int get xp; int get streak; String? get lastSessionDay;
/// Create a copy of Profile
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProfileCopyWith<Profile> get copyWith => _$ProfileCopyWithImpl<Profile>(this as Profile, _$identity);

  /// Serializes this Profile to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as Profile;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Profile&&(identical(other.displayName, _this.displayName) || other.displayName == _this.displayName)&&(identical(other.level, _this.level) || other.level == _this.level)&&const DeepCollectionEquality().equals(other.interests, _this.interests)&&(identical(other.timezone, _this.timezone) || other.timezone == _this.timezone)&&(identical(other.locale, _this.locale) || other.locale == _this.locale)&&(identical(other.xp, _this.xp) || other.xp == _this.xp)&&(identical(other.streak, _this.streak) || other.streak == _this.streak)&&(identical(other.lastSessionDay, _this.lastSessionDay) || other.lastSessionDay == _this.lastSessionDay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as Profile;
  return Object.hash(runtimeType,_this.displayName,_this.level,const DeepCollectionEquality().hash(_this.interests),_this.timezone,_this.locale,_this.xp,_this.streak,_this.lastSessionDay);
}

@override
String toString() {
  final _this = this as Profile;
  return 'Profile(displayName: ${_this.displayName}, level: ${_this.level}, interests: ${_this.interests}, timezone: ${_this.timezone}, locale: ${_this.locale}, xp: ${_this.xp}, streak: ${_this.streak}, lastSessionDay: ${_this.lastSessionDay})';
}


}

/// @nodoc
abstract mixin class $ProfileCopyWith<$Res>  {
  factory $ProfileCopyWith(Profile value, $Res Function(Profile) _then) = _$ProfileCopyWithImpl;
@useResult
$Res call({
 String displayName, String level, List<String> interests, String timezone, String locale, int xp, int streak, String? lastSessionDay
});




}
/// @nodoc
class _$ProfileCopyWithImpl<$Res>
    implements $ProfileCopyWith<$Res> {
  _$ProfileCopyWithImpl(this._self, this._then);

  final Profile _self;
  final $Res Function(Profile) _then;

/// Create a copy of Profile
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? displayName = null,Object? level = null,Object? interests = null,Object? timezone = null,Object? locale = null,Object? xp = null,Object? streak = null,Object? lastSessionDay = freezed,}) {
  return _then(Profile(
displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as String,interests: null == interests ? _self.interests : interests // ignore: cast_nullable_to_non_nullable
as List<String>,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,locale: null == locale ? _self.locale : locale // ignore: cast_nullable_to_non_nullable
as String,xp: null == xp ? _self.xp : xp // ignore: cast_nullable_to_non_nullable
as int,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,lastSessionDay: freezed == lastSessionDay ? _self.lastSessionDay : lastSessionDay // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [Profile].
extension ProfilePatterns on Profile {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Profile value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Profile() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Profile value)  $default,){
final _that = this;
switch (_that) {
case _Profile():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Profile value)?  $default,){
final _that = this;
switch (_that) {
case _Profile() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String displayName,  String level,  List<String> interests,  String timezone,  String locale,  int xp,  int streak,  String? lastSessionDay)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Profile() when $default != null:
return $default(_that.displayName,_that.level,_that.interests,_that.timezone,_that.locale,_that.xp,_that.streak,_that.lastSessionDay);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String displayName,  String level,  List<String> interests,  String timezone,  String locale,  int xp,  int streak,  String? lastSessionDay)  $default,) {final _that = this;
switch (_that) {
case _Profile():
return $default(_that.displayName,_that.level,_that.interests,_that.timezone,_that.locale,_that.xp,_that.streak,_that.lastSessionDay);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String displayName,  String level,  List<String> interests,  String timezone,  String locale,  int xp,  int streak,  String? lastSessionDay)?  $default,) {final _that = this;
switch (_that) {
case _Profile() when $default != null:
return $default(_that.displayName,_that.level,_that.interests,_that.timezone,_that.locale,_that.xp,_that.streak,_that.lastSessionDay);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Profile implements Profile {
  const _Profile({required this.displayName, required this.level, required  List<String> interests, required this.timezone, required this.locale, required this.xp, required this.streak, this.lastSessionDay}): _interests = interests;
  factory _Profile.fromJson(Map<String, dynamic> json) => _$ProfileFromJson(json);

@override final  String displayName;
@override final  String level;
 final  List<String> _interests;
@override List<String> get interests {
  if (_interests is EqualUnmodifiableListView) return _interests;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_interests);
}

@override final  String timezone;
@override final  String locale;
@override final  int xp;
@override final  int streak;
@override final  String? lastSessionDay;

/// Create a copy of Profile
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProfileCopyWith<_Profile> get copyWith => __$ProfileCopyWithImpl<_Profile>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProfileToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _Profile&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.level, level) || other.level == level)&&const DeepCollectionEquality().equals(other.interests, _interests)&&(identical(other.timezone, timezone) || other.timezone == timezone)&&(identical(other.locale, locale) || other.locale == locale)&&(identical(other.xp, xp) || other.xp == xp)&&(identical(other.streak, streak) || other.streak == streak)&&(identical(other.lastSessionDay, lastSessionDay) || other.lastSessionDay == lastSessionDay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,displayName,level,const DeepCollectionEquality().hash(_interests),timezone,locale,xp,streak,lastSessionDay);
}

@override
String toString() {
    return 'Profile(displayName: $displayName, level: $level, interests: $interests, timezone: $timezone, locale: $locale, xp: $xp, streak: $streak, lastSessionDay: $lastSessionDay)';
}


}

/// @nodoc
abstract mixin class _$ProfileCopyWith<$Res> implements $ProfileCopyWith<$Res> {
  factory _$ProfileCopyWith(_Profile value, $Res Function(_Profile) _then) = __$ProfileCopyWithImpl;
@override @useResult
$Res call({
 String displayName, String level, List<String> interests, String timezone, String locale, int xp, int streak, String? lastSessionDay
});




}
/// @nodoc
class __$ProfileCopyWithImpl<$Res>
    implements _$ProfileCopyWith<$Res> {
  __$ProfileCopyWithImpl(this._self, this._then);

  final _Profile _self;
  final $Res Function(_Profile) _then;

/// Create a copy of Profile
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? displayName = null,Object? level = null,Object? interests = null,Object? timezone = null,Object? locale = null,Object? xp = null,Object? streak = null,Object? lastSessionDay = freezed,}) {
  return _then(_Profile(
displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as String,interests: null == interests ? _self._interests : interests // ignore: cast_nullable_to_non_nullable
as List<String>,timezone: null == timezone ? _self.timezone : timezone // ignore: cast_nullable_to_non_nullable
as String,locale: null == locale ? _self.locale : locale // ignore: cast_nullable_to_non_nullable
as String,xp: null == xp ? _self.xp : xp // ignore: cast_nullable_to_non_nullable
as int,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,lastSessionDay: freezed == lastSessionDay ? _self.lastSessionDay : lastSessionDay // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$GroupInfo {

 String get id; String get name; int get groupStreak;
/// Create a copy of GroupInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupInfoCopyWith<GroupInfo> get copyWith => _$GroupInfoCopyWithImpl<GroupInfo>(this as GroupInfo, _$identity);

  /// Serializes this GroupInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupInfo;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupInfo&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.name, _this.name) || other.name == _this.name)&&(identical(other.groupStreak, _this.groupStreak) || other.groupStreak == _this.groupStreak));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupInfo;
  return Object.hash(runtimeType,_this.id,_this.name,_this.groupStreak);
}

@override
String toString() {
  final _this = this as GroupInfo;
  return 'GroupInfo(id: ${_this.id}, name: ${_this.name}, groupStreak: ${_this.groupStreak})';
}


}

/// @nodoc
abstract mixin class $GroupInfoCopyWith<$Res>  {
  factory $GroupInfoCopyWith(GroupInfo value, $Res Function(GroupInfo) _then) = _$GroupInfoCopyWithImpl;
@useResult
$Res call({
 String id, String name, int groupStreak
});




}
/// @nodoc
class _$GroupInfoCopyWithImpl<$Res>
    implements $GroupInfoCopyWith<$Res> {
  _$GroupInfoCopyWithImpl(this._self, this._then);

  final GroupInfo _self;
  final $Res Function(GroupInfo) _then;

/// Create a copy of GroupInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? groupStreak = null,}) {
  return _then(GroupInfo(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,groupStreak: null == groupStreak ? _self.groupStreak : groupStreak // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [GroupInfo].
extension GroupInfoPatterns on GroupInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupInfo value)  $default,){
final _that = this;
switch (_that) {
case _GroupInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupInfo value)?  $default,){
final _that = this;
switch (_that) {
case _GroupInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  int groupStreak)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupInfo() when $default != null:
return $default(_that.id,_that.name,_that.groupStreak);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  int groupStreak)  $default,) {final _that = this;
switch (_that) {
case _GroupInfo():
return $default(_that.id,_that.name,_that.groupStreak);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  int groupStreak)?  $default,) {final _that = this;
switch (_that) {
case _GroupInfo() when $default != null:
return $default(_that.id,_that.name,_that.groupStreak);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupInfo implements GroupInfo {
  const _GroupInfo({required this.id, required this.name, this.groupStreak = 0});
  factory _GroupInfo.fromJson(Map<String, dynamic> json) => _$GroupInfoFromJson(json);

@override final  String id;
@override final  String name;
@override@JsonKey() final  int groupStreak;

/// Create a copy of GroupInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupInfoCopyWith<_GroupInfo> get copyWith => __$GroupInfoCopyWithImpl<_GroupInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupInfoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupInfo&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.groupStreak, groupStreak) || other.groupStreak == groupStreak));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,name,groupStreak);
}

@override
String toString() {
    return 'GroupInfo(id: $id, name: $name, groupStreak: $groupStreak)';
}


}

/// @nodoc
abstract mixin class _$GroupInfoCopyWith<$Res> implements $GroupInfoCopyWith<$Res> {
  factory _$GroupInfoCopyWith(_GroupInfo value, $Res Function(_GroupInfo) _then) = __$GroupInfoCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, int groupStreak
});




}
/// @nodoc
class __$GroupInfoCopyWithImpl<$Res>
    implements _$GroupInfoCopyWith<$Res> {
  __$GroupInfoCopyWithImpl(this._self, this._then);

  final _GroupInfo _self;
  final $Res Function(_GroupInfo) _then;

/// Create a copy of GroupInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? groupStreak = null,}) {
  return _then(_GroupInfo(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,groupStreak: null == groupStreak ? _self.groupStreak : groupStreak // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$ProviderInfo {

 String get provider; String get status; String? get connectedAt;
/// Create a copy of ProviderInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProviderInfoCopyWith<ProviderInfo> get copyWith => _$ProviderInfoCopyWithImpl<ProviderInfo>(this as ProviderInfo, _$identity);

  /// Serializes this ProviderInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ProviderInfo;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProviderInfo&&(identical(other.provider, _this.provider) || other.provider == _this.provider)&&(identical(other.status, _this.status) || other.status == _this.status)&&(identical(other.connectedAt, _this.connectedAt) || other.connectedAt == _this.connectedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ProviderInfo;
  return Object.hash(runtimeType,_this.provider,_this.status,_this.connectedAt);
}

@override
String toString() {
  final _this = this as ProviderInfo;
  return 'ProviderInfo(provider: ${_this.provider}, status: ${_this.status}, connectedAt: ${_this.connectedAt})';
}


}

/// @nodoc
abstract mixin class $ProviderInfoCopyWith<$Res>  {
  factory $ProviderInfoCopyWith(ProviderInfo value, $Res Function(ProviderInfo) _then) = _$ProviderInfoCopyWithImpl;
@useResult
$Res call({
 String provider, String status, String? connectedAt
});




}
/// @nodoc
class _$ProviderInfoCopyWithImpl<$Res>
    implements $ProviderInfoCopyWith<$Res> {
  _$ProviderInfoCopyWithImpl(this._self, this._then);

  final ProviderInfo _self;
  final $Res Function(ProviderInfo) _then;

/// Create a copy of ProviderInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? provider = null,Object? status = null,Object? connectedAt = freezed,}) {
  return _then(ProviderInfo(
provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,connectedAt: freezed == connectedAt ? _self.connectedAt : connectedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ProviderInfo].
extension ProviderInfoPatterns on ProviderInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProviderInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProviderInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProviderInfo value)  $default,){
final _that = this;
switch (_that) {
case _ProviderInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProviderInfo value)?  $default,){
final _that = this;
switch (_that) {
case _ProviderInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String provider,  String status,  String? connectedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProviderInfo() when $default != null:
return $default(_that.provider,_that.status,_that.connectedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String provider,  String status,  String? connectedAt)  $default,) {final _that = this;
switch (_that) {
case _ProviderInfo():
return $default(_that.provider,_that.status,_that.connectedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String provider,  String status,  String? connectedAt)?  $default,) {final _that = this;
switch (_that) {
case _ProviderInfo() when $default != null:
return $default(_that.provider,_that.status,_that.connectedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProviderInfo implements ProviderInfo {
  const _ProviderInfo({required this.provider, required this.status, this.connectedAt});
  factory _ProviderInfo.fromJson(Map<String, dynamic> json) => _$ProviderInfoFromJson(json);

@override final  String provider;
@override final  String status;
@override final  String? connectedAt;

/// Create a copy of ProviderInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProviderInfoCopyWith<_ProviderInfo> get copyWith => __$ProviderInfoCopyWithImpl<_ProviderInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProviderInfoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProviderInfo&&(identical(other.provider, provider) || other.provider == provider)&&(identical(other.status, status) || other.status == status)&&(identical(other.connectedAt, connectedAt) || other.connectedAt == connectedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,provider,status,connectedAt);
}

@override
String toString() {
    return 'ProviderInfo(provider: $provider, status: $status, connectedAt: $connectedAt)';
}


}

/// @nodoc
abstract mixin class _$ProviderInfoCopyWith<$Res> implements $ProviderInfoCopyWith<$Res> {
  factory _$ProviderInfoCopyWith(_ProviderInfo value, $Res Function(_ProviderInfo) _then) = __$ProviderInfoCopyWithImpl;
@override @useResult
$Res call({
 String provider, String status, String? connectedAt
});




}
/// @nodoc
class __$ProviderInfoCopyWithImpl<$Res>
    implements _$ProviderInfoCopyWith<$Res> {
  __$ProviderInfoCopyWithImpl(this._self, this._then);

  final _ProviderInfo _self;
  final $Res Function(_ProviderInfo) _then;

/// Create a copy of ProviderInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? provider = null,Object? status = null,Object? connectedAt = freezed,}) {
  return _then(_ProviderInfo(
provider: null == provider ? _self.provider : provider // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,connectedAt: freezed == connectedAt ? _self.connectedAt : connectedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$ModelPreference {

 String? get chatProvider; String? get chatModel; String? get briefProvider; String? get briefModel;
/// Create a copy of ModelPreference
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ModelPreferenceCopyWith<ModelPreference> get copyWith => _$ModelPreferenceCopyWithImpl<ModelPreference>(this as ModelPreference, _$identity);

  /// Serializes this ModelPreference to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ModelPreference;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ModelPreference&&(identical(other.chatProvider, _this.chatProvider) || other.chatProvider == _this.chatProvider)&&(identical(other.chatModel, _this.chatModel) || other.chatModel == _this.chatModel)&&(identical(other.briefProvider, _this.briefProvider) || other.briefProvider == _this.briefProvider)&&(identical(other.briefModel, _this.briefModel) || other.briefModel == _this.briefModel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ModelPreference;
  return Object.hash(runtimeType,_this.chatProvider,_this.chatModel,_this.briefProvider,_this.briefModel);
}

@override
String toString() {
  final _this = this as ModelPreference;
  return 'ModelPreference(chatProvider: ${_this.chatProvider}, chatModel: ${_this.chatModel}, briefProvider: ${_this.briefProvider}, briefModel: ${_this.briefModel})';
}


}

/// @nodoc
abstract mixin class $ModelPreferenceCopyWith<$Res>  {
  factory $ModelPreferenceCopyWith(ModelPreference value, $Res Function(ModelPreference) _then) = _$ModelPreferenceCopyWithImpl;
@useResult
$Res call({
 String? chatProvider, String? chatModel, String? briefProvider, String? briefModel
});




}
/// @nodoc
class _$ModelPreferenceCopyWithImpl<$Res>
    implements $ModelPreferenceCopyWith<$Res> {
  _$ModelPreferenceCopyWithImpl(this._self, this._then);

  final ModelPreference _self;
  final $Res Function(ModelPreference) _then;

/// Create a copy of ModelPreference
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? chatProvider = freezed,Object? chatModel = freezed,Object? briefProvider = freezed,Object? briefModel = freezed,}) {
  return _then(ModelPreference(
chatProvider: freezed == chatProvider ? _self.chatProvider : chatProvider // ignore: cast_nullable_to_non_nullable
as String?,chatModel: freezed == chatModel ? _self.chatModel : chatModel // ignore: cast_nullable_to_non_nullable
as String?,briefProvider: freezed == briefProvider ? _self.briefProvider : briefProvider // ignore: cast_nullable_to_non_nullable
as String?,briefModel: freezed == briefModel ? _self.briefModel : briefModel // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [ModelPreference].
extension ModelPreferencePatterns on ModelPreference {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ModelPreference value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ModelPreference() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ModelPreference value)  $default,){
final _that = this;
switch (_that) {
case _ModelPreference():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ModelPreference value)?  $default,){
final _that = this;
switch (_that) {
case _ModelPreference() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String? chatProvider,  String? chatModel,  String? briefProvider,  String? briefModel)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ModelPreference() when $default != null:
return $default(_that.chatProvider,_that.chatModel,_that.briefProvider,_that.briefModel);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String? chatProvider,  String? chatModel,  String? briefProvider,  String? briefModel)  $default,) {final _that = this;
switch (_that) {
case _ModelPreference():
return $default(_that.chatProvider,_that.chatModel,_that.briefProvider,_that.briefModel);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String? chatProvider,  String? chatModel,  String? briefProvider,  String? briefModel)?  $default,) {final _that = this;
switch (_that) {
case _ModelPreference() when $default != null:
return $default(_that.chatProvider,_that.chatModel,_that.briefProvider,_that.briefModel);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ModelPreference implements ModelPreference {
  const _ModelPreference({this.chatProvider, this.chatModel, this.briefProvider, this.briefModel});
  factory _ModelPreference.fromJson(Map<String, dynamic> json) => _$ModelPreferenceFromJson(json);

@override final  String? chatProvider;
@override final  String? chatModel;
@override final  String? briefProvider;
@override final  String? briefModel;

/// Create a copy of ModelPreference
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ModelPreferenceCopyWith<_ModelPreference> get copyWith => __$ModelPreferenceCopyWithImpl<_ModelPreference>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ModelPreferenceToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ModelPreference&&(identical(other.chatProvider, chatProvider) || other.chatProvider == chatProvider)&&(identical(other.chatModel, chatModel) || other.chatModel == chatModel)&&(identical(other.briefProvider, briefProvider) || other.briefProvider == briefProvider)&&(identical(other.briefModel, briefModel) || other.briefModel == briefModel));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,chatProvider,chatModel,briefProvider,briefModel);
}

@override
String toString() {
    return 'ModelPreference(chatProvider: $chatProvider, chatModel: $chatModel, briefProvider: $briefProvider, briefModel: $briefModel)';
}


}

/// @nodoc
abstract mixin class _$ModelPreferenceCopyWith<$Res> implements $ModelPreferenceCopyWith<$Res> {
  factory _$ModelPreferenceCopyWith(_ModelPreference value, $Res Function(_ModelPreference) _then) = __$ModelPreferenceCopyWithImpl;
@override @useResult
$Res call({
 String? chatProvider, String? chatModel, String? briefProvider, String? briefModel
});




}
/// @nodoc
class __$ModelPreferenceCopyWithImpl<$Res>
    implements _$ModelPreferenceCopyWith<$Res> {
  __$ModelPreferenceCopyWithImpl(this._self, this._then);

  final _ModelPreference _self;
  final $Res Function(_ModelPreference) _then;

/// Create a copy of ModelPreference
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? chatProvider = freezed,Object? chatModel = freezed,Object? briefProvider = freezed,Object? briefModel = freezed,}) {
  return _then(_ModelPreference(
chatProvider: freezed == chatProvider ? _self.chatProvider : chatProvider // ignore: cast_nullable_to_non_nullable
as String?,chatModel: freezed == chatModel ? _self.chatModel : chatModel // ignore: cast_nullable_to_non_nullable
as String?,briefProvider: freezed == briefProvider ? _self.briefProvider : briefProvider // ignore: cast_nullable_to_non_nullable
as String?,briefModel: freezed == briefModel ? _self.briefModel : briefModel // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$MeResponse {

 Profile get profile; GroupInfo? get group; List<ProviderInfo> get providers; ModelPreference? get modelPreference; bool get onboarded; String? get activeSessionId; List<String> get interestsCatalog; List<String> get pendingActions;
/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MeResponseCopyWith<MeResponse> get copyWith => _$MeResponseCopyWithImpl<MeResponse>(this as MeResponse, _$identity);

  /// Serializes this MeResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as MeResponse;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MeResponse&&(identical(other.profile, _this.profile) || other.profile == _this.profile)&&(identical(other.group, _this.group) || other.group == _this.group)&&const DeepCollectionEquality().equals(other.providers, _this.providers)&&(identical(other.modelPreference, _this.modelPreference) || other.modelPreference == _this.modelPreference)&&(identical(other.onboarded, _this.onboarded) || other.onboarded == _this.onboarded)&&(identical(other.activeSessionId, _this.activeSessionId) || other.activeSessionId == _this.activeSessionId)&&const DeepCollectionEquality().equals(other.interestsCatalog, _this.interestsCatalog)&&const DeepCollectionEquality().equals(other.pendingActions, _this.pendingActions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as MeResponse;
  return Object.hash(runtimeType,_this.profile,_this.group,const DeepCollectionEquality().hash(_this.providers),_this.modelPreference,_this.onboarded,_this.activeSessionId,const DeepCollectionEquality().hash(_this.interestsCatalog),const DeepCollectionEquality().hash(_this.pendingActions));
}

@override
String toString() {
  final _this = this as MeResponse;
  return 'MeResponse(profile: ${_this.profile}, group: ${_this.group}, providers: ${_this.providers}, modelPreference: ${_this.modelPreference}, onboarded: ${_this.onboarded}, activeSessionId: ${_this.activeSessionId}, interestsCatalog: ${_this.interestsCatalog}, pendingActions: ${_this.pendingActions})';
}


}

/// @nodoc
abstract mixin class $MeResponseCopyWith<$Res>  {
  factory $MeResponseCopyWith(MeResponse value, $Res Function(MeResponse) _then) = _$MeResponseCopyWithImpl;
@useResult
$Res call({
 Profile profile, GroupInfo? group, List<ProviderInfo> providers, ModelPreference? modelPreference, bool onboarded, String? activeSessionId, List<String> interestsCatalog, List<String> pendingActions
});


$ProfileCopyWith<$Res> get profile;$GroupInfoCopyWith<$Res>? get group;$ModelPreferenceCopyWith<$Res>? get modelPreference;

}
/// @nodoc
class _$MeResponseCopyWithImpl<$Res>
    implements $MeResponseCopyWith<$Res> {
  _$MeResponseCopyWithImpl(this._self, this._then);

  final MeResponse _self;
  final $Res Function(MeResponse) _then;

/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? profile = null,Object? group = freezed,Object? providers = null,Object? modelPreference = freezed,Object? onboarded = null,Object? activeSessionId = freezed,Object? interestsCatalog = null,Object? pendingActions = null,}) {
  return _then(MeResponse(
profile: null == profile ? _self.profile : profile // ignore: cast_nullable_to_non_nullable
as Profile,group: freezed == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as GroupInfo?,providers: null == providers ? _self.providers : providers // ignore: cast_nullable_to_non_nullable
as List<ProviderInfo>,modelPreference: freezed == modelPreference ? _self.modelPreference : modelPreference // ignore: cast_nullable_to_non_nullable
as ModelPreference?,onboarded: null == onboarded ? _self.onboarded : onboarded // ignore: cast_nullable_to_non_nullable
as bool,activeSessionId: freezed == activeSessionId ? _self.activeSessionId : activeSessionId // ignore: cast_nullable_to_non_nullable
as String?,interestsCatalog: null == interestsCatalog ? _self.interestsCatalog : interestsCatalog // ignore: cast_nullable_to_non_nullable
as List<String>,pendingActions: null == pendingActions ? _self.pendingActions : pendingActions // ignore: cast_nullable_to_non_nullable
as List<String>,
  ));
}
/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ProfileCopyWith<$Res> get profile {
  
  return $ProfileCopyWith<$Res>(_self.profile, (value) {
    return _then(_self.copyWith(profile: value));
  });
}/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupInfoCopyWith<$Res>? get group {
    if (_self.group == null) {
    return null;
  }

  return $GroupInfoCopyWith<$Res>(_self.group!, (value) {
    return _then(_self.copyWith(group: value));
  });
}/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ModelPreferenceCopyWith<$Res>? get modelPreference {
    if (_self.modelPreference == null) {
    return null;
  }

  return $ModelPreferenceCopyWith<$Res>(_self.modelPreference!, (value) {
    return _then(_self.copyWith(modelPreference: value));
  });
}
}


/// Adds pattern-matching-related methods to [MeResponse].
extension MeResponsePatterns on MeResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MeResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MeResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MeResponse value)  $default,){
final _that = this;
switch (_that) {
case _MeResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MeResponse value)?  $default,){
final _that = this;
switch (_that) {
case _MeResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( Profile profile,  GroupInfo? group,  List<ProviderInfo> providers,  ModelPreference? modelPreference,  bool onboarded,  String? activeSessionId,  List<String> interestsCatalog,  List<String> pendingActions)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MeResponse() when $default != null:
return $default(_that.profile,_that.group,_that.providers,_that.modelPreference,_that.onboarded,_that.activeSessionId,_that.interestsCatalog,_that.pendingActions);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( Profile profile,  GroupInfo? group,  List<ProviderInfo> providers,  ModelPreference? modelPreference,  bool onboarded,  String? activeSessionId,  List<String> interestsCatalog,  List<String> pendingActions)  $default,) {final _that = this;
switch (_that) {
case _MeResponse():
return $default(_that.profile,_that.group,_that.providers,_that.modelPreference,_that.onboarded,_that.activeSessionId,_that.interestsCatalog,_that.pendingActions);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( Profile profile,  GroupInfo? group,  List<ProviderInfo> providers,  ModelPreference? modelPreference,  bool onboarded,  String? activeSessionId,  List<String> interestsCatalog,  List<String> pendingActions)?  $default,) {final _that = this;
switch (_that) {
case _MeResponse() when $default != null:
return $default(_that.profile,_that.group,_that.providers,_that.modelPreference,_that.onboarded,_that.activeSessionId,_that.interestsCatalog,_that.pendingActions);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MeResponse implements MeResponse {
  const _MeResponse({required this.profile, this.group,  List<ProviderInfo> providers = const <ProviderInfo>[], this.modelPreference, required this.onboarded, this.activeSessionId,  List<String> interestsCatalog = const <String>[],  List<String> pendingActions = const <String>[]}): _providers = providers,_interestsCatalog = interestsCatalog,_pendingActions = pendingActions;
  factory _MeResponse.fromJson(Map<String, dynamic> json) => _$MeResponseFromJson(json);

@override final  Profile profile;
@override final  GroupInfo? group;
 final  List<ProviderInfo> _providers;
@override@JsonKey() List<ProviderInfo> get providers {
  if (_providers is EqualUnmodifiableListView) return _providers;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_providers);
}

@override final  ModelPreference? modelPreference;
@override final  bool onboarded;
@override final  String? activeSessionId;
 final  List<String> _interestsCatalog;
@override@JsonKey() List<String> get interestsCatalog {
  if (_interestsCatalog is EqualUnmodifiableListView) return _interestsCatalog;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_interestsCatalog);
}

 final  List<String> _pendingActions;
@override@JsonKey() List<String> get pendingActions {
  if (_pendingActions is EqualUnmodifiableListView) return _pendingActions;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_pendingActions);
}


/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MeResponseCopyWith<_MeResponse> get copyWith => __$MeResponseCopyWithImpl<_MeResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MeResponseToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _MeResponse&&(identical(other.profile, profile) || other.profile == profile)&&(identical(other.group, group) || other.group == group)&&const DeepCollectionEquality().equals(other.providers, _providers)&&(identical(other.modelPreference, modelPreference) || other.modelPreference == modelPreference)&&(identical(other.onboarded, onboarded) || other.onboarded == onboarded)&&(identical(other.activeSessionId, activeSessionId) || other.activeSessionId == activeSessionId)&&const DeepCollectionEquality().equals(other.interestsCatalog, _interestsCatalog)&&const DeepCollectionEquality().equals(other.pendingActions, _pendingActions));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,profile,group,const DeepCollectionEquality().hash(_providers),modelPreference,onboarded,activeSessionId,const DeepCollectionEquality().hash(_interestsCatalog),const DeepCollectionEquality().hash(_pendingActions));
}

@override
String toString() {
    return 'MeResponse(profile: $profile, group: $group, providers: $providers, modelPreference: $modelPreference, onboarded: $onboarded, activeSessionId: $activeSessionId, interestsCatalog: $interestsCatalog, pendingActions: $pendingActions)';
}


}

/// @nodoc
abstract mixin class _$MeResponseCopyWith<$Res> implements $MeResponseCopyWith<$Res> {
  factory _$MeResponseCopyWith(_MeResponse value, $Res Function(_MeResponse) _then) = __$MeResponseCopyWithImpl;
@override @useResult
$Res call({
 Profile profile, GroupInfo? group, List<ProviderInfo> providers, ModelPreference? modelPreference, bool onboarded, String? activeSessionId, List<String> interestsCatalog, List<String> pendingActions
});


@override $ProfileCopyWith<$Res> get profile;@override $GroupInfoCopyWith<$Res>? get group;@override $ModelPreferenceCopyWith<$Res>? get modelPreference;

}
/// @nodoc
class __$MeResponseCopyWithImpl<$Res>
    implements _$MeResponseCopyWith<$Res> {
  __$MeResponseCopyWithImpl(this._self, this._then);

  final _MeResponse _self;
  final $Res Function(_MeResponse) _then;

/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? profile = null,Object? group = freezed,Object? providers = null,Object? modelPreference = freezed,Object? onboarded = null,Object? activeSessionId = freezed,Object? interestsCatalog = null,Object? pendingActions = null,}) {
  return _then(_MeResponse(
profile: null == profile ? _self.profile : profile // ignore: cast_nullable_to_non_nullable
as Profile,group: freezed == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as GroupInfo?,providers: null == providers ? _self._providers : providers // ignore: cast_nullable_to_non_nullable
as List<ProviderInfo>,modelPreference: freezed == modelPreference ? _self.modelPreference : modelPreference // ignore: cast_nullable_to_non_nullable
as ModelPreference?,onboarded: null == onboarded ? _self.onboarded : onboarded // ignore: cast_nullable_to_non_nullable
as bool,activeSessionId: freezed == activeSessionId ? _self.activeSessionId : activeSessionId // ignore: cast_nullable_to_non_nullable
as String?,interestsCatalog: null == interestsCatalog ? _self._interestsCatalog : interestsCatalog // ignore: cast_nullable_to_non_nullable
as List<String>,pendingActions: null == pendingActions ? _self._pendingActions : pendingActions // ignore: cast_nullable_to_non_nullable
as List<String>,
  ));
}

/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ProfileCopyWith<$Res> get profile {
  
  return $ProfileCopyWith<$Res>(_self.profile, (value) {
    return _then(_self.copyWith(profile: value));
  });
}/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupInfoCopyWith<$Res>? get group {
    if (_self.group == null) {
    return null;
  }

  return $GroupInfoCopyWith<$Res>(_self.group!, (value) {
    return _then(_self.copyWith(group: value));
  });
}/// Create a copy of MeResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ModelPreferenceCopyWith<$Res>? get modelPreference {
    if (_self.modelPreference == null) {
    return null;
  }

  return $ModelPreferenceCopyWith<$Res>(_self.modelPreference!, (value) {
    return _then(_self.copyWith(modelPreference: value));
  });
}
}


/// @nodoc
mixin _$GroupMember {

 String get userId; String get displayName; String get level; int get xp; int get streak; String? get lastSessionDay;
/// Create a copy of GroupMember
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupMemberCopyWith<GroupMember> get copyWith => _$GroupMemberCopyWithImpl<GroupMember>(this as GroupMember, _$identity);

  /// Serializes this GroupMember to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupMember;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupMember&&(identical(other.userId, _this.userId) || other.userId == _this.userId)&&(identical(other.displayName, _this.displayName) || other.displayName == _this.displayName)&&(identical(other.level, _this.level) || other.level == _this.level)&&(identical(other.xp, _this.xp) || other.xp == _this.xp)&&(identical(other.streak, _this.streak) || other.streak == _this.streak)&&(identical(other.lastSessionDay, _this.lastSessionDay) || other.lastSessionDay == _this.lastSessionDay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupMember;
  return Object.hash(runtimeType,_this.userId,_this.displayName,_this.level,_this.xp,_this.streak,_this.lastSessionDay);
}

@override
String toString() {
  final _this = this as GroupMember;
  return 'GroupMember(userId: ${_this.userId}, displayName: ${_this.displayName}, level: ${_this.level}, xp: ${_this.xp}, streak: ${_this.streak}, lastSessionDay: ${_this.lastSessionDay})';
}


}

/// @nodoc
abstract mixin class $GroupMemberCopyWith<$Res>  {
  factory $GroupMemberCopyWith(GroupMember value, $Res Function(GroupMember) _then) = _$GroupMemberCopyWithImpl;
@useResult
$Res call({
 String userId, String displayName, String level, int xp, int streak, String? lastSessionDay
});




}
/// @nodoc
class _$GroupMemberCopyWithImpl<$Res>
    implements $GroupMemberCopyWith<$Res> {
  _$GroupMemberCopyWithImpl(this._self, this._then);

  final GroupMember _self;
  final $Res Function(GroupMember) _then;

/// Create a copy of GroupMember
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? userId = null,Object? displayName = null,Object? level = null,Object? xp = null,Object? streak = null,Object? lastSessionDay = freezed,}) {
  return _then(GroupMember(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as String,xp: null == xp ? _self.xp : xp // ignore: cast_nullable_to_non_nullable
as int,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,lastSessionDay: freezed == lastSessionDay ? _self.lastSessionDay : lastSessionDay // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [GroupMember].
extension GroupMemberPatterns on GroupMember {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupMember value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupMember() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupMember value)  $default,){
final _that = this;
switch (_that) {
case _GroupMember():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupMember value)?  $default,){
final _that = this;
switch (_that) {
case _GroupMember() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String userId,  String displayName,  String level,  int xp,  int streak,  String? lastSessionDay)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupMember() when $default != null:
return $default(_that.userId,_that.displayName,_that.level,_that.xp,_that.streak,_that.lastSessionDay);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String userId,  String displayName,  String level,  int xp,  int streak,  String? lastSessionDay)  $default,) {final _that = this;
switch (_that) {
case _GroupMember():
return $default(_that.userId,_that.displayName,_that.level,_that.xp,_that.streak,_that.lastSessionDay);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String userId,  String displayName,  String level,  int xp,  int streak,  String? lastSessionDay)?  $default,) {final _that = this;
switch (_that) {
case _GroupMember() when $default != null:
return $default(_that.userId,_that.displayName,_that.level,_that.xp,_that.streak,_that.lastSessionDay);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupMember implements GroupMember {
  const _GroupMember({required this.userId, required this.displayName, required this.level, required this.xp, required this.streak, this.lastSessionDay});
  factory _GroupMember.fromJson(Map<String, dynamic> json) => _$GroupMemberFromJson(json);

@override final  String userId;
@override final  String displayName;
@override final  String level;
@override final  int xp;
@override final  int streak;
@override final  String? lastSessionDay;

/// Create a copy of GroupMember
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupMemberCopyWith<_GroupMember> get copyWith => __$GroupMemberCopyWithImpl<_GroupMember>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupMemberToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupMember&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.level, level) || other.level == level)&&(identical(other.xp, xp) || other.xp == xp)&&(identical(other.streak, streak) || other.streak == streak)&&(identical(other.lastSessionDay, lastSessionDay) || other.lastSessionDay == lastSessionDay));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,userId,displayName,level,xp,streak,lastSessionDay);
}

@override
String toString() {
    return 'GroupMember(userId: $userId, displayName: $displayName, level: $level, xp: $xp, streak: $streak, lastSessionDay: $lastSessionDay)';
}


}

/// @nodoc
abstract mixin class _$GroupMemberCopyWith<$Res> implements $GroupMemberCopyWith<$Res> {
  factory _$GroupMemberCopyWith(_GroupMember value, $Res Function(_GroupMember) _then) = __$GroupMemberCopyWithImpl;
@override @useResult
$Res call({
 String userId, String displayName, String level, int xp, int streak, String? lastSessionDay
});




}
/// @nodoc
class __$GroupMemberCopyWithImpl<$Res>
    implements _$GroupMemberCopyWith<$Res> {
  __$GroupMemberCopyWithImpl(this._self, this._then);

  final _GroupMember _self;
  final $Res Function(_GroupMember) _then;

/// Create a copy of GroupMember
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? userId = null,Object? displayName = null,Object? level = null,Object? xp = null,Object? streak = null,Object? lastSessionDay = freezed,}) {
  return _then(_GroupMember(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as String,xp: null == xp ? _self.xp : xp // ignore: cast_nullable_to_non_nullable
as int,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,lastSessionDay: freezed == lastSessionDay ? _self.lastSessionDay : lastSessionDay // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$GroupResponse {

 GroupInfo get group; List<GroupMember> get members;
/// Create a copy of GroupResponse
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$GroupResponseCopyWith<GroupResponse> get copyWith => _$GroupResponseCopyWithImpl<GroupResponse>(this as GroupResponse, _$identity);

  /// Serializes this GroupResponse to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as GroupResponse;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is GroupResponse&&(identical(other.group, _this.group) || other.group == _this.group)&&const DeepCollectionEquality().equals(other.members, _this.members));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as GroupResponse;
  return Object.hash(runtimeType,_this.group,const DeepCollectionEquality().hash(_this.members));
}

@override
String toString() {
  final _this = this as GroupResponse;
  return 'GroupResponse(group: ${_this.group}, members: ${_this.members})';
}


}

/// @nodoc
abstract mixin class $GroupResponseCopyWith<$Res>  {
  factory $GroupResponseCopyWith(GroupResponse value, $Res Function(GroupResponse) _then) = _$GroupResponseCopyWithImpl;
@useResult
$Res call({
 GroupInfo group, List<GroupMember> members
});


$GroupInfoCopyWith<$Res> get group;

}
/// @nodoc
class _$GroupResponseCopyWithImpl<$Res>
    implements $GroupResponseCopyWith<$Res> {
  _$GroupResponseCopyWithImpl(this._self, this._then);

  final GroupResponse _self;
  final $Res Function(GroupResponse) _then;

/// Create a copy of GroupResponse
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? group = null,Object? members = null,}) {
  return _then(GroupResponse(
group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as GroupInfo,members: null == members ? _self.members : members // ignore: cast_nullable_to_non_nullable
as List<GroupMember>,
  ));
}
/// Create a copy of GroupResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupInfoCopyWith<$Res> get group {
  
  return $GroupInfoCopyWith<$Res>(_self.group, (value) {
    return _then(_self.copyWith(group: value));
  });
}
}


/// Adds pattern-matching-related methods to [GroupResponse].
extension GroupResponsePatterns on GroupResponse {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _GroupResponse value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _GroupResponse() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _GroupResponse value)  $default,){
final _that = this;
switch (_that) {
case _GroupResponse():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _GroupResponse value)?  $default,){
final _that = this;
switch (_that) {
case _GroupResponse() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( GroupInfo group,  List<GroupMember> members)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _GroupResponse() when $default != null:
return $default(_that.group,_that.members);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( GroupInfo group,  List<GroupMember> members)  $default,) {final _that = this;
switch (_that) {
case _GroupResponse():
return $default(_that.group,_that.members);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( GroupInfo group,  List<GroupMember> members)?  $default,) {final _that = this;
switch (_that) {
case _GroupResponse() when $default != null:
return $default(_that.group,_that.members);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _GroupResponse implements GroupResponse {
  const _GroupResponse({required this.group, required  List<GroupMember> members}): _members = members;
  factory _GroupResponse.fromJson(Map<String, dynamic> json) => _$GroupResponseFromJson(json);

@override final  GroupInfo group;
 final  List<GroupMember> _members;
@override List<GroupMember> get members {
  if (_members is EqualUnmodifiableListView) return _members;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_members);
}


/// Create a copy of GroupResponse
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$GroupResponseCopyWith<_GroupResponse> get copyWith => __$GroupResponseCopyWithImpl<_GroupResponse>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$GroupResponseToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _GroupResponse&&(identical(other.group, group) || other.group == group)&&const DeepCollectionEquality().equals(other.members, _members));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,group,const DeepCollectionEquality().hash(_members));
}

@override
String toString() {
    return 'GroupResponse(group: $group, members: $members)';
}


}

/// @nodoc
abstract mixin class _$GroupResponseCopyWith<$Res> implements $GroupResponseCopyWith<$Res> {
  factory _$GroupResponseCopyWith(_GroupResponse value, $Res Function(_GroupResponse) _then) = __$GroupResponseCopyWithImpl;
@override @useResult
$Res call({
 GroupInfo group, List<GroupMember> members
});


@override $GroupInfoCopyWith<$Res> get group;

}
/// @nodoc
class __$GroupResponseCopyWithImpl<$Res>
    implements _$GroupResponseCopyWith<$Res> {
  __$GroupResponseCopyWithImpl(this._self, this._then);

  final _GroupResponse _self;
  final $Res Function(_GroupResponse) _then;

/// Create a copy of GroupResponse
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? group = null,Object? members = null,}) {
  return _then(_GroupResponse(
group: null == group ? _self.group : group // ignore: cast_nullable_to_non_nullable
as GroupInfo,members: null == members ? _self._members : members // ignore: cast_nullable_to_non_nullable
as List<GroupMember>,
  ));
}

/// Create a copy of GroupResponse
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$GroupInfoCopyWith<$Res> get group {
  
  return $GroupInfoCopyWith<$Res>(_self.group, (value) {
    return _then(_self.copyWith(group: value));
  });
}
}


/// @nodoc
mixin _$PkceStartResult {

 String get authUrl; String get codeVerifierId;
/// Create a copy of PkceStartResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$PkceStartResultCopyWith<PkceStartResult> get copyWith => _$PkceStartResultCopyWithImpl<PkceStartResult>(this as PkceStartResult, _$identity);

  /// Serializes this PkceStartResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as PkceStartResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is PkceStartResult&&(identical(other.authUrl, _this.authUrl) || other.authUrl == _this.authUrl)&&(identical(other.codeVerifierId, _this.codeVerifierId) || other.codeVerifierId == _this.codeVerifierId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as PkceStartResult;
  return Object.hash(runtimeType,_this.authUrl,_this.codeVerifierId);
}

@override
String toString() {
  final _this = this as PkceStartResult;
  return 'PkceStartResult(authUrl: ${_this.authUrl}, codeVerifierId: ${_this.codeVerifierId})';
}


}

/// @nodoc
abstract mixin class $PkceStartResultCopyWith<$Res>  {
  factory $PkceStartResultCopyWith(PkceStartResult value, $Res Function(PkceStartResult) _then) = _$PkceStartResultCopyWithImpl;
@useResult
$Res call({
 String authUrl, String codeVerifierId
});




}
/// @nodoc
class _$PkceStartResultCopyWithImpl<$Res>
    implements $PkceStartResultCopyWith<$Res> {
  _$PkceStartResultCopyWithImpl(this._self, this._then);

  final PkceStartResult _self;
  final $Res Function(PkceStartResult) _then;

/// Create a copy of PkceStartResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? authUrl = null,Object? codeVerifierId = null,}) {
  return _then(PkceStartResult(
authUrl: null == authUrl ? _self.authUrl : authUrl // ignore: cast_nullable_to_non_nullable
as String,codeVerifierId: null == codeVerifierId ? _self.codeVerifierId : codeVerifierId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [PkceStartResult].
extension PkceStartResultPatterns on PkceStartResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _PkceStartResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _PkceStartResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _PkceStartResult value)  $default,){
final _that = this;
switch (_that) {
case _PkceStartResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _PkceStartResult value)?  $default,){
final _that = this;
switch (_that) {
case _PkceStartResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String authUrl,  String codeVerifierId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _PkceStartResult() when $default != null:
return $default(_that.authUrl,_that.codeVerifierId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String authUrl,  String codeVerifierId)  $default,) {final _that = this;
switch (_that) {
case _PkceStartResult():
return $default(_that.authUrl,_that.codeVerifierId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String authUrl,  String codeVerifierId)?  $default,) {final _that = this;
switch (_that) {
case _PkceStartResult() when $default != null:
return $default(_that.authUrl,_that.codeVerifierId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _PkceStartResult implements PkceStartResult {
  const _PkceStartResult({required this.authUrl, required this.codeVerifierId});
  factory _PkceStartResult.fromJson(Map<String, dynamic> json) => _$PkceStartResultFromJson(json);

@override final  String authUrl;
@override final  String codeVerifierId;

/// Create a copy of PkceStartResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$PkceStartResultCopyWith<_PkceStartResult> get copyWith => __$PkceStartResultCopyWithImpl<_PkceStartResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$PkceStartResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _PkceStartResult&&(identical(other.authUrl, authUrl) || other.authUrl == authUrl)&&(identical(other.codeVerifierId, codeVerifierId) || other.codeVerifierId == codeVerifierId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,authUrl,codeVerifierId);
}

@override
String toString() {
    return 'PkceStartResult(authUrl: $authUrl, codeVerifierId: $codeVerifierId)';
}


}

/// @nodoc
abstract mixin class _$PkceStartResultCopyWith<$Res> implements $PkceStartResultCopyWith<$Res> {
  factory _$PkceStartResultCopyWith(_PkceStartResult value, $Res Function(_PkceStartResult) _then) = __$PkceStartResultCopyWithImpl;
@override @useResult
$Res call({
 String authUrl, String codeVerifierId
});




}
/// @nodoc
class __$PkceStartResultCopyWithImpl<$Res>
    implements _$PkceStartResultCopyWith<$Res> {
  __$PkceStartResultCopyWithImpl(this._self, this._then);

  final _PkceStartResult _self;
  final $Res Function(_PkceStartResult) _then;

/// Create a copy of PkceStartResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? authUrl = null,Object? codeVerifierId = null,}) {
  return _then(_PkceStartResult(
authUrl: null == authUrl ? _self.authUrl : authUrl // ignore: cast_nullable_to_non_nullable
as String,codeVerifierId: null == codeVerifierId ? _self.codeVerifierId : codeVerifierId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$ProviderCredits {

 double get total; double get used;
/// Create a copy of ProviderCredits
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProviderCreditsCopyWith<ProviderCredits> get copyWith => _$ProviderCreditsCopyWithImpl<ProviderCredits>(this as ProviderCredits, _$identity);

  /// Serializes this ProviderCredits to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ProviderCredits;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProviderCredits&&(identical(other.total, _this.total) || other.total == _this.total)&&(identical(other.used, _this.used) || other.used == _this.used));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ProviderCredits;
  return Object.hash(runtimeType,_this.total,_this.used);
}

@override
String toString() {
  final _this = this as ProviderCredits;
  return 'ProviderCredits(total: ${_this.total}, used: ${_this.used})';
}


}

/// @nodoc
abstract mixin class $ProviderCreditsCopyWith<$Res>  {
  factory $ProviderCreditsCopyWith(ProviderCredits value, $Res Function(ProviderCredits) _then) = _$ProviderCreditsCopyWithImpl;
@useResult
$Res call({
 double total, double used
});




}
/// @nodoc
class _$ProviderCreditsCopyWithImpl<$Res>
    implements $ProviderCreditsCopyWith<$Res> {
  _$ProviderCreditsCopyWithImpl(this._self, this._then);

  final ProviderCredits _self;
  final $Res Function(ProviderCredits) _then;

/// Create a copy of ProviderCredits
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? total = null,Object? used = null,}) {
  return _then(ProviderCredits(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,used: null == used ? _self.used : used // ignore: cast_nullable_to_non_nullable
as double,
  ));
}

}


/// Adds pattern-matching-related methods to [ProviderCredits].
extension ProviderCreditsPatterns on ProviderCredits {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProviderCredits value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProviderCredits() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProviderCredits value)  $default,){
final _that = this;
switch (_that) {
case _ProviderCredits():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProviderCredits value)?  $default,){
final _that = this;
switch (_that) {
case _ProviderCredits() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( double total,  double used)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProviderCredits() when $default != null:
return $default(_that.total,_that.used);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( double total,  double used)  $default,) {final _that = this;
switch (_that) {
case _ProviderCredits():
return $default(_that.total,_that.used);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( double total,  double used)?  $default,) {final _that = this;
switch (_that) {
case _ProviderCredits() when $default != null:
return $default(_that.total,_that.used);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProviderCredits implements ProviderCredits {
  const _ProviderCredits({required this.total, required this.used});
  factory _ProviderCredits.fromJson(Map<String, dynamic> json) => _$ProviderCreditsFromJson(json);

@override final  double total;
@override final  double used;

/// Create a copy of ProviderCredits
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProviderCreditsCopyWith<_ProviderCredits> get copyWith => __$ProviderCreditsCopyWithImpl<_ProviderCredits>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProviderCreditsToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProviderCredits&&(identical(other.total, total) || other.total == total)&&(identical(other.used, used) || other.used == used));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,total,used);
}

@override
String toString() {
    return 'ProviderCredits(total: $total, used: $used)';
}


}

/// @nodoc
abstract mixin class _$ProviderCreditsCopyWith<$Res> implements $ProviderCreditsCopyWith<$Res> {
  factory _$ProviderCreditsCopyWith(_ProviderCredits value, $Res Function(_ProviderCredits) _then) = __$ProviderCreditsCopyWithImpl;
@override @useResult
$Res call({
 double total, double used
});




}
/// @nodoc
class __$ProviderCreditsCopyWithImpl<$Res>
    implements _$ProviderCreditsCopyWith<$Res> {
  __$ProviderCreditsCopyWithImpl(this._self, this._then);

  final _ProviderCredits _self;
  final $Res Function(_ProviderCredits) _then;

/// Create a copy of ProviderCredits
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? total = null,Object? used = null,}) {
  return _then(_ProviderCredits(
total: null == total ? _self.total : total // ignore: cast_nullable_to_non_nullable
as double,used: null == used ? _self.used : used // ignore: cast_nullable_to_non_nullable
as double,
  ));
}


}


/// @nodoc
mixin _$ProviderStatusResult {

 String get status; String? get lastError; ProviderCredits? get credits;
/// Create a copy of ProviderStatusResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProviderStatusResultCopyWith<ProviderStatusResult> get copyWith => _$ProviderStatusResultCopyWithImpl<ProviderStatusResult>(this as ProviderStatusResult, _$identity);

  /// Serializes this ProviderStatusResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ProviderStatusResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProviderStatusResult&&(identical(other.status, _this.status) || other.status == _this.status)&&(identical(other.lastError, _this.lastError) || other.lastError == _this.lastError)&&(identical(other.credits, _this.credits) || other.credits == _this.credits));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ProviderStatusResult;
  return Object.hash(runtimeType,_this.status,_this.lastError,_this.credits);
}

@override
String toString() {
  final _this = this as ProviderStatusResult;
  return 'ProviderStatusResult(status: ${_this.status}, lastError: ${_this.lastError}, credits: ${_this.credits})';
}


}

/// @nodoc
abstract mixin class $ProviderStatusResultCopyWith<$Res>  {
  factory $ProviderStatusResultCopyWith(ProviderStatusResult value, $Res Function(ProviderStatusResult) _then) = _$ProviderStatusResultCopyWithImpl;
@useResult
$Res call({
 String status, String? lastError, ProviderCredits? credits
});


$ProviderCreditsCopyWith<$Res>? get credits;

}
/// @nodoc
class _$ProviderStatusResultCopyWithImpl<$Res>
    implements $ProviderStatusResultCopyWith<$Res> {
  _$ProviderStatusResultCopyWithImpl(this._self, this._then);

  final ProviderStatusResult _self;
  final $Res Function(ProviderStatusResult) _then;

/// Create a copy of ProviderStatusResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? status = null,Object? lastError = freezed,Object? credits = freezed,}) {
  return _then(ProviderStatusResult(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,lastError: freezed == lastError ? _self.lastError : lastError // ignore: cast_nullable_to_non_nullable
as String?,credits: freezed == credits ? _self.credits : credits // ignore: cast_nullable_to_non_nullable
as ProviderCredits?,
  ));
}
/// Create a copy of ProviderStatusResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ProviderCreditsCopyWith<$Res>? get credits {
    if (_self.credits == null) {
    return null;
  }

  return $ProviderCreditsCopyWith<$Res>(_self.credits!, (value) {
    return _then(_self.copyWith(credits: value));
  });
}
}


/// Adds pattern-matching-related methods to [ProviderStatusResult].
extension ProviderStatusResultPatterns on ProviderStatusResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProviderStatusResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProviderStatusResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProviderStatusResult value)  $default,){
final _that = this;
switch (_that) {
case _ProviderStatusResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProviderStatusResult value)?  $default,){
final _that = this;
switch (_that) {
case _ProviderStatusResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String status,  String? lastError,  ProviderCredits? credits)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProviderStatusResult() when $default != null:
return $default(_that.status,_that.lastError,_that.credits);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String status,  String? lastError,  ProviderCredits? credits)  $default,) {final _that = this;
switch (_that) {
case _ProviderStatusResult():
return $default(_that.status,_that.lastError,_that.credits);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String status,  String? lastError,  ProviderCredits? credits)?  $default,) {final _that = this;
switch (_that) {
case _ProviderStatusResult() when $default != null:
return $default(_that.status,_that.lastError,_that.credits);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProviderStatusResult implements ProviderStatusResult {
  const _ProviderStatusResult({required this.status, this.lastError, this.credits});
  factory _ProviderStatusResult.fromJson(Map<String, dynamic> json) => _$ProviderStatusResultFromJson(json);

@override final  String status;
@override final  String? lastError;
@override final  ProviderCredits? credits;

/// Create a copy of ProviderStatusResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProviderStatusResultCopyWith<_ProviderStatusResult> get copyWith => __$ProviderStatusResultCopyWithImpl<_ProviderStatusResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProviderStatusResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProviderStatusResult&&(identical(other.status, status) || other.status == status)&&(identical(other.lastError, lastError) || other.lastError == lastError)&&(identical(other.credits, credits) || other.credits == credits));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,status,lastError,credits);
}

@override
String toString() {
    return 'ProviderStatusResult(status: $status, lastError: $lastError, credits: $credits)';
}


}

/// @nodoc
abstract mixin class _$ProviderStatusResultCopyWith<$Res> implements $ProviderStatusResultCopyWith<$Res> {
  factory _$ProviderStatusResultCopyWith(_ProviderStatusResult value, $Res Function(_ProviderStatusResult) _then) = __$ProviderStatusResultCopyWithImpl;
@override @useResult
$Res call({
 String status, String? lastError, ProviderCredits? credits
});


@override $ProviderCreditsCopyWith<$Res>? get credits;

}
/// @nodoc
class __$ProviderStatusResultCopyWithImpl<$Res>
    implements _$ProviderStatusResultCopyWith<$Res> {
  __$ProviderStatusResultCopyWithImpl(this._self, this._then);

  final _ProviderStatusResult _self;
  final $Res Function(_ProviderStatusResult) _then;

/// Create a copy of ProviderStatusResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? status = null,Object? lastError = freezed,Object? credits = freezed,}) {
  return _then(_ProviderStatusResult(
status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,lastError: freezed == lastError ? _self.lastError : lastError // ignore: cast_nullable_to_non_nullable
as String?,credits: freezed == credits ? _self.credits : credits // ignore: cast_nullable_to_non_nullable
as ProviderCredits?,
  ));
}

/// Create a copy of ProviderStatusResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$ProviderCreditsCopyWith<$Res>? get credits {
    if (_self.credits == null) {
    return null;
  }

  return $ProviderCreditsCopyWith<$Res>(_self.credits!, (value) {
    return _then(_self.copyWith(credits: value));
  });
}
}


/// @nodoc
mixin _$ModelOption {

 String get id; String get name; double? get pricePerMillionUsd;
/// Create a copy of ModelOption
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ModelOptionCopyWith<ModelOption> get copyWith => _$ModelOptionCopyWithImpl<ModelOption>(this as ModelOption, _$identity);

  /// Serializes this ModelOption to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ModelOption;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ModelOption&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.name, _this.name) || other.name == _this.name)&&(identical(other.pricePerMillionUsd, _this.pricePerMillionUsd) || other.pricePerMillionUsd == _this.pricePerMillionUsd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ModelOption;
  return Object.hash(runtimeType,_this.id,_this.name,_this.pricePerMillionUsd);
}

@override
String toString() {
  final _this = this as ModelOption;
  return 'ModelOption(id: ${_this.id}, name: ${_this.name}, pricePerMillionUsd: ${_this.pricePerMillionUsd})';
}


}

/// @nodoc
abstract mixin class $ModelOptionCopyWith<$Res>  {
  factory $ModelOptionCopyWith(ModelOption value, $Res Function(ModelOption) _then) = _$ModelOptionCopyWithImpl;
@useResult
$Res call({
 String id, String name, double? pricePerMillionUsd
});




}
/// @nodoc
class _$ModelOptionCopyWithImpl<$Res>
    implements $ModelOptionCopyWith<$Res> {
  _$ModelOptionCopyWithImpl(this._self, this._then);

  final ModelOption _self;
  final $Res Function(ModelOption) _then;

/// Create a copy of ModelOption
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? name = null,Object? pricePerMillionUsd = freezed,}) {
  return _then(ModelOption(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,pricePerMillionUsd: freezed == pricePerMillionUsd ? _self.pricePerMillionUsd : pricePerMillionUsd // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}

}


/// Adds pattern-matching-related methods to [ModelOption].
extension ModelOptionPatterns on ModelOption {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ModelOption value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ModelOption() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ModelOption value)  $default,){
final _that = this;
switch (_that) {
case _ModelOption():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ModelOption value)?  $default,){
final _that = this;
switch (_that) {
case _ModelOption() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String name,  double? pricePerMillionUsd)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ModelOption() when $default != null:
return $default(_that.id,_that.name,_that.pricePerMillionUsd);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String name,  double? pricePerMillionUsd)  $default,) {final _that = this;
switch (_that) {
case _ModelOption():
return $default(_that.id,_that.name,_that.pricePerMillionUsd);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String name,  double? pricePerMillionUsd)?  $default,) {final _that = this;
switch (_that) {
case _ModelOption() when $default != null:
return $default(_that.id,_that.name,_that.pricePerMillionUsd);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ModelOption implements ModelOption {
  const _ModelOption({required this.id, required this.name, this.pricePerMillionUsd});
  factory _ModelOption.fromJson(Map<String, dynamic> json) => _$ModelOptionFromJson(json);

@override final  String id;
@override final  String name;
@override final  double? pricePerMillionUsd;

/// Create a copy of ModelOption
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ModelOptionCopyWith<_ModelOption> get copyWith => __$ModelOptionCopyWithImpl<_ModelOption>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ModelOptionToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ModelOption&&(identical(other.id, id) || other.id == id)&&(identical(other.name, name) || other.name == name)&&(identical(other.pricePerMillionUsd, pricePerMillionUsd) || other.pricePerMillionUsd == pricePerMillionUsd));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,name,pricePerMillionUsd);
}

@override
String toString() {
    return 'ModelOption(id: $id, name: $name, pricePerMillionUsd: $pricePerMillionUsd)';
}


}

/// @nodoc
abstract mixin class _$ModelOptionCopyWith<$Res> implements $ModelOptionCopyWith<$Res> {
  factory _$ModelOptionCopyWith(_ModelOption value, $Res Function(_ModelOption) _then) = __$ModelOptionCopyWithImpl;
@override @useResult
$Res call({
 String id, String name, double? pricePerMillionUsd
});




}
/// @nodoc
class __$ModelOptionCopyWithImpl<$Res>
    implements _$ModelOptionCopyWith<$Res> {
  __$ModelOptionCopyWithImpl(this._self, this._then);

  final _ModelOption _self;
  final $Res Function(_ModelOption) _then;

/// Create a copy of ModelOption
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? name = null,Object? pricePerMillionUsd = freezed,}) {
  return _then(_ModelOption(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,pricePerMillionUsd: freezed == pricePerMillionUsd ? _self.pricePerMillionUsd : pricePerMillionUsd // ignore: cast_nullable_to_non_nullable
as double?,
  ));
}


}


/// @nodoc
mixin _$ModelTierGroups {

 List<ModelOption> get free; List<ModelOption> get budget; List<ModelOption> get premium;
/// Create a copy of ModelTierGroups
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ModelTierGroupsCopyWith<ModelTierGroups> get copyWith => _$ModelTierGroupsCopyWithImpl<ModelTierGroups>(this as ModelTierGroups, _$identity);

  /// Serializes this ModelTierGroups to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ModelTierGroups;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ModelTierGroups&&const DeepCollectionEquality().equals(other.free, _this.free)&&const DeepCollectionEquality().equals(other.budget, _this.budget)&&const DeepCollectionEquality().equals(other.premium, _this.premium));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ModelTierGroups;
  return Object.hash(runtimeType,const DeepCollectionEquality().hash(_this.free),const DeepCollectionEquality().hash(_this.budget),const DeepCollectionEquality().hash(_this.premium));
}

@override
String toString() {
  final _this = this as ModelTierGroups;
  return 'ModelTierGroups(free: ${_this.free}, budget: ${_this.budget}, premium: ${_this.premium})';
}


}

/// @nodoc
abstract mixin class $ModelTierGroupsCopyWith<$Res>  {
  factory $ModelTierGroupsCopyWith(ModelTierGroups value, $Res Function(ModelTierGroups) _then) = _$ModelTierGroupsCopyWithImpl;
@useResult
$Res call({
 List<ModelOption> free, List<ModelOption> budget, List<ModelOption> premium
});




}
/// @nodoc
class _$ModelTierGroupsCopyWithImpl<$Res>
    implements $ModelTierGroupsCopyWith<$Res> {
  _$ModelTierGroupsCopyWithImpl(this._self, this._then);

  final ModelTierGroups _self;
  final $Res Function(ModelTierGroups) _then;

/// Create a copy of ModelTierGroups
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? free = null,Object? budget = null,Object? premium = null,}) {
  return _then(ModelTierGroups(
free: null == free ? _self.free : free // ignore: cast_nullable_to_non_nullable
as List<ModelOption>,budget: null == budget ? _self.budget : budget // ignore: cast_nullable_to_non_nullable
as List<ModelOption>,premium: null == premium ? _self.premium : premium // ignore: cast_nullable_to_non_nullable
as List<ModelOption>,
  ));
}

}


/// Adds pattern-matching-related methods to [ModelTierGroups].
extension ModelTierGroupsPatterns on ModelTierGroups {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ModelTierGroups value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ModelTierGroups() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ModelTierGroups value)  $default,){
final _that = this;
switch (_that) {
case _ModelTierGroups():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ModelTierGroups value)?  $default,){
final _that = this;
switch (_that) {
case _ModelTierGroups() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<ModelOption> free,  List<ModelOption> budget,  List<ModelOption> premium)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ModelTierGroups() when $default != null:
return $default(_that.free,_that.budget,_that.premium);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<ModelOption> free,  List<ModelOption> budget,  List<ModelOption> premium)  $default,) {final _that = this;
switch (_that) {
case _ModelTierGroups():
return $default(_that.free,_that.budget,_that.premium);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<ModelOption> free,  List<ModelOption> budget,  List<ModelOption> premium)?  $default,) {final _that = this;
switch (_that) {
case _ModelTierGroups() when $default != null:
return $default(_that.free,_that.budget,_that.premium);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ModelTierGroups implements ModelTierGroups {
  const _ModelTierGroups({ List<ModelOption> free = const <ModelOption>[],  List<ModelOption> budget = const <ModelOption>[],  List<ModelOption> premium = const <ModelOption>[]}): _free = free,_budget = budget,_premium = premium;
  factory _ModelTierGroups.fromJson(Map<String, dynamic> json) => _$ModelTierGroupsFromJson(json);

 final  List<ModelOption> _free;
@override@JsonKey() List<ModelOption> get free {
  if (_free is EqualUnmodifiableListView) return _free;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_free);
}

 final  List<ModelOption> _budget;
@override@JsonKey() List<ModelOption> get budget {
  if (_budget is EqualUnmodifiableListView) return _budget;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_budget);
}

 final  List<ModelOption> _premium;
@override@JsonKey() List<ModelOption> get premium {
  if (_premium is EqualUnmodifiableListView) return _premium;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_premium);
}


/// Create a copy of ModelTierGroups
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ModelTierGroupsCopyWith<_ModelTierGroups> get copyWith => __$ModelTierGroupsCopyWithImpl<_ModelTierGroups>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ModelTierGroupsToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ModelTierGroups&&const DeepCollectionEquality().equals(other.free, _free)&&const DeepCollectionEquality().equals(other.budget, _budget)&&const DeepCollectionEquality().equals(other.premium, _premium));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,const DeepCollectionEquality().hash(_free),const DeepCollectionEquality().hash(_budget),const DeepCollectionEquality().hash(_premium));
}

@override
String toString() {
    return 'ModelTierGroups(free: $free, budget: $budget, premium: $premium)';
}


}

/// @nodoc
abstract mixin class _$ModelTierGroupsCopyWith<$Res> implements $ModelTierGroupsCopyWith<$Res> {
  factory _$ModelTierGroupsCopyWith(_ModelTierGroups value, $Res Function(_ModelTierGroups) _then) = __$ModelTierGroupsCopyWithImpl;
@override @useResult
$Res call({
 List<ModelOption> free, List<ModelOption> budget, List<ModelOption> premium
});




}
/// @nodoc
class __$ModelTierGroupsCopyWithImpl<$Res>
    implements _$ModelTierGroupsCopyWith<$Res> {
  __$ModelTierGroupsCopyWithImpl(this._self, this._then);

  final _ModelTierGroups _self;
  final $Res Function(_ModelTierGroups) _then;

/// Create a copy of ModelTierGroups
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? free = null,Object? budget = null,Object? premium = null,}) {
  return _then(_ModelTierGroups(
free: null == free ? _self._free : free // ignore: cast_nullable_to_non_nullable
as List<ModelOption>,budget: null == budget ? _self._budget : budget // ignore: cast_nullable_to_non_nullable
as List<ModelOption>,premium: null == premium ? _self._premium : premium // ignore: cast_nullable_to_non_nullable
as List<ModelOption>,
  ));
}


}


/// @nodoc
mixin _$ModelsCatalog {

 Map<String, ModelTierGroups> get providers; Map<String, double> get estimatePerSession;
/// Create a copy of ModelsCatalog
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ModelsCatalogCopyWith<ModelsCatalog> get copyWith => _$ModelsCatalogCopyWithImpl<ModelsCatalog>(this as ModelsCatalog, _$identity);

  /// Serializes this ModelsCatalog to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ModelsCatalog;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ModelsCatalog&&const DeepCollectionEquality().equals(other.providers, _this.providers)&&const DeepCollectionEquality().equals(other.estimatePerSession, _this.estimatePerSession));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ModelsCatalog;
  return Object.hash(runtimeType,const DeepCollectionEquality().hash(_this.providers),const DeepCollectionEquality().hash(_this.estimatePerSession));
}

@override
String toString() {
  final _this = this as ModelsCatalog;
  return 'ModelsCatalog(providers: ${_this.providers}, estimatePerSession: ${_this.estimatePerSession})';
}


}

/// @nodoc
abstract mixin class $ModelsCatalogCopyWith<$Res>  {
  factory $ModelsCatalogCopyWith(ModelsCatalog value, $Res Function(ModelsCatalog) _then) = _$ModelsCatalogCopyWithImpl;
@useResult
$Res call({
 Map<String, ModelTierGroups> providers, Map<String, double> estimatePerSession
});




}
/// @nodoc
class _$ModelsCatalogCopyWithImpl<$Res>
    implements $ModelsCatalogCopyWith<$Res> {
  _$ModelsCatalogCopyWithImpl(this._self, this._then);

  final ModelsCatalog _self;
  final $Res Function(ModelsCatalog) _then;

/// Create a copy of ModelsCatalog
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? providers = null,Object? estimatePerSession = null,}) {
  return _then(ModelsCatalog(
providers: null == providers ? _self.providers : providers // ignore: cast_nullable_to_non_nullable
as Map<String, ModelTierGroups>,estimatePerSession: null == estimatePerSession ? _self.estimatePerSession : estimatePerSession // ignore: cast_nullable_to_non_nullable
as Map<String, double>,
  ));
}

}


/// Adds pattern-matching-related methods to [ModelsCatalog].
extension ModelsCatalogPatterns on ModelsCatalog {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ModelsCatalog value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ModelsCatalog() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ModelsCatalog value)  $default,){
final _that = this;
switch (_that) {
case _ModelsCatalog():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ModelsCatalog value)?  $default,){
final _that = this;
switch (_that) {
case _ModelsCatalog() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( Map<String, ModelTierGroups> providers,  Map<String, double> estimatePerSession)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ModelsCatalog() when $default != null:
return $default(_that.providers,_that.estimatePerSession);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( Map<String, ModelTierGroups> providers,  Map<String, double> estimatePerSession)  $default,) {final _that = this;
switch (_that) {
case _ModelsCatalog():
return $default(_that.providers,_that.estimatePerSession);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( Map<String, ModelTierGroups> providers,  Map<String, double> estimatePerSession)?  $default,) {final _that = this;
switch (_that) {
case _ModelsCatalog() when $default != null:
return $default(_that.providers,_that.estimatePerSession);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ModelsCatalog implements ModelsCatalog {
  const _ModelsCatalog({required  Map<String, ModelTierGroups> providers,  Map<String, double> estimatePerSession = const <String, double>{}}): _providers = providers,_estimatePerSession = estimatePerSession;
  factory _ModelsCatalog.fromJson(Map<String, dynamic> json) => _$ModelsCatalogFromJson(json);

 final  Map<String, ModelTierGroups> _providers;
@override Map<String, ModelTierGroups> get providers {
  if (_providers is EqualUnmodifiableMapView) return _providers;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_providers);
}

 final  Map<String, double> _estimatePerSession;
@override@JsonKey() Map<String, double> get estimatePerSession {
  if (_estimatePerSession is EqualUnmodifiableMapView) return _estimatePerSession;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableMapView(_estimatePerSession);
}


/// Create a copy of ModelsCatalog
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ModelsCatalogCopyWith<_ModelsCatalog> get copyWith => __$ModelsCatalogCopyWithImpl<_ModelsCatalog>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ModelsCatalogToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ModelsCatalog&&const DeepCollectionEquality().equals(other.providers, _providers)&&const DeepCollectionEquality().equals(other.estimatePerSession, _estimatePerSession));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,const DeepCollectionEquality().hash(_providers),const DeepCollectionEquality().hash(_estimatePerSession));
}

@override
String toString() {
    return 'ModelsCatalog(providers: $providers, estimatePerSession: $estimatePerSession)';
}


}

/// @nodoc
abstract mixin class _$ModelsCatalogCopyWith<$Res> implements $ModelsCatalogCopyWith<$Res> {
  factory _$ModelsCatalogCopyWith(_ModelsCatalog value, $Res Function(_ModelsCatalog) _then) = __$ModelsCatalogCopyWithImpl;
@override @useResult
$Res call({
 Map<String, ModelTierGroups> providers, Map<String, double> estimatePerSession
});




}
/// @nodoc
class __$ModelsCatalogCopyWithImpl<$Res>
    implements _$ModelsCatalogCopyWith<$Res> {
  __$ModelsCatalogCopyWithImpl(this._self, this._then);

  final _ModelsCatalog _self;
  final $Res Function(_ModelsCatalog) _then;

/// Create a copy of ModelsCatalog
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? providers = null,Object? estimatePerSession = null,}) {
  return _then(_ModelsCatalog(
providers: null == providers ? _self._providers : providers // ignore: cast_nullable_to_non_nullable
as Map<String, ModelTierGroups>,estimatePerSession: null == estimatePerSession ? _self._estimatePerSession : estimatePerSession // ignore: cast_nullable_to_non_nullable
as Map<String, double>,
  ));
}


}


/// @nodoc
mixin _$RoleplayOption {

 String get id; String get title;
/// Create a copy of RoleplayOption
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RoleplayOptionCopyWith<RoleplayOption> get copyWith => _$RoleplayOptionCopyWithImpl<RoleplayOption>(this as RoleplayOption, _$identity);

  /// Serializes this RoleplayOption to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as RoleplayOption;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RoleplayOption&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.title, _this.title) || other.title == _this.title));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as RoleplayOption;
  return Object.hash(runtimeType,_this.id,_this.title);
}

@override
String toString() {
  final _this = this as RoleplayOption;
  return 'RoleplayOption(id: ${_this.id}, title: ${_this.title})';
}


}

/// @nodoc
abstract mixin class $RoleplayOptionCopyWith<$Res>  {
  factory $RoleplayOptionCopyWith(RoleplayOption value, $Res Function(RoleplayOption) _then) = _$RoleplayOptionCopyWithImpl;
@useResult
$Res call({
 String id, String title
});




}
/// @nodoc
class _$RoleplayOptionCopyWithImpl<$Res>
    implements $RoleplayOptionCopyWith<$Res> {
  _$RoleplayOptionCopyWithImpl(this._self, this._then);

  final RoleplayOption _self;
  final $Res Function(RoleplayOption) _then;

/// Create a copy of RoleplayOption
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,}) {
  return _then(RoleplayOption(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [RoleplayOption].
extension RoleplayOptionPatterns on RoleplayOption {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RoleplayOption value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RoleplayOption() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RoleplayOption value)  $default,){
final _that = this;
switch (_that) {
case _RoleplayOption():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RoleplayOption value)?  $default,){
final _that = this;
switch (_that) {
case _RoleplayOption() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RoleplayOption() when $default != null:
return $default(_that.id,_that.title);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title)  $default,) {final _that = this;
switch (_that) {
case _RoleplayOption():
return $default(_that.id,_that.title);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title)?  $default,) {final _that = this;
switch (_that) {
case _RoleplayOption() when $default != null:
return $default(_that.id,_that.title);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RoleplayOption implements RoleplayOption {
  const _RoleplayOption({required this.id, required this.title});
  factory _RoleplayOption.fromJson(Map<String, dynamic> json) => _$RoleplayOptionFromJson(json);

@override final  String id;
@override final  String title;

/// Create a copy of RoleplayOption
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RoleplayOptionCopyWith<_RoleplayOption> get copyWith => __$RoleplayOptionCopyWithImpl<_RoleplayOption>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RoleplayOptionToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _RoleplayOption&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,title);
}

@override
String toString() {
    return 'RoleplayOption(id: $id, title: $title)';
}


}

/// @nodoc
abstract mixin class _$RoleplayOptionCopyWith<$Res> implements $RoleplayOptionCopyWith<$Res> {
  factory _$RoleplayOptionCopyWith(_RoleplayOption value, $Res Function(_RoleplayOption) _then) = __$RoleplayOptionCopyWithImpl;
@override @useResult
$Res call({
 String id, String title
});




}
/// @nodoc
class __$RoleplayOptionCopyWithImpl<$Res>
    implements _$RoleplayOptionCopyWith<$Res> {
  __$RoleplayOptionCopyWithImpl(this._self, this._then);

  final _RoleplayOption _self;
  final $Res Function(_RoleplayOption) _then;

/// Create a copy of RoleplayOption
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,}) {
  return _then(_RoleplayOption(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$NewsItem {

 String get id; String get title; String get source; String? get summary; String? get time;
/// Create a copy of NewsItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$NewsItemCopyWith<NewsItem> get copyWith => _$NewsItemCopyWithImpl<NewsItem>(this as NewsItem, _$identity);

  /// Serializes this NewsItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as NewsItem;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is NewsItem&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.title, _this.title) || other.title == _this.title)&&(identical(other.source, _this.source) || other.source == _this.source)&&(identical(other.summary, _this.summary) || other.summary == _this.summary)&&(identical(other.time, _this.time) || other.time == _this.time));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as NewsItem;
  return Object.hash(runtimeType,_this.id,_this.title,_this.source,_this.summary,_this.time);
}

@override
String toString() {
  final _this = this as NewsItem;
  return 'NewsItem(id: ${_this.id}, title: ${_this.title}, source: ${_this.source}, summary: ${_this.summary}, time: ${_this.time})';
}


}

/// @nodoc
abstract mixin class $NewsItemCopyWith<$Res>  {
  factory $NewsItemCopyWith(NewsItem value, $Res Function(NewsItem) _then) = _$NewsItemCopyWithImpl;
@useResult
$Res call({
 String id, String title, String source, String? summary, String? time
});




}
/// @nodoc
class _$NewsItemCopyWithImpl<$Res>
    implements $NewsItemCopyWith<$Res> {
  _$NewsItemCopyWithImpl(this._self, this._then);

  final NewsItem _self;
  final $Res Function(NewsItem) _then;

/// Create a copy of NewsItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? title = null,Object? source = null,Object? summary = freezed,Object? time = freezed,}) {
  return _then(NewsItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,source: null == source ? _self.source : source // ignore: cast_nullable_to_non_nullable
as String,summary: freezed == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as String?,time: freezed == time ? _self.time : time // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [NewsItem].
extension NewsItemPatterns on NewsItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _NewsItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _NewsItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _NewsItem value)  $default,){
final _that = this;
switch (_that) {
case _NewsItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _NewsItem value)?  $default,){
final _that = this;
switch (_that) {
case _NewsItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String title,  String source,  String? summary,  String? time)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _NewsItem() when $default != null:
return $default(_that.id,_that.title,_that.source,_that.summary,_that.time);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String title,  String source,  String? summary,  String? time)  $default,) {final _that = this;
switch (_that) {
case _NewsItem():
return $default(_that.id,_that.title,_that.source,_that.summary,_that.time);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String title,  String source,  String? summary,  String? time)?  $default,) {final _that = this;
switch (_that) {
case _NewsItem() when $default != null:
return $default(_that.id,_that.title,_that.source,_that.summary,_that.time);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _NewsItem implements NewsItem {
  const _NewsItem({required this.id, required this.title, required this.source, this.summary, this.time});
  factory _NewsItem.fromJson(Map<String, dynamic> json) => _$NewsItemFromJson(json);

@override final  String id;
@override final  String title;
@override final  String source;
@override final  String? summary;
@override final  String? time;

/// Create a copy of NewsItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$NewsItemCopyWith<_NewsItem> get copyWith => __$NewsItemCopyWithImpl<_NewsItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$NewsItemToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _NewsItem&&(identical(other.id, id) || other.id == id)&&(identical(other.title, title) || other.title == title)&&(identical(other.source, source) || other.source == source)&&(identical(other.summary, summary) || other.summary == summary)&&(identical(other.time, time) || other.time == time));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,title,source,summary,time);
}

@override
String toString() {
    return 'NewsItem(id: $id, title: $title, source: $source, summary: $summary, time: $time)';
}


}

/// @nodoc
abstract mixin class _$NewsItemCopyWith<$Res> implements $NewsItemCopyWith<$Res> {
  factory _$NewsItemCopyWith(_NewsItem value, $Res Function(_NewsItem) _then) = __$NewsItemCopyWithImpl;
@override @useResult
$Res call({
 String id, String title, String source, String? summary, String? time
});




}
/// @nodoc
class __$NewsItemCopyWithImpl<$Res>
    implements _$NewsItemCopyWith<$Res> {
  __$NewsItemCopyWithImpl(this._self, this._then);

  final _NewsItem _self;
  final $Res Function(_NewsItem) _then;

/// Create a copy of NewsItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? title = null,Object? source = null,Object? summary = freezed,Object? time = freezed,}) {
  return _then(_NewsItem(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,title: null == title ? _self.title : title // ignore: cast_nullable_to_non_nullable
as String,source: null == source ? _self.source : source // ignore: cast_nullable_to_non_nullable
as String,summary: freezed == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as String?,time: freezed == time ? _self.time : time // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$SessionSuggestions {

 List<String> get topics; List<RoleplayOption> get roleplays; List<NewsItem> get news; bool get bossPending;
/// Create a copy of SessionSuggestions
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionSuggestionsCopyWith<SessionSuggestions> get copyWith => _$SessionSuggestionsCopyWithImpl<SessionSuggestions>(this as SessionSuggestions, _$identity);

  /// Serializes this SessionSuggestions to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as SessionSuggestions;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionSuggestions&&const DeepCollectionEquality().equals(other.topics, _this.topics)&&const DeepCollectionEquality().equals(other.roleplays, _this.roleplays)&&const DeepCollectionEquality().equals(other.news, _this.news)&&(identical(other.bossPending, _this.bossPending) || other.bossPending == _this.bossPending));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as SessionSuggestions;
  return Object.hash(runtimeType,const DeepCollectionEquality().hash(_this.topics),const DeepCollectionEquality().hash(_this.roleplays),const DeepCollectionEquality().hash(_this.news),_this.bossPending);
}

@override
String toString() {
  final _this = this as SessionSuggestions;
  return 'SessionSuggestions(topics: ${_this.topics}, roleplays: ${_this.roleplays}, news: ${_this.news}, bossPending: ${_this.bossPending})';
}


}

/// @nodoc
abstract mixin class $SessionSuggestionsCopyWith<$Res>  {
  factory $SessionSuggestionsCopyWith(SessionSuggestions value, $Res Function(SessionSuggestions) _then) = _$SessionSuggestionsCopyWithImpl;
@useResult
$Res call({
 List<String> topics, List<RoleplayOption> roleplays, List<NewsItem> news, bool bossPending
});




}
/// @nodoc
class _$SessionSuggestionsCopyWithImpl<$Res>
    implements $SessionSuggestionsCopyWith<$Res> {
  _$SessionSuggestionsCopyWithImpl(this._self, this._then);

  final SessionSuggestions _self;
  final $Res Function(SessionSuggestions) _then;

/// Create a copy of SessionSuggestions
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? topics = null,Object? roleplays = null,Object? news = null,Object? bossPending = null,}) {
  return _then(SessionSuggestions(
topics: null == topics ? _self.topics : topics // ignore: cast_nullable_to_non_nullable
as List<String>,roleplays: null == roleplays ? _self.roleplays : roleplays // ignore: cast_nullable_to_non_nullable
as List<RoleplayOption>,news: null == news ? _self.news : news // ignore: cast_nullable_to_non_nullable
as List<NewsItem>,bossPending: null == bossPending ? _self.bossPending : bossPending // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [SessionSuggestions].
extension SessionSuggestionsPatterns on SessionSuggestions {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionSuggestions value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionSuggestions() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionSuggestions value)  $default,){
final _that = this;
switch (_that) {
case _SessionSuggestions():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionSuggestions value)?  $default,){
final _that = this;
switch (_that) {
case _SessionSuggestions() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<String> topics,  List<RoleplayOption> roleplays,  List<NewsItem> news,  bool bossPending)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionSuggestions() when $default != null:
return $default(_that.topics,_that.roleplays,_that.news,_that.bossPending);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<String> topics,  List<RoleplayOption> roleplays,  List<NewsItem> news,  bool bossPending)  $default,) {final _that = this;
switch (_that) {
case _SessionSuggestions():
return $default(_that.topics,_that.roleplays,_that.news,_that.bossPending);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<String> topics,  List<RoleplayOption> roleplays,  List<NewsItem> news,  bool bossPending)?  $default,) {final _that = this;
switch (_that) {
case _SessionSuggestions() when $default != null:
return $default(_that.topics,_that.roleplays,_that.news,_that.bossPending);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SessionSuggestions implements SessionSuggestions {
  const _SessionSuggestions({ List<String> topics = const <String>[],  List<RoleplayOption> roleplays = const <RoleplayOption>[],  List<NewsItem> news = const <NewsItem>[], this.bossPending = false}): _topics = topics,_roleplays = roleplays,_news = news;
  factory _SessionSuggestions.fromJson(Map<String, dynamic> json) => _$SessionSuggestionsFromJson(json);

 final  List<String> _topics;
@override@JsonKey() List<String> get topics {
  if (_topics is EqualUnmodifiableListView) return _topics;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_topics);
}

 final  List<RoleplayOption> _roleplays;
@override@JsonKey() List<RoleplayOption> get roleplays {
  if (_roleplays is EqualUnmodifiableListView) return _roleplays;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_roleplays);
}

 final  List<NewsItem> _news;
@override@JsonKey() List<NewsItem> get news {
  if (_news is EqualUnmodifiableListView) return _news;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_news);
}

@override@JsonKey() final  bool bossPending;

/// Create a copy of SessionSuggestions
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionSuggestionsCopyWith<_SessionSuggestions> get copyWith => __$SessionSuggestionsCopyWithImpl<_SessionSuggestions>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionSuggestionsToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionSuggestions&&const DeepCollectionEquality().equals(other.topics, _topics)&&const DeepCollectionEquality().equals(other.roleplays, _roleplays)&&const DeepCollectionEquality().equals(other.news, _news)&&(identical(other.bossPending, bossPending) || other.bossPending == bossPending));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,const DeepCollectionEquality().hash(_topics),const DeepCollectionEquality().hash(_roleplays),const DeepCollectionEquality().hash(_news),bossPending);
}

@override
String toString() {
    return 'SessionSuggestions(topics: $topics, roleplays: $roleplays, news: $news, bossPending: $bossPending)';
}


}

/// @nodoc
abstract mixin class _$SessionSuggestionsCopyWith<$Res> implements $SessionSuggestionsCopyWith<$Res> {
  factory _$SessionSuggestionsCopyWith(_SessionSuggestions value, $Res Function(_SessionSuggestions) _then) = __$SessionSuggestionsCopyWithImpl;
@override @useResult
$Res call({
 List<String> topics, List<RoleplayOption> roleplays, List<NewsItem> news, bool bossPending
});




}
/// @nodoc
class __$SessionSuggestionsCopyWithImpl<$Res>
    implements _$SessionSuggestionsCopyWith<$Res> {
  __$SessionSuggestionsCopyWithImpl(this._self, this._then);

  final _SessionSuggestions _self;
  final $Res Function(_SessionSuggestions) _then;

/// Create a copy of SessionSuggestions
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? topics = null,Object? roleplays = null,Object? news = null,Object? bossPending = null,}) {
  return _then(_SessionSuggestions(
topics: null == topics ? _self._topics : topics // ignore: cast_nullable_to_non_nullable
as List<String>,roleplays: null == roleplays ? _self._roleplays : roleplays // ignore: cast_nullable_to_non_nullable
as List<RoleplayOption>,news: null == news ? _self._news : news // ignore: cast_nullable_to_non_nullable
as List<NewsItem>,bossPending: null == bossPending ? _self.bossPending : bossPending // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$SessionInfo {

 String get id; String get kind; String? get topic; String get startedAt; String? get endedAt; int? get xpEarned; String? get modelUsed;
/// Create a copy of SessionInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionInfoCopyWith<SessionInfo> get copyWith => _$SessionInfoCopyWithImpl<SessionInfo>(this as SessionInfo, _$identity);

  /// Serializes this SessionInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as SessionInfo;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionInfo&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.kind, _this.kind) || other.kind == _this.kind)&&(identical(other.topic, _this.topic) || other.topic == _this.topic)&&(identical(other.startedAt, _this.startedAt) || other.startedAt == _this.startedAt)&&(identical(other.endedAt, _this.endedAt) || other.endedAt == _this.endedAt)&&(identical(other.xpEarned, _this.xpEarned) || other.xpEarned == _this.xpEarned)&&(identical(other.modelUsed, _this.modelUsed) || other.modelUsed == _this.modelUsed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as SessionInfo;
  return Object.hash(runtimeType,_this.id,_this.kind,_this.topic,_this.startedAt,_this.endedAt,_this.xpEarned,_this.modelUsed);
}

@override
String toString() {
  final _this = this as SessionInfo;
  return 'SessionInfo(id: ${_this.id}, kind: ${_this.kind}, topic: ${_this.topic}, startedAt: ${_this.startedAt}, endedAt: ${_this.endedAt}, xpEarned: ${_this.xpEarned}, modelUsed: ${_this.modelUsed})';
}


}

/// @nodoc
abstract mixin class $SessionInfoCopyWith<$Res>  {
  factory $SessionInfoCopyWith(SessionInfo value, $Res Function(SessionInfo) _then) = _$SessionInfoCopyWithImpl;
@useResult
$Res call({
 String id, String kind, String? topic, String startedAt, String? endedAt, int? xpEarned, String? modelUsed
});




}
/// @nodoc
class _$SessionInfoCopyWithImpl<$Res>
    implements $SessionInfoCopyWith<$Res> {
  _$SessionInfoCopyWithImpl(this._self, this._then);

  final SessionInfo _self;
  final $Res Function(SessionInfo) _then;

/// Create a copy of SessionInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? kind = null,Object? topic = freezed,Object? startedAt = null,Object? endedAt = freezed,Object? xpEarned = freezed,Object? modelUsed = freezed,}) {
  return _then(SessionInfo(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,topic: freezed == topic ? _self.topic : topic // ignore: cast_nullable_to_non_nullable
as String?,startedAt: null == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as String,endedAt: freezed == endedAt ? _self.endedAt : endedAt // ignore: cast_nullable_to_non_nullable
as String?,xpEarned: freezed == xpEarned ? _self.xpEarned : xpEarned // ignore: cast_nullable_to_non_nullable
as int?,modelUsed: freezed == modelUsed ? _self.modelUsed : modelUsed // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [SessionInfo].
extension SessionInfoPatterns on SessionInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionInfo value)  $default,){
final _that = this;
switch (_that) {
case _SessionInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionInfo value)?  $default,){
final _that = this;
switch (_that) {
case _SessionInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String kind,  String? topic,  String startedAt,  String? endedAt,  int? xpEarned,  String? modelUsed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionInfo() when $default != null:
return $default(_that.id,_that.kind,_that.topic,_that.startedAt,_that.endedAt,_that.xpEarned,_that.modelUsed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String kind,  String? topic,  String startedAt,  String? endedAt,  int? xpEarned,  String? modelUsed)  $default,) {final _that = this;
switch (_that) {
case _SessionInfo():
return $default(_that.id,_that.kind,_that.topic,_that.startedAt,_that.endedAt,_that.xpEarned,_that.modelUsed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String kind,  String? topic,  String startedAt,  String? endedAt,  int? xpEarned,  String? modelUsed)?  $default,) {final _that = this;
switch (_that) {
case _SessionInfo() when $default != null:
return $default(_that.id,_that.kind,_that.topic,_that.startedAt,_that.endedAt,_that.xpEarned,_that.modelUsed);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SessionInfo implements SessionInfo {
  const _SessionInfo({required this.id, required this.kind, this.topic, required this.startedAt, this.endedAt, this.xpEarned, this.modelUsed});
  factory _SessionInfo.fromJson(Map<String, dynamic> json) => _$SessionInfoFromJson(json);

@override final  String id;
@override final  String kind;
@override final  String? topic;
@override final  String startedAt;
@override final  String? endedAt;
@override final  int? xpEarned;
@override final  String? modelUsed;

/// Create a copy of SessionInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionInfoCopyWith<_SessionInfo> get copyWith => __$SessionInfoCopyWithImpl<_SessionInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionInfoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionInfo&&(identical(other.id, id) || other.id == id)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.topic, topic) || other.topic == topic)&&(identical(other.startedAt, startedAt) || other.startedAt == startedAt)&&(identical(other.endedAt, endedAt) || other.endedAt == endedAt)&&(identical(other.xpEarned, xpEarned) || other.xpEarned == xpEarned)&&(identical(other.modelUsed, modelUsed) || other.modelUsed == modelUsed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,kind,topic,startedAt,endedAt,xpEarned,modelUsed);
}

@override
String toString() {
    return 'SessionInfo(id: $id, kind: $kind, topic: $topic, startedAt: $startedAt, endedAt: $endedAt, xpEarned: $xpEarned, modelUsed: $modelUsed)';
}


}

/// @nodoc
abstract mixin class _$SessionInfoCopyWith<$Res> implements $SessionInfoCopyWith<$Res> {
  factory _$SessionInfoCopyWith(_SessionInfo value, $Res Function(_SessionInfo) _then) = __$SessionInfoCopyWithImpl;
@override @useResult
$Res call({
 String id, String kind, String? topic, String startedAt, String? endedAt, int? xpEarned, String? modelUsed
});




}
/// @nodoc
class __$SessionInfoCopyWithImpl<$Res>
    implements _$SessionInfoCopyWith<$Res> {
  __$SessionInfoCopyWithImpl(this._self, this._then);

  final _SessionInfo _self;
  final $Res Function(_SessionInfo) _then;

/// Create a copy of SessionInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? kind = null,Object? topic = freezed,Object? startedAt = null,Object? endedAt = freezed,Object? xpEarned = freezed,Object? modelUsed = freezed,}) {
  return _then(_SessionInfo(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,topic: freezed == topic ? _self.topic : topic // ignore: cast_nullable_to_non_nullable
as String?,startedAt: null == startedAt ? _self.startedAt : startedAt // ignore: cast_nullable_to_non_nullable
as String,endedAt: freezed == endedAt ? _self.endedAt : endedAt // ignore: cast_nullable_to_non_nullable
as String?,xpEarned: freezed == xpEarned ? _self.xpEarned : xpEarned // ignore: cast_nullable_to_non_nullable
as int?,modelUsed: freezed == modelUsed ? _self.modelUsed : modelUsed // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$SessionOpening {

 String get text; bool get callbackUsed;
/// Create a copy of SessionOpening
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionOpeningCopyWith<SessionOpening> get copyWith => _$SessionOpeningCopyWithImpl<SessionOpening>(this as SessionOpening, _$identity);

  /// Serializes this SessionOpening to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as SessionOpening;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionOpening&&(identical(other.text, _this.text) || other.text == _this.text)&&(identical(other.callbackUsed, _this.callbackUsed) || other.callbackUsed == _this.callbackUsed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as SessionOpening;
  return Object.hash(runtimeType,_this.text,_this.callbackUsed);
}

@override
String toString() {
  final _this = this as SessionOpening;
  return 'SessionOpening(text: ${_this.text}, callbackUsed: ${_this.callbackUsed})';
}


}

/// @nodoc
abstract mixin class $SessionOpeningCopyWith<$Res>  {
  factory $SessionOpeningCopyWith(SessionOpening value, $Res Function(SessionOpening) _then) = _$SessionOpeningCopyWithImpl;
@useResult
$Res call({
 String text, bool callbackUsed
});




}
/// @nodoc
class _$SessionOpeningCopyWithImpl<$Res>
    implements $SessionOpeningCopyWith<$Res> {
  _$SessionOpeningCopyWithImpl(this._self, this._then);

  final SessionOpening _self;
  final $Res Function(SessionOpening) _then;

/// Create a copy of SessionOpening
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? text = null,Object? callbackUsed = null,}) {
  return _then(SessionOpening(
text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,callbackUsed: null == callbackUsed ? _self.callbackUsed : callbackUsed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [SessionOpening].
extension SessionOpeningPatterns on SessionOpening {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionOpening value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionOpening() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionOpening value)  $default,){
final _that = this;
switch (_that) {
case _SessionOpening():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionOpening value)?  $default,){
final _that = this;
switch (_that) {
case _SessionOpening() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String text,  bool callbackUsed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionOpening() when $default != null:
return $default(_that.text,_that.callbackUsed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String text,  bool callbackUsed)  $default,) {final _that = this;
switch (_that) {
case _SessionOpening():
return $default(_that.text,_that.callbackUsed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String text,  bool callbackUsed)?  $default,) {final _that = this;
switch (_that) {
case _SessionOpening() when $default != null:
return $default(_that.text,_that.callbackUsed);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SessionOpening implements SessionOpening {
  const _SessionOpening({required this.text, this.callbackUsed = false});
  factory _SessionOpening.fromJson(Map<String, dynamic> json) => _$SessionOpeningFromJson(json);

@override final  String text;
@override@JsonKey() final  bool callbackUsed;

/// Create a copy of SessionOpening
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionOpeningCopyWith<_SessionOpening> get copyWith => __$SessionOpeningCopyWithImpl<_SessionOpening>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionOpeningToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionOpening&&(identical(other.text, text) || other.text == text)&&(identical(other.callbackUsed, callbackUsed) || other.callbackUsed == callbackUsed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,text,callbackUsed);
}

@override
String toString() {
    return 'SessionOpening(text: $text, callbackUsed: $callbackUsed)';
}


}

/// @nodoc
abstract mixin class _$SessionOpeningCopyWith<$Res> implements $SessionOpeningCopyWith<$Res> {
  factory _$SessionOpeningCopyWith(_SessionOpening value, $Res Function(_SessionOpening) _then) = __$SessionOpeningCopyWithImpl;
@override @useResult
$Res call({
 String text, bool callbackUsed
});




}
/// @nodoc
class __$SessionOpeningCopyWithImpl<$Res>
    implements _$SessionOpeningCopyWith<$Res> {
  __$SessionOpeningCopyWithImpl(this._self, this._then);

  final _SessionOpening _self;
  final $Res Function(_SessionOpening) _then;

/// Create a copy of SessionOpening
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? text = null,Object? callbackUsed = null,}) {
  return _then(_SessionOpening(
text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,callbackUsed: null == callbackUsed ? _self.callbackUsed : callbackUsed // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$CreateSessionResult {

 SessionInfo get session; SessionOpening get opening;
/// Create a copy of CreateSessionResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CreateSessionResultCopyWith<CreateSessionResult> get copyWith => _$CreateSessionResultCopyWithImpl<CreateSessionResult>(this as CreateSessionResult, _$identity);

  /// Serializes this CreateSessionResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as CreateSessionResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CreateSessionResult&&(identical(other.session, _this.session) || other.session == _this.session)&&(identical(other.opening, _this.opening) || other.opening == _this.opening));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as CreateSessionResult;
  return Object.hash(runtimeType,_this.session,_this.opening);
}

@override
String toString() {
  final _this = this as CreateSessionResult;
  return 'CreateSessionResult(session: ${_this.session}, opening: ${_this.opening})';
}


}

/// @nodoc
abstract mixin class $CreateSessionResultCopyWith<$Res>  {
  factory $CreateSessionResultCopyWith(CreateSessionResult value, $Res Function(CreateSessionResult) _then) = _$CreateSessionResultCopyWithImpl;
@useResult
$Res call({
 SessionInfo session, SessionOpening opening
});


$SessionInfoCopyWith<$Res> get session;$SessionOpeningCopyWith<$Res> get opening;

}
/// @nodoc
class _$CreateSessionResultCopyWithImpl<$Res>
    implements $CreateSessionResultCopyWith<$Res> {
  _$CreateSessionResultCopyWithImpl(this._self, this._then);

  final CreateSessionResult _self;
  final $Res Function(CreateSessionResult) _then;

/// Create a copy of CreateSessionResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? session = null,Object? opening = null,}) {
  return _then(CreateSessionResult(
session: null == session ? _self.session : session // ignore: cast_nullable_to_non_nullable
as SessionInfo,opening: null == opening ? _self.opening : opening // ignore: cast_nullable_to_non_nullable
as SessionOpening,
  ));
}
/// Create a copy of CreateSessionResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionInfoCopyWith<$Res> get session {
  
  return $SessionInfoCopyWith<$Res>(_self.session, (value) {
    return _then(_self.copyWith(session: value));
  });
}/// Create a copy of CreateSessionResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionOpeningCopyWith<$Res> get opening {
  
  return $SessionOpeningCopyWith<$Res>(_self.opening, (value) {
    return _then(_self.copyWith(opening: value));
  });
}
}


/// Adds pattern-matching-related methods to [CreateSessionResult].
extension CreateSessionResultPatterns on CreateSessionResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CreateSessionResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CreateSessionResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CreateSessionResult value)  $default,){
final _that = this;
switch (_that) {
case _CreateSessionResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CreateSessionResult value)?  $default,){
final _that = this;
switch (_that) {
case _CreateSessionResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( SessionInfo session,  SessionOpening opening)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CreateSessionResult() when $default != null:
return $default(_that.session,_that.opening);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( SessionInfo session,  SessionOpening opening)  $default,) {final _that = this;
switch (_that) {
case _CreateSessionResult():
return $default(_that.session,_that.opening);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( SessionInfo session,  SessionOpening opening)?  $default,) {final _that = this;
switch (_that) {
case _CreateSessionResult() when $default != null:
return $default(_that.session,_that.opening);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CreateSessionResult implements CreateSessionResult {
  const _CreateSessionResult({required this.session, required this.opening});
  factory _CreateSessionResult.fromJson(Map<String, dynamic> json) => _$CreateSessionResultFromJson(json);

@override final  SessionInfo session;
@override final  SessionOpening opening;

/// Create a copy of CreateSessionResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CreateSessionResultCopyWith<_CreateSessionResult> get copyWith => __$CreateSessionResultCopyWithImpl<_CreateSessionResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CreateSessionResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _CreateSessionResult&&(identical(other.session, session) || other.session == session)&&(identical(other.opening, opening) || other.opening == opening));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,session,opening);
}

@override
String toString() {
    return 'CreateSessionResult(session: $session, opening: $opening)';
}


}

/// @nodoc
abstract mixin class _$CreateSessionResultCopyWith<$Res> implements $CreateSessionResultCopyWith<$Res> {
  factory _$CreateSessionResultCopyWith(_CreateSessionResult value, $Res Function(_CreateSessionResult) _then) = __$CreateSessionResultCopyWithImpl;
@override @useResult
$Res call({
 SessionInfo session, SessionOpening opening
});


@override $SessionInfoCopyWith<$Res> get session;@override $SessionOpeningCopyWith<$Res> get opening;

}
/// @nodoc
class __$CreateSessionResultCopyWithImpl<$Res>
    implements _$CreateSessionResultCopyWith<$Res> {
  __$CreateSessionResultCopyWithImpl(this._self, this._then);

  final _CreateSessionResult _self;
  final $Res Function(_CreateSessionResult) _then;

/// Create a copy of CreateSessionResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? session = null,Object? opening = null,}) {
  return _then(_CreateSessionResult(
session: null == session ? _self.session : session // ignore: cast_nullable_to_non_nullable
as SessionInfo,opening: null == opening ? _self.opening : opening // ignore: cast_nullable_to_non_nullable
as SessionOpening,
  ));
}

/// Create a copy of CreateSessionResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionInfoCopyWith<$Res> get session {
  
  return $SessionInfoCopyWith<$Res>(_self.session, (value) {
    return _then(_self.copyWith(session: value));
  });
}/// Create a copy of CreateSessionResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionOpeningCopyWith<$Res> get opening {
  
  return $SessionOpeningCopyWith<$Res>(_self.opening, (value) {
    return _then(_self.copyWith(opening: value));
  });
}
}


/// @nodoc
mixin _$Correction {

 String get original; String get corrected; String get category; String get note;
/// Create a copy of Correction
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CorrectionCopyWith<Correction> get copyWith => _$CorrectionCopyWithImpl<Correction>(this as Correction, _$identity);

  /// Serializes this Correction to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as Correction;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is Correction&&(identical(other.original, _this.original) || other.original == _this.original)&&(identical(other.corrected, _this.corrected) || other.corrected == _this.corrected)&&(identical(other.category, _this.category) || other.category == _this.category)&&(identical(other.note, _this.note) || other.note == _this.note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as Correction;
  return Object.hash(runtimeType,_this.original,_this.corrected,_this.category,_this.note);
}

@override
String toString() {
  final _this = this as Correction;
  return 'Correction(original: ${_this.original}, corrected: ${_this.corrected}, category: ${_this.category}, note: ${_this.note})';
}


}

/// @nodoc
abstract mixin class $CorrectionCopyWith<$Res>  {
  factory $CorrectionCopyWith(Correction value, $Res Function(Correction) _then) = _$CorrectionCopyWithImpl;
@useResult
$Res call({
 String original, String corrected, String category, String note
});




}
/// @nodoc
class _$CorrectionCopyWithImpl<$Res>
    implements $CorrectionCopyWith<$Res> {
  _$CorrectionCopyWithImpl(this._self, this._then);

  final Correction _self;
  final $Res Function(Correction) _then;

/// Create a copy of Correction
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? original = null,Object? corrected = null,Object? category = null,Object? note = null,}) {
  return _then(Correction(
original: null == original ? _self.original : original // ignore: cast_nullable_to_non_nullable
as String,corrected: null == corrected ? _self.corrected : corrected // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,note: null == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [Correction].
extension CorrectionPatterns on Correction {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _Correction value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _Correction() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _Correction value)  $default,){
final _that = this;
switch (_that) {
case _Correction():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _Correction value)?  $default,){
final _that = this;
switch (_that) {
case _Correction() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String original,  String corrected,  String category,  String note)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _Correction() when $default != null:
return $default(_that.original,_that.corrected,_that.category,_that.note);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String original,  String corrected,  String category,  String note)  $default,) {final _that = this;
switch (_that) {
case _Correction():
return $default(_that.original,_that.corrected,_that.category,_that.note);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String original,  String corrected,  String category,  String note)?  $default,) {final _that = this;
switch (_that) {
case _Correction() when $default != null:
return $default(_that.original,_that.corrected,_that.category,_that.note);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _Correction implements Correction {
  const _Correction({required this.original, required this.corrected, required this.category, required this.note});
  factory _Correction.fromJson(Map<String, dynamic> json) => _$CorrectionFromJson(json);

@override final  String original;
@override final  String corrected;
@override final  String category;
@override final  String note;

/// Create a copy of Correction
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CorrectionCopyWith<_Correction> get copyWith => __$CorrectionCopyWithImpl<_Correction>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CorrectionToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _Correction&&(identical(other.original, original) || other.original == original)&&(identical(other.corrected, corrected) || other.corrected == corrected)&&(identical(other.category, category) || other.category == category)&&(identical(other.note, note) || other.note == note));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,original,corrected,category,note);
}

@override
String toString() {
    return 'Correction(original: $original, corrected: $corrected, category: $category, note: $note)';
}


}

/// @nodoc
abstract mixin class _$CorrectionCopyWith<$Res> implements $CorrectionCopyWith<$Res> {
  factory _$CorrectionCopyWith(_Correction value, $Res Function(_Correction) _then) = __$CorrectionCopyWithImpl;
@override @useResult
$Res call({
 String original, String corrected, String category, String note
});




}
/// @nodoc
class __$CorrectionCopyWithImpl<$Res>
    implements _$CorrectionCopyWith<$Res> {
  __$CorrectionCopyWithImpl(this._self, this._then);

  final _Correction _self;
  final $Res Function(_Correction) _then;

/// Create a copy of Correction
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? original = null,Object? corrected = null,Object? category = null,Object? note = null,}) {
  return _then(_Correction(
original: null == original ? _self.original : original // ignore: cast_nullable_to_non_nullable
as String,corrected: null == corrected ? _self.corrected : corrected // ignore: cast_nullable_to_non_nullable
as String,category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,note: null == note ? _self.note : note // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$TurnResult {

 int get turnIdx; String get reply; List<Correction> get corrections; String? get modelUsed; bool get degraded;
/// Create a copy of TurnResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TurnResultCopyWith<TurnResult> get copyWith => _$TurnResultCopyWithImpl<TurnResult>(this as TurnResult, _$identity);

  /// Serializes this TurnResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as TurnResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TurnResult&&(identical(other.turnIdx, _this.turnIdx) || other.turnIdx == _this.turnIdx)&&(identical(other.reply, _this.reply) || other.reply == _this.reply)&&const DeepCollectionEquality().equals(other.corrections, _this.corrections)&&(identical(other.modelUsed, _this.modelUsed) || other.modelUsed == _this.modelUsed)&&(identical(other.degraded, _this.degraded) || other.degraded == _this.degraded));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as TurnResult;
  return Object.hash(runtimeType,_this.turnIdx,_this.reply,const DeepCollectionEquality().hash(_this.corrections),_this.modelUsed,_this.degraded);
}

@override
String toString() {
  final _this = this as TurnResult;
  return 'TurnResult(turnIdx: ${_this.turnIdx}, reply: ${_this.reply}, corrections: ${_this.corrections}, modelUsed: ${_this.modelUsed}, degraded: ${_this.degraded})';
}


}

/// @nodoc
abstract mixin class $TurnResultCopyWith<$Res>  {
  factory $TurnResultCopyWith(TurnResult value, $Res Function(TurnResult) _then) = _$TurnResultCopyWithImpl;
@useResult
$Res call({
 int turnIdx, String reply, List<Correction> corrections, String? modelUsed, bool degraded
});




}
/// @nodoc
class _$TurnResultCopyWithImpl<$Res>
    implements $TurnResultCopyWith<$Res> {
  _$TurnResultCopyWithImpl(this._self, this._then);

  final TurnResult _self;
  final $Res Function(TurnResult) _then;

/// Create a copy of TurnResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? turnIdx = null,Object? reply = null,Object? corrections = null,Object? modelUsed = freezed,Object? degraded = null,}) {
  return _then(TurnResult(
turnIdx: null == turnIdx ? _self.turnIdx : turnIdx // ignore: cast_nullable_to_non_nullable
as int,reply: null == reply ? _self.reply : reply // ignore: cast_nullable_to_non_nullable
as String,corrections: null == corrections ? _self.corrections : corrections // ignore: cast_nullable_to_non_nullable
as List<Correction>,modelUsed: freezed == modelUsed ? _self.modelUsed : modelUsed // ignore: cast_nullable_to_non_nullable
as String?,degraded: null == degraded ? _self.degraded : degraded // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [TurnResult].
extension TurnResultPatterns on TurnResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TurnResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TurnResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TurnResult value)  $default,){
final _that = this;
switch (_that) {
case _TurnResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TurnResult value)?  $default,){
final _that = this;
switch (_that) {
case _TurnResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int turnIdx,  String reply,  List<Correction> corrections,  String? modelUsed,  bool degraded)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TurnResult() when $default != null:
return $default(_that.turnIdx,_that.reply,_that.corrections,_that.modelUsed,_that.degraded);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int turnIdx,  String reply,  List<Correction> corrections,  String? modelUsed,  bool degraded)  $default,) {final _that = this;
switch (_that) {
case _TurnResult():
return $default(_that.turnIdx,_that.reply,_that.corrections,_that.modelUsed,_that.degraded);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int turnIdx,  String reply,  List<Correction> corrections,  String? modelUsed,  bool degraded)?  $default,) {final _that = this;
switch (_that) {
case _TurnResult() when $default != null:
return $default(_that.turnIdx,_that.reply,_that.corrections,_that.modelUsed,_that.degraded);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TurnResult implements TurnResult {
  const _TurnResult({required this.turnIdx, required this.reply,  List<Correction> corrections = const <Correction>[], this.modelUsed, this.degraded = false}): _corrections = corrections;
  factory _TurnResult.fromJson(Map<String, dynamic> json) => _$TurnResultFromJson(json);

@override final  int turnIdx;
@override final  String reply;
 final  List<Correction> _corrections;
@override@JsonKey() List<Correction> get corrections {
  if (_corrections is EqualUnmodifiableListView) return _corrections;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_corrections);
}

@override final  String? modelUsed;
@override@JsonKey() final  bool degraded;

/// Create a copy of TurnResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TurnResultCopyWith<_TurnResult> get copyWith => __$TurnResultCopyWithImpl<_TurnResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TurnResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _TurnResult&&(identical(other.turnIdx, turnIdx) || other.turnIdx == turnIdx)&&(identical(other.reply, reply) || other.reply == reply)&&const DeepCollectionEquality().equals(other.corrections, _corrections)&&(identical(other.modelUsed, modelUsed) || other.modelUsed == modelUsed)&&(identical(other.degraded, degraded) || other.degraded == degraded));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,turnIdx,reply,const DeepCollectionEquality().hash(_corrections),modelUsed,degraded);
}

@override
String toString() {
    return 'TurnResult(turnIdx: $turnIdx, reply: $reply, corrections: $corrections, modelUsed: $modelUsed, degraded: $degraded)';
}


}

/// @nodoc
abstract mixin class _$TurnResultCopyWith<$Res> implements $TurnResultCopyWith<$Res> {
  factory _$TurnResultCopyWith(_TurnResult value, $Res Function(_TurnResult) _then) = __$TurnResultCopyWithImpl;
@override @useResult
$Res call({
 int turnIdx, String reply, List<Correction> corrections, String? modelUsed, bool degraded
});




}
/// @nodoc
class __$TurnResultCopyWithImpl<$Res>
    implements _$TurnResultCopyWith<$Res> {
  __$TurnResultCopyWithImpl(this._self, this._then);

  final _TurnResult _self;
  final $Res Function(_TurnResult) _then;

/// Create a copy of TurnResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? turnIdx = null,Object? reply = null,Object? corrections = null,Object? modelUsed = freezed,Object? degraded = null,}) {
  return _then(_TurnResult(
turnIdx: null == turnIdx ? _self.turnIdx : turnIdx // ignore: cast_nullable_to_non_nullable
as int,reply: null == reply ? _self.reply : reply // ignore: cast_nullable_to_non_nullable
as String,corrections: null == corrections ? _self._corrections : corrections // ignore: cast_nullable_to_non_nullable
as List<Correction>,modelUsed: freezed == modelUsed ? _self.modelUsed : modelUsed // ignore: cast_nullable_to_non_nullable
as String?,degraded: null == degraded ? _self.degraded : degraded // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$SessionSummary {

 int get xpEarned; int get streak; bool get isDoubleDay; int get correctionsCount; int get durationSec; bool get nextIsBoss;
/// Create a copy of SessionSummary
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionSummaryCopyWith<SessionSummary> get copyWith => _$SessionSummaryCopyWithImpl<SessionSummary>(this as SessionSummary, _$identity);

  /// Serializes this SessionSummary to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as SessionSummary;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionSummary&&(identical(other.xpEarned, _this.xpEarned) || other.xpEarned == _this.xpEarned)&&(identical(other.streak, _this.streak) || other.streak == _this.streak)&&(identical(other.isDoubleDay, _this.isDoubleDay) || other.isDoubleDay == _this.isDoubleDay)&&(identical(other.correctionsCount, _this.correctionsCount) || other.correctionsCount == _this.correctionsCount)&&(identical(other.durationSec, _this.durationSec) || other.durationSec == _this.durationSec)&&(identical(other.nextIsBoss, _this.nextIsBoss) || other.nextIsBoss == _this.nextIsBoss));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as SessionSummary;
  return Object.hash(runtimeType,_this.xpEarned,_this.streak,_this.isDoubleDay,_this.correctionsCount,_this.durationSec,_this.nextIsBoss);
}

@override
String toString() {
  final _this = this as SessionSummary;
  return 'SessionSummary(xpEarned: ${_this.xpEarned}, streak: ${_this.streak}, isDoubleDay: ${_this.isDoubleDay}, correctionsCount: ${_this.correctionsCount}, durationSec: ${_this.durationSec}, nextIsBoss: ${_this.nextIsBoss})';
}


}

/// @nodoc
abstract mixin class $SessionSummaryCopyWith<$Res>  {
  factory $SessionSummaryCopyWith(SessionSummary value, $Res Function(SessionSummary) _then) = _$SessionSummaryCopyWithImpl;
@useResult
$Res call({
 int xpEarned, int streak, bool isDoubleDay, int correctionsCount, int durationSec, bool nextIsBoss
});




}
/// @nodoc
class _$SessionSummaryCopyWithImpl<$Res>
    implements $SessionSummaryCopyWith<$Res> {
  _$SessionSummaryCopyWithImpl(this._self, this._then);

  final SessionSummary _self;
  final $Res Function(SessionSummary) _then;

/// Create a copy of SessionSummary
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? xpEarned = null,Object? streak = null,Object? isDoubleDay = null,Object? correctionsCount = null,Object? durationSec = null,Object? nextIsBoss = null,}) {
  return _then(SessionSummary(
xpEarned: null == xpEarned ? _self.xpEarned : xpEarned // ignore: cast_nullable_to_non_nullable
as int,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,isDoubleDay: null == isDoubleDay ? _self.isDoubleDay : isDoubleDay // ignore: cast_nullable_to_non_nullable
as bool,correctionsCount: null == correctionsCount ? _self.correctionsCount : correctionsCount // ignore: cast_nullable_to_non_nullable
as int,durationSec: null == durationSec ? _self.durationSec : durationSec // ignore: cast_nullable_to_non_nullable
as int,nextIsBoss: null == nextIsBoss ? _self.nextIsBoss : nextIsBoss // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}

}


/// Adds pattern-matching-related methods to [SessionSummary].
extension SessionSummaryPatterns on SessionSummary {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionSummary value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionSummary() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionSummary value)  $default,){
final _that = this;
switch (_that) {
case _SessionSummary():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionSummary value)?  $default,){
final _that = this;
switch (_that) {
case _SessionSummary() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int xpEarned,  int streak,  bool isDoubleDay,  int correctionsCount,  int durationSec,  bool nextIsBoss)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionSummary() when $default != null:
return $default(_that.xpEarned,_that.streak,_that.isDoubleDay,_that.correctionsCount,_that.durationSec,_that.nextIsBoss);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int xpEarned,  int streak,  bool isDoubleDay,  int correctionsCount,  int durationSec,  bool nextIsBoss)  $default,) {final _that = this;
switch (_that) {
case _SessionSummary():
return $default(_that.xpEarned,_that.streak,_that.isDoubleDay,_that.correctionsCount,_that.durationSec,_that.nextIsBoss);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int xpEarned,  int streak,  bool isDoubleDay,  int correctionsCount,  int durationSec,  bool nextIsBoss)?  $default,) {final _that = this;
switch (_that) {
case _SessionSummary() when $default != null:
return $default(_that.xpEarned,_that.streak,_that.isDoubleDay,_that.correctionsCount,_that.durationSec,_that.nextIsBoss);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SessionSummary implements SessionSummary {
  const _SessionSummary({required this.xpEarned, required this.streak, this.isDoubleDay = false, required this.correctionsCount, required this.durationSec, this.nextIsBoss = false});
  factory _SessionSummary.fromJson(Map<String, dynamic> json) => _$SessionSummaryFromJson(json);

@override final  int xpEarned;
@override final  int streak;
@override@JsonKey() final  bool isDoubleDay;
@override final  int correctionsCount;
@override final  int durationSec;
@override@JsonKey() final  bool nextIsBoss;

/// Create a copy of SessionSummary
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionSummaryCopyWith<_SessionSummary> get copyWith => __$SessionSummaryCopyWithImpl<_SessionSummary>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionSummaryToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionSummary&&(identical(other.xpEarned, xpEarned) || other.xpEarned == xpEarned)&&(identical(other.streak, streak) || other.streak == streak)&&(identical(other.isDoubleDay, isDoubleDay) || other.isDoubleDay == isDoubleDay)&&(identical(other.correctionsCount, correctionsCount) || other.correctionsCount == correctionsCount)&&(identical(other.durationSec, durationSec) || other.durationSec == durationSec)&&(identical(other.nextIsBoss, nextIsBoss) || other.nextIsBoss == nextIsBoss));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,xpEarned,streak,isDoubleDay,correctionsCount,durationSec,nextIsBoss);
}

@override
String toString() {
    return 'SessionSummary(xpEarned: $xpEarned, streak: $streak, isDoubleDay: $isDoubleDay, correctionsCount: $correctionsCount, durationSec: $durationSec, nextIsBoss: $nextIsBoss)';
}


}

/// @nodoc
abstract mixin class _$SessionSummaryCopyWith<$Res> implements $SessionSummaryCopyWith<$Res> {
  factory _$SessionSummaryCopyWith(_SessionSummary value, $Res Function(_SessionSummary) _then) = __$SessionSummaryCopyWithImpl;
@override @useResult
$Res call({
 int xpEarned, int streak, bool isDoubleDay, int correctionsCount, int durationSec, bool nextIsBoss
});




}
/// @nodoc
class __$SessionSummaryCopyWithImpl<$Res>
    implements _$SessionSummaryCopyWith<$Res> {
  __$SessionSummaryCopyWithImpl(this._self, this._then);

  final _SessionSummary _self;
  final $Res Function(_SessionSummary) _then;

/// Create a copy of SessionSummary
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? xpEarned = null,Object? streak = null,Object? isDoubleDay = null,Object? correctionsCount = null,Object? durationSec = null,Object? nextIsBoss = null,}) {
  return _then(_SessionSummary(
xpEarned: null == xpEarned ? _self.xpEarned : xpEarned // ignore: cast_nullable_to_non_nullable
as int,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,isDoubleDay: null == isDoubleDay ? _self.isDoubleDay : isDoubleDay // ignore: cast_nullable_to_non_nullable
as bool,correctionsCount: null == correctionsCount ? _self.correctionsCount : correctionsCount // ignore: cast_nullable_to_non_nullable
as int,durationSec: null == durationSec ? _self.durationSec : durationSec // ignore: cast_nullable_to_non_nullable
as int,nextIsBoss: null == nextIsBoss ? _self.nextIsBoss : nextIsBoss // ignore: cast_nullable_to_non_nullable
as bool,
  ));
}


}


/// @nodoc
mixin _$SessionEndResult {

 SessionSummary get summary;
/// Create a copy of SessionEndResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionEndResultCopyWith<SessionEndResult> get copyWith => _$SessionEndResultCopyWithImpl<SessionEndResult>(this as SessionEndResult, _$identity);

  /// Serializes this SessionEndResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as SessionEndResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionEndResult&&(identical(other.summary, _this.summary) || other.summary == _this.summary));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as SessionEndResult;
  return Object.hash(runtimeType,_this.summary);
}

@override
String toString() {
  final _this = this as SessionEndResult;
  return 'SessionEndResult(summary: ${_this.summary})';
}


}

/// @nodoc
abstract mixin class $SessionEndResultCopyWith<$Res>  {
  factory $SessionEndResultCopyWith(SessionEndResult value, $Res Function(SessionEndResult) _then) = _$SessionEndResultCopyWithImpl;
@useResult
$Res call({
 SessionSummary summary
});


$SessionSummaryCopyWith<$Res> get summary;

}
/// @nodoc
class _$SessionEndResultCopyWithImpl<$Res>
    implements $SessionEndResultCopyWith<$Res> {
  _$SessionEndResultCopyWithImpl(this._self, this._then);

  final SessionEndResult _self;
  final $Res Function(SessionEndResult) _then;

/// Create a copy of SessionEndResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? summary = null,}) {
  return _then(SessionEndResult(
summary: null == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as SessionSummary,
  ));
}
/// Create a copy of SessionEndResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionSummaryCopyWith<$Res> get summary {
  
  return $SessionSummaryCopyWith<$Res>(_self.summary, (value) {
    return _then(_self.copyWith(summary: value));
  });
}
}


/// Adds pattern-matching-related methods to [SessionEndResult].
extension SessionEndResultPatterns on SessionEndResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionEndResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionEndResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionEndResult value)  $default,){
final _that = this;
switch (_that) {
case _SessionEndResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionEndResult value)?  $default,){
final _that = this;
switch (_that) {
case _SessionEndResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( SessionSummary summary)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionEndResult() when $default != null:
return $default(_that.summary);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( SessionSummary summary)  $default,) {final _that = this;
switch (_that) {
case _SessionEndResult():
return $default(_that.summary);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( SessionSummary summary)?  $default,) {final _that = this;
switch (_that) {
case _SessionEndResult() when $default != null:
return $default(_that.summary);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SessionEndResult implements SessionEndResult {
  const _SessionEndResult({required this.summary});
  factory _SessionEndResult.fromJson(Map<String, dynamic> json) => _$SessionEndResultFromJson(json);

@override final  SessionSummary summary;

/// Create a copy of SessionEndResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionEndResultCopyWith<_SessionEndResult> get copyWith => __$SessionEndResultCopyWithImpl<_SessionEndResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionEndResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionEndResult&&(identical(other.summary, summary) || other.summary == summary));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,summary);
}

@override
String toString() {
    return 'SessionEndResult(summary: $summary)';
}


}

/// @nodoc
abstract mixin class _$SessionEndResultCopyWith<$Res> implements $SessionEndResultCopyWith<$Res> {
  factory _$SessionEndResultCopyWith(_SessionEndResult value, $Res Function(_SessionEndResult) _then) = __$SessionEndResultCopyWithImpl;
@override @useResult
$Res call({
 SessionSummary summary
});


@override $SessionSummaryCopyWith<$Res> get summary;

}
/// @nodoc
class __$SessionEndResultCopyWithImpl<$Res>
    implements _$SessionEndResultCopyWith<$Res> {
  __$SessionEndResultCopyWithImpl(this._self, this._then);

  final _SessionEndResult _self;
  final $Res Function(_SessionEndResult) _then;

/// Create a copy of SessionEndResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? summary = null,}) {
  return _then(_SessionEndResult(
summary: null == summary ? _self.summary : summary // ignore: cast_nullable_to_non_nullable
as SessionSummary,
  ));
}

/// Create a copy of SessionEndResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionSummaryCopyWith<$Res> get summary {
  
  return $SessionSummaryCopyWith<$Res>(_self.summary, (value) {
    return _then(_self.copyWith(summary: value));
  });
}
}


/// @nodoc
mixin _$SessionListResult {

 List<SessionInfo> get items; String? get nextCursor;
/// Create a copy of SessionListResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionListResultCopyWith<SessionListResult> get copyWith => _$SessionListResultCopyWithImpl<SessionListResult>(this as SessionListResult, _$identity);

  /// Serializes this SessionListResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as SessionListResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionListResult&&const DeepCollectionEquality().equals(other.items, _this.items)&&(identical(other.nextCursor, _this.nextCursor) || other.nextCursor == _this.nextCursor));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as SessionListResult;
  return Object.hash(runtimeType,const DeepCollectionEquality().hash(_this.items),_this.nextCursor);
}

@override
String toString() {
  final _this = this as SessionListResult;
  return 'SessionListResult(items: ${_this.items}, nextCursor: ${_this.nextCursor})';
}


}

/// @nodoc
abstract mixin class $SessionListResultCopyWith<$Res>  {
  factory $SessionListResultCopyWith(SessionListResult value, $Res Function(SessionListResult) _then) = _$SessionListResultCopyWithImpl;
@useResult
$Res call({
 List<SessionInfo> items, String? nextCursor
});




}
/// @nodoc
class _$SessionListResultCopyWithImpl<$Res>
    implements $SessionListResultCopyWith<$Res> {
  _$SessionListResultCopyWithImpl(this._self, this._then);

  final SessionListResult _self;
  final $Res Function(SessionListResult) _then;

/// Create a copy of SessionListResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? items = null,Object? nextCursor = freezed,}) {
  return _then(SessionListResult(
items: null == items ? _self.items : items // ignore: cast_nullable_to_non_nullable
as List<SessionInfo>,nextCursor: freezed == nextCursor ? _self.nextCursor : nextCursor // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [SessionListResult].
extension SessionListResultPatterns on SessionListResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionListResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionListResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionListResult value)  $default,){
final _that = this;
switch (_that) {
case _SessionListResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionListResult value)?  $default,){
final _that = this;
switch (_that) {
case _SessionListResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<SessionInfo> items,  String? nextCursor)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionListResult() when $default != null:
return $default(_that.items,_that.nextCursor);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<SessionInfo> items,  String? nextCursor)  $default,) {final _that = this;
switch (_that) {
case _SessionListResult():
return $default(_that.items,_that.nextCursor);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<SessionInfo> items,  String? nextCursor)?  $default,) {final _that = this;
switch (_that) {
case _SessionListResult() when $default != null:
return $default(_that.items,_that.nextCursor);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SessionListResult implements SessionListResult {
  const _SessionListResult({required  List<SessionInfo> items, this.nextCursor}): _items = items;
  factory _SessionListResult.fromJson(Map<String, dynamic> json) => _$SessionListResultFromJson(json);

 final  List<SessionInfo> _items;
@override List<SessionInfo> get items {
  if (_items is EqualUnmodifiableListView) return _items;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_items);
}

@override final  String? nextCursor;

/// Create a copy of SessionListResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionListResultCopyWith<_SessionListResult> get copyWith => __$SessionListResultCopyWithImpl<_SessionListResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionListResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionListResult&&const DeepCollectionEquality().equals(other.items, _items)&&(identical(other.nextCursor, nextCursor) || other.nextCursor == nextCursor));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,const DeepCollectionEquality().hash(_items),nextCursor);
}

@override
String toString() {
    return 'SessionListResult(items: $items, nextCursor: $nextCursor)';
}


}

/// @nodoc
abstract mixin class _$SessionListResultCopyWith<$Res> implements $SessionListResultCopyWith<$Res> {
  factory _$SessionListResultCopyWith(_SessionListResult value, $Res Function(_SessionListResult) _then) = __$SessionListResultCopyWithImpl;
@override @useResult
$Res call({
 List<SessionInfo> items, String? nextCursor
});




}
/// @nodoc
class __$SessionListResultCopyWithImpl<$Res>
    implements _$SessionListResultCopyWith<$Res> {
  __$SessionListResultCopyWithImpl(this._self, this._then);

  final _SessionListResult _self;
  final $Res Function(_SessionListResult) _then;

/// Create a copy of SessionListResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? items = null,Object? nextCursor = freezed,}) {
  return _then(_SessionListResult(
items: null == items ? _self._items : items // ignore: cast_nullable_to_non_nullable
as List<SessionInfo>,nextCursor: freezed == nextCursor ? _self.nextCursor : nextCursor // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$TurnRecord {

 int get idx; String get role; String get text;
/// Create a copy of TurnRecord
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$TurnRecordCopyWith<TurnRecord> get copyWith => _$TurnRecordCopyWithImpl<TurnRecord>(this as TurnRecord, _$identity);

  /// Serializes this TurnRecord to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as TurnRecord;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is TurnRecord&&(identical(other.idx, _this.idx) || other.idx == _this.idx)&&(identical(other.role, _this.role) || other.role == _this.role)&&(identical(other.text, _this.text) || other.text == _this.text));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as TurnRecord;
  return Object.hash(runtimeType,_this.idx,_this.role,_this.text);
}

@override
String toString() {
  final _this = this as TurnRecord;
  return 'TurnRecord(idx: ${_this.idx}, role: ${_this.role}, text: ${_this.text})';
}


}

/// @nodoc
abstract mixin class $TurnRecordCopyWith<$Res>  {
  factory $TurnRecordCopyWith(TurnRecord value, $Res Function(TurnRecord) _then) = _$TurnRecordCopyWithImpl;
@useResult
$Res call({
 int idx, String role, String text
});




}
/// @nodoc
class _$TurnRecordCopyWithImpl<$Res>
    implements $TurnRecordCopyWith<$Res> {
  _$TurnRecordCopyWithImpl(this._self, this._then);

  final TurnRecord _self;
  final $Res Function(TurnRecord) _then;

/// Create a copy of TurnRecord
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? idx = null,Object? role = null,Object? text = null,}) {
  return _then(TurnRecord(
idx: null == idx ? _self.idx : idx // ignore: cast_nullable_to_non_nullable
as int,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [TurnRecord].
extension TurnRecordPatterns on TurnRecord {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _TurnRecord value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _TurnRecord() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _TurnRecord value)  $default,){
final _that = this;
switch (_that) {
case _TurnRecord():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _TurnRecord value)?  $default,){
final _that = this;
switch (_that) {
case _TurnRecord() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int idx,  String role,  String text)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _TurnRecord() when $default != null:
return $default(_that.idx,_that.role,_that.text);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int idx,  String role,  String text)  $default,) {final _that = this;
switch (_that) {
case _TurnRecord():
return $default(_that.idx,_that.role,_that.text);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int idx,  String role,  String text)?  $default,) {final _that = this;
switch (_that) {
case _TurnRecord() when $default != null:
return $default(_that.idx,_that.role,_that.text);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _TurnRecord implements TurnRecord {
  const _TurnRecord({required this.idx, required this.role, required this.text});
  factory _TurnRecord.fromJson(Map<String, dynamic> json) => _$TurnRecordFromJson(json);

@override final  int idx;
@override final  String role;
@override final  String text;

/// Create a copy of TurnRecord
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$TurnRecordCopyWith<_TurnRecord> get copyWith => __$TurnRecordCopyWithImpl<_TurnRecord>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$TurnRecordToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _TurnRecord&&(identical(other.idx, idx) || other.idx == idx)&&(identical(other.role, role) || other.role == role)&&(identical(other.text, text) || other.text == text));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,idx,role,text);
}

@override
String toString() {
    return 'TurnRecord(idx: $idx, role: $role, text: $text)';
}


}

/// @nodoc
abstract mixin class _$TurnRecordCopyWith<$Res> implements $TurnRecordCopyWith<$Res> {
  factory _$TurnRecordCopyWith(_TurnRecord value, $Res Function(_TurnRecord) _then) = __$TurnRecordCopyWithImpl;
@override @useResult
$Res call({
 int idx, String role, String text
});




}
/// @nodoc
class __$TurnRecordCopyWithImpl<$Res>
    implements _$TurnRecordCopyWith<$Res> {
  __$TurnRecordCopyWithImpl(this._self, this._then);

  final _TurnRecord _self;
  final $Res Function(_TurnRecord) _then;

/// Create a copy of TurnRecord
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? idx = null,Object? role = null,Object? text = null,}) {
  return _then(_TurnRecord(
idx: null == idx ? _self.idx : idx // ignore: cast_nullable_to_non_nullable
as int,role: null == role ? _self.role : role // ignore: cast_nullable_to_non_nullable
as String,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$SessionDetailResult {

 SessionInfo get session; List<TurnRecord> get turns; List<Correction> get corrections;
/// Create a copy of SessionDetailResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$SessionDetailResultCopyWith<SessionDetailResult> get copyWith => _$SessionDetailResultCopyWithImpl<SessionDetailResult>(this as SessionDetailResult, _$identity);

  /// Serializes this SessionDetailResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as SessionDetailResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is SessionDetailResult&&(identical(other.session, _this.session) || other.session == _this.session)&&const DeepCollectionEquality().equals(other.turns, _this.turns)&&const DeepCollectionEquality().equals(other.corrections, _this.corrections));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as SessionDetailResult;
  return Object.hash(runtimeType,_this.session,const DeepCollectionEquality().hash(_this.turns),const DeepCollectionEquality().hash(_this.corrections));
}

@override
String toString() {
  final _this = this as SessionDetailResult;
  return 'SessionDetailResult(session: ${_this.session}, turns: ${_this.turns}, corrections: ${_this.corrections})';
}


}

/// @nodoc
abstract mixin class $SessionDetailResultCopyWith<$Res>  {
  factory $SessionDetailResultCopyWith(SessionDetailResult value, $Res Function(SessionDetailResult) _then) = _$SessionDetailResultCopyWithImpl;
@useResult
$Res call({
 SessionInfo session, List<TurnRecord> turns, List<Correction> corrections
});


$SessionInfoCopyWith<$Res> get session;

}
/// @nodoc
class _$SessionDetailResultCopyWithImpl<$Res>
    implements $SessionDetailResultCopyWith<$Res> {
  _$SessionDetailResultCopyWithImpl(this._self, this._then);

  final SessionDetailResult _self;
  final $Res Function(SessionDetailResult) _then;

/// Create a copy of SessionDetailResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? session = null,Object? turns = null,Object? corrections = null,}) {
  return _then(SessionDetailResult(
session: null == session ? _self.session : session // ignore: cast_nullable_to_non_nullable
as SessionInfo,turns: null == turns ? _self.turns : turns // ignore: cast_nullable_to_non_nullable
as List<TurnRecord>,corrections: null == corrections ? _self.corrections : corrections // ignore: cast_nullable_to_non_nullable
as List<Correction>,
  ));
}
/// Create a copy of SessionDetailResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionInfoCopyWith<$Res> get session {
  
  return $SessionInfoCopyWith<$Res>(_self.session, (value) {
    return _then(_self.copyWith(session: value));
  });
}
}


/// Adds pattern-matching-related methods to [SessionDetailResult].
extension SessionDetailResultPatterns on SessionDetailResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _SessionDetailResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _SessionDetailResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _SessionDetailResult value)  $default,){
final _that = this;
switch (_that) {
case _SessionDetailResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _SessionDetailResult value)?  $default,){
final _that = this;
switch (_that) {
case _SessionDetailResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( SessionInfo session,  List<TurnRecord> turns,  List<Correction> corrections)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _SessionDetailResult() when $default != null:
return $default(_that.session,_that.turns,_that.corrections);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( SessionInfo session,  List<TurnRecord> turns,  List<Correction> corrections)  $default,) {final _that = this;
switch (_that) {
case _SessionDetailResult():
return $default(_that.session,_that.turns,_that.corrections);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( SessionInfo session,  List<TurnRecord> turns,  List<Correction> corrections)?  $default,) {final _that = this;
switch (_that) {
case _SessionDetailResult() when $default != null:
return $default(_that.session,_that.turns,_that.corrections);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _SessionDetailResult implements SessionDetailResult {
  const _SessionDetailResult({required this.session, required  List<TurnRecord> turns, required  List<Correction> corrections}): _turns = turns,_corrections = corrections;
  factory _SessionDetailResult.fromJson(Map<String, dynamic> json) => _$SessionDetailResultFromJson(json);

@override final  SessionInfo session;
 final  List<TurnRecord> _turns;
@override List<TurnRecord> get turns {
  if (_turns is EqualUnmodifiableListView) return _turns;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_turns);
}

 final  List<Correction> _corrections;
@override List<Correction> get corrections {
  if (_corrections is EqualUnmodifiableListView) return _corrections;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_corrections);
}


/// Create a copy of SessionDetailResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$SessionDetailResultCopyWith<_SessionDetailResult> get copyWith => __$SessionDetailResultCopyWithImpl<_SessionDetailResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$SessionDetailResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _SessionDetailResult&&(identical(other.session, session) || other.session == session)&&const DeepCollectionEquality().equals(other.turns, _turns)&&const DeepCollectionEquality().equals(other.corrections, _corrections));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,session,const DeepCollectionEquality().hash(_turns),const DeepCollectionEquality().hash(_corrections));
}

@override
String toString() {
    return 'SessionDetailResult(session: $session, turns: $turns, corrections: $corrections)';
}


}

/// @nodoc
abstract mixin class _$SessionDetailResultCopyWith<$Res> implements $SessionDetailResultCopyWith<$Res> {
  factory _$SessionDetailResultCopyWith(_SessionDetailResult value, $Res Function(_SessionDetailResult) _then) = __$SessionDetailResultCopyWithImpl;
@override @useResult
$Res call({
 SessionInfo session, List<TurnRecord> turns, List<Correction> corrections
});


@override $SessionInfoCopyWith<$Res> get session;

}
/// @nodoc
class __$SessionDetailResultCopyWithImpl<$Res>
    implements _$SessionDetailResultCopyWith<$Res> {
  __$SessionDetailResultCopyWithImpl(this._self, this._then);

  final _SessionDetailResult _self;
  final $Res Function(_SessionDetailResult) _then;

/// Create a copy of SessionDetailResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? session = null,Object? turns = null,Object? corrections = null,}) {
  return _then(_SessionDetailResult(
session: null == session ? _self.session : session // ignore: cast_nullable_to_non_nullable
as SessionInfo,turns: null == turns ? _self._turns : turns // ignore: cast_nullable_to_non_nullable
as List<TurnRecord>,corrections: null == corrections ? _self._corrections : corrections // ignore: cast_nullable_to_non_nullable
as List<Correction>,
  ));
}

/// Create a copy of SessionDetailResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$SessionInfoCopyWith<$Res> get session {
  
  return $SessionInfoCopyWith<$Res>(_self.session, (value) {
    return _then(_self.copyWith(session: value));
  });
}
}


/// @nodoc
mixin _$MemoryFact {

 String get id; String get text; String get status; String? get happensOn; String? get sourceSession; String? get lastUsedAt;
/// Create a copy of MemoryFact
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MemoryFactCopyWith<MemoryFact> get copyWith => _$MemoryFactCopyWithImpl<MemoryFact>(this as MemoryFact, _$identity);

  /// Serializes this MemoryFact to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as MemoryFact;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MemoryFact&&(identical(other.id, _this.id) || other.id == _this.id)&&(identical(other.text, _this.text) || other.text == _this.text)&&(identical(other.status, _this.status) || other.status == _this.status)&&(identical(other.happensOn, _this.happensOn) || other.happensOn == _this.happensOn)&&(identical(other.sourceSession, _this.sourceSession) || other.sourceSession == _this.sourceSession)&&(identical(other.lastUsedAt, _this.lastUsedAt) || other.lastUsedAt == _this.lastUsedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as MemoryFact;
  return Object.hash(runtimeType,_this.id,_this.text,_this.status,_this.happensOn,_this.sourceSession,_this.lastUsedAt);
}

@override
String toString() {
  final _this = this as MemoryFact;
  return 'MemoryFact(id: ${_this.id}, text: ${_this.text}, status: ${_this.status}, happensOn: ${_this.happensOn}, sourceSession: ${_this.sourceSession}, lastUsedAt: ${_this.lastUsedAt})';
}


}

/// @nodoc
abstract mixin class $MemoryFactCopyWith<$Res>  {
  factory $MemoryFactCopyWith(MemoryFact value, $Res Function(MemoryFact) _then) = _$MemoryFactCopyWithImpl;
@useResult
$Res call({
 String id, String text, String status, String? happensOn, String? sourceSession, String? lastUsedAt
});




}
/// @nodoc
class _$MemoryFactCopyWithImpl<$Res>
    implements $MemoryFactCopyWith<$Res> {
  _$MemoryFactCopyWithImpl(this._self, this._then);

  final MemoryFact _self;
  final $Res Function(MemoryFact) _then;

/// Create a copy of MemoryFact
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? id = null,Object? text = null,Object? status = null,Object? happensOn = freezed,Object? sourceSession = freezed,Object? lastUsedAt = freezed,}) {
  return _then(MemoryFact(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,happensOn: freezed == happensOn ? _self.happensOn : happensOn // ignore: cast_nullable_to_non_nullable
as String?,sourceSession: freezed == sourceSession ? _self.sourceSession : sourceSession // ignore: cast_nullable_to_non_nullable
as String?,lastUsedAt: freezed == lastUsedAt ? _self.lastUsedAt : lastUsedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [MemoryFact].
extension MemoryFactPatterns on MemoryFact {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MemoryFact value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MemoryFact() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MemoryFact value)  $default,){
final _that = this;
switch (_that) {
case _MemoryFact():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MemoryFact value)?  $default,){
final _that = this;
switch (_that) {
case _MemoryFact() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String id,  String text,  String status,  String? happensOn,  String? sourceSession,  String? lastUsedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MemoryFact() when $default != null:
return $default(_that.id,_that.text,_that.status,_that.happensOn,_that.sourceSession,_that.lastUsedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String id,  String text,  String status,  String? happensOn,  String? sourceSession,  String? lastUsedAt)  $default,) {final _that = this;
switch (_that) {
case _MemoryFact():
return $default(_that.id,_that.text,_that.status,_that.happensOn,_that.sourceSession,_that.lastUsedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String id,  String text,  String status,  String? happensOn,  String? sourceSession,  String? lastUsedAt)?  $default,) {final _that = this;
switch (_that) {
case _MemoryFact() when $default != null:
return $default(_that.id,_that.text,_that.status,_that.happensOn,_that.sourceSession,_that.lastUsedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MemoryFact implements MemoryFact {
  const _MemoryFact({required this.id, required this.text, required this.status, this.happensOn, this.sourceSession, this.lastUsedAt});
  factory _MemoryFact.fromJson(Map<String, dynamic> json) => _$MemoryFactFromJson(json);

@override final  String id;
@override final  String text;
@override final  String status;
@override final  String? happensOn;
@override final  String? sourceSession;
@override final  String? lastUsedAt;

/// Create a copy of MemoryFact
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MemoryFactCopyWith<_MemoryFact> get copyWith => __$MemoryFactCopyWithImpl<_MemoryFact>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MemoryFactToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _MemoryFact&&(identical(other.id, id) || other.id == id)&&(identical(other.text, text) || other.text == text)&&(identical(other.status, status) || other.status == status)&&(identical(other.happensOn, happensOn) || other.happensOn == happensOn)&&(identical(other.sourceSession, sourceSession) || other.sourceSession == sourceSession)&&(identical(other.lastUsedAt, lastUsedAt) || other.lastUsedAt == lastUsedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,id,text,status,happensOn,sourceSession,lastUsedAt);
}

@override
String toString() {
    return 'MemoryFact(id: $id, text: $text, status: $status, happensOn: $happensOn, sourceSession: $sourceSession, lastUsedAt: $lastUsedAt)';
}


}

/// @nodoc
abstract mixin class _$MemoryFactCopyWith<$Res> implements $MemoryFactCopyWith<$Res> {
  factory _$MemoryFactCopyWith(_MemoryFact value, $Res Function(_MemoryFact) _then) = __$MemoryFactCopyWithImpl;
@override @useResult
$Res call({
 String id, String text, String status, String? happensOn, String? sourceSession, String? lastUsedAt
});




}
/// @nodoc
class __$MemoryFactCopyWithImpl<$Res>
    implements _$MemoryFactCopyWith<$Res> {
  __$MemoryFactCopyWithImpl(this._self, this._then);

  final _MemoryFact _self;
  final $Res Function(_MemoryFact) _then;

/// Create a copy of MemoryFact
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? id = null,Object? text = null,Object? status = null,Object? happensOn = freezed,Object? sourceSession = freezed,Object? lastUsedAt = freezed,}) {
  return _then(_MemoryFact(
id: null == id ? _self.id : id // ignore: cast_nullable_to_non_nullable
as String,text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,status: null == status ? _self.status : status // ignore: cast_nullable_to_non_nullable
as String,happensOn: freezed == happensOn ? _self.happensOn : happensOn // ignore: cast_nullable_to_non_nullable
as String?,sourceSession: freezed == sourceSession ? _self.sourceSession : sourceSession // ignore: cast_nullable_to_non_nullable
as String?,lastUsedAt: freezed == lastUsedAt ? _self.lastUsedAt : lastUsedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$FactsBucket {

 List<MemoryFact> get pending; List<MemoryFact> get confirmed;
/// Create a copy of FactsBucket
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$FactsBucketCopyWith<FactsBucket> get copyWith => _$FactsBucketCopyWithImpl<FactsBucket>(this as FactsBucket, _$identity);

  /// Serializes this FactsBucket to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as FactsBucket;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is FactsBucket&&const DeepCollectionEquality().equals(other.pending, _this.pending)&&const DeepCollectionEquality().equals(other.confirmed, _this.confirmed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as FactsBucket;
  return Object.hash(runtimeType,const DeepCollectionEquality().hash(_this.pending),const DeepCollectionEquality().hash(_this.confirmed));
}

@override
String toString() {
  final _this = this as FactsBucket;
  return 'FactsBucket(pending: ${_this.pending}, confirmed: ${_this.confirmed})';
}


}

/// @nodoc
abstract mixin class $FactsBucketCopyWith<$Res>  {
  factory $FactsBucketCopyWith(FactsBucket value, $Res Function(FactsBucket) _then) = _$FactsBucketCopyWithImpl;
@useResult
$Res call({
 List<MemoryFact> pending, List<MemoryFact> confirmed
});




}
/// @nodoc
class _$FactsBucketCopyWithImpl<$Res>
    implements $FactsBucketCopyWith<$Res> {
  _$FactsBucketCopyWithImpl(this._self, this._then);

  final FactsBucket _self;
  final $Res Function(FactsBucket) _then;

/// Create a copy of FactsBucket
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? pending = null,Object? confirmed = null,}) {
  return _then(FactsBucket(
pending: null == pending ? _self.pending : pending // ignore: cast_nullable_to_non_nullable
as List<MemoryFact>,confirmed: null == confirmed ? _self.confirmed : confirmed // ignore: cast_nullable_to_non_nullable
as List<MemoryFact>,
  ));
}

}


/// Adds pattern-matching-related methods to [FactsBucket].
extension FactsBucketPatterns on FactsBucket {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _FactsBucket value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _FactsBucket() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _FactsBucket value)  $default,){
final _that = this;
switch (_that) {
case _FactsBucket():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _FactsBucket value)?  $default,){
final _that = this;
switch (_that) {
case _FactsBucket() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( List<MemoryFact> pending,  List<MemoryFact> confirmed)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _FactsBucket() when $default != null:
return $default(_that.pending,_that.confirmed);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( List<MemoryFact> pending,  List<MemoryFact> confirmed)  $default,) {final _that = this;
switch (_that) {
case _FactsBucket():
return $default(_that.pending,_that.confirmed);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( List<MemoryFact> pending,  List<MemoryFact> confirmed)?  $default,) {final _that = this;
switch (_that) {
case _FactsBucket() when $default != null:
return $default(_that.pending,_that.confirmed);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _FactsBucket implements FactsBucket {
  const _FactsBucket({ List<MemoryFact> pending = const <MemoryFact>[],  List<MemoryFact> confirmed = const <MemoryFact>[]}): _pending = pending,_confirmed = confirmed;
  factory _FactsBucket.fromJson(Map<String, dynamic> json) => _$FactsBucketFromJson(json);

 final  List<MemoryFact> _pending;
@override@JsonKey() List<MemoryFact> get pending {
  if (_pending is EqualUnmodifiableListView) return _pending;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_pending);
}

 final  List<MemoryFact> _confirmed;
@override@JsonKey() List<MemoryFact> get confirmed {
  if (_confirmed is EqualUnmodifiableListView) return _confirmed;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_confirmed);
}


/// Create a copy of FactsBucket
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$FactsBucketCopyWith<_FactsBucket> get copyWith => __$FactsBucketCopyWithImpl<_FactsBucket>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$FactsBucketToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _FactsBucket&&const DeepCollectionEquality().equals(other.pending, _pending)&&const DeepCollectionEquality().equals(other.confirmed, _confirmed));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,const DeepCollectionEquality().hash(_pending),const DeepCollectionEquality().hash(_confirmed));
}

@override
String toString() {
    return 'FactsBucket(pending: $pending, confirmed: $confirmed)';
}


}

/// @nodoc
abstract mixin class _$FactsBucketCopyWith<$Res> implements $FactsBucketCopyWith<$Res> {
  factory _$FactsBucketCopyWith(_FactsBucket value, $Res Function(_FactsBucket) _then) = __$FactsBucketCopyWithImpl;
@override @useResult
$Res call({
 List<MemoryFact> pending, List<MemoryFact> confirmed
});




}
/// @nodoc
class __$FactsBucketCopyWithImpl<$Res>
    implements _$FactsBucketCopyWith<$Res> {
  __$FactsBucketCopyWithImpl(this._self, this._then);

  final _FactsBucket _self;
  final $Res Function(_FactsBucket) _then;

/// Create a copy of FactsBucket
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? pending = null,Object? confirmed = null,}) {
  return _then(_FactsBucket(
pending: null == pending ? _self._pending : pending // ignore: cast_nullable_to_non_nullable
as List<MemoryFact>,confirmed: null == confirmed ? _self._confirmed : confirmed // ignore: cast_nullable_to_non_nullable
as List<MemoryFact>,
  ));
}


}


/// @nodoc
mixin _$RecurringError {

 String get category; String get example;
/// Create a copy of RecurringError
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$RecurringErrorCopyWith<RecurringError> get copyWith => _$RecurringErrorCopyWithImpl<RecurringError>(this as RecurringError, _$identity);

  /// Serializes this RecurringError to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as RecurringError;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is RecurringError&&(identical(other.category, _this.category) || other.category == _this.category)&&(identical(other.example, _this.example) || other.example == _this.example));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as RecurringError;
  return Object.hash(runtimeType,_this.category,_this.example);
}

@override
String toString() {
  final _this = this as RecurringError;
  return 'RecurringError(category: ${_this.category}, example: ${_this.example})';
}


}

/// @nodoc
abstract mixin class $RecurringErrorCopyWith<$Res>  {
  factory $RecurringErrorCopyWith(RecurringError value, $Res Function(RecurringError) _then) = _$RecurringErrorCopyWithImpl;
@useResult
$Res call({
 String category, String example
});




}
/// @nodoc
class _$RecurringErrorCopyWithImpl<$Res>
    implements $RecurringErrorCopyWith<$Res> {
  _$RecurringErrorCopyWithImpl(this._self, this._then);

  final RecurringError _self;
  final $Res Function(RecurringError) _then;

/// Create a copy of RecurringError
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? category = null,Object? example = null,}) {
  return _then(RecurringError(
category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,example: null == example ? _self.example : example // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [RecurringError].
extension RecurringErrorPatterns on RecurringError {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _RecurringError value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _RecurringError() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _RecurringError value)  $default,){
final _that = this;
switch (_that) {
case _RecurringError():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _RecurringError value)?  $default,){
final _that = this;
switch (_that) {
case _RecurringError() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String category,  String example)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _RecurringError() when $default != null:
return $default(_that.category,_that.example);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String category,  String example)  $default,) {final _that = this;
switch (_that) {
case _RecurringError():
return $default(_that.category,_that.example);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String category,  String example)?  $default,) {final _that = this;
switch (_that) {
case _RecurringError() when $default != null:
return $default(_that.category,_that.example);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _RecurringError implements RecurringError {
  const _RecurringError({required this.category, required this.example});
  factory _RecurringError.fromJson(Map<String, dynamic> json) => _$RecurringErrorFromJson(json);

@override final  String category;
@override final  String example;

/// Create a copy of RecurringError
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$RecurringErrorCopyWith<_RecurringError> get copyWith => __$RecurringErrorCopyWithImpl<_RecurringError>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$RecurringErrorToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _RecurringError&&(identical(other.category, category) || other.category == category)&&(identical(other.example, example) || other.example == example));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,category,example);
}

@override
String toString() {
    return 'RecurringError(category: $category, example: $example)';
}


}

/// @nodoc
abstract mixin class _$RecurringErrorCopyWith<$Res> implements $RecurringErrorCopyWith<$Res> {
  factory _$RecurringErrorCopyWith(_RecurringError value, $Res Function(_RecurringError) _then) = __$RecurringErrorCopyWithImpl;
@override @useResult
$Res call({
 String category, String example
});




}
/// @nodoc
class __$RecurringErrorCopyWithImpl<$Res>
    implements _$RecurringErrorCopyWith<$Res> {
  __$RecurringErrorCopyWithImpl(this._self, this._then);

  final _RecurringError _self;
  final $Res Function(_RecurringError) _then;

/// Create a copy of RecurringError
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? category = null,Object? example = null,}) {
  return _then(_RecurringError(
category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,example: null == example ? _self.example : example // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$CoachingBrief {

 String get text; String? get levelHint; List<RecurringError> get recurringErrors; String? get updatedAt;
/// Create a copy of CoachingBrief
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CoachingBriefCopyWith<CoachingBrief> get copyWith => _$CoachingBriefCopyWithImpl<CoachingBrief>(this as CoachingBrief, _$identity);

  /// Serializes this CoachingBrief to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as CoachingBrief;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CoachingBrief&&(identical(other.text, _this.text) || other.text == _this.text)&&(identical(other.levelHint, _this.levelHint) || other.levelHint == _this.levelHint)&&const DeepCollectionEquality().equals(other.recurringErrors, _this.recurringErrors)&&(identical(other.updatedAt, _this.updatedAt) || other.updatedAt == _this.updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as CoachingBrief;
  return Object.hash(runtimeType,_this.text,_this.levelHint,const DeepCollectionEquality().hash(_this.recurringErrors),_this.updatedAt);
}

@override
String toString() {
  final _this = this as CoachingBrief;
  return 'CoachingBrief(text: ${_this.text}, levelHint: ${_this.levelHint}, recurringErrors: ${_this.recurringErrors}, updatedAt: ${_this.updatedAt})';
}


}

/// @nodoc
abstract mixin class $CoachingBriefCopyWith<$Res>  {
  factory $CoachingBriefCopyWith(CoachingBrief value, $Res Function(CoachingBrief) _then) = _$CoachingBriefCopyWithImpl;
@useResult
$Res call({
 String text, String? levelHint, List<RecurringError> recurringErrors, String? updatedAt
});




}
/// @nodoc
class _$CoachingBriefCopyWithImpl<$Res>
    implements $CoachingBriefCopyWith<$Res> {
  _$CoachingBriefCopyWithImpl(this._self, this._then);

  final CoachingBrief _self;
  final $Res Function(CoachingBrief) _then;

/// Create a copy of CoachingBrief
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? text = null,Object? levelHint = freezed,Object? recurringErrors = null,Object? updatedAt = freezed,}) {
  return _then(CoachingBrief(
text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,levelHint: freezed == levelHint ? _self.levelHint : levelHint // ignore: cast_nullable_to_non_nullable
as String?,recurringErrors: null == recurringErrors ? _self.recurringErrors : recurringErrors // ignore: cast_nullable_to_non_nullable
as List<RecurringError>,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}

}


/// Adds pattern-matching-related methods to [CoachingBrief].
extension CoachingBriefPatterns on CoachingBrief {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CoachingBrief value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CoachingBrief() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CoachingBrief value)  $default,){
final _that = this;
switch (_that) {
case _CoachingBrief():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CoachingBrief value)?  $default,){
final _that = this;
switch (_that) {
case _CoachingBrief() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String text,  String? levelHint,  List<RecurringError> recurringErrors,  String? updatedAt)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CoachingBrief() when $default != null:
return $default(_that.text,_that.levelHint,_that.recurringErrors,_that.updatedAt);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String text,  String? levelHint,  List<RecurringError> recurringErrors,  String? updatedAt)  $default,) {final _that = this;
switch (_that) {
case _CoachingBrief():
return $default(_that.text,_that.levelHint,_that.recurringErrors,_that.updatedAt);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String text,  String? levelHint,  List<RecurringError> recurringErrors,  String? updatedAt)?  $default,) {final _that = this;
switch (_that) {
case _CoachingBrief() when $default != null:
return $default(_that.text,_that.levelHint,_that.recurringErrors,_that.updatedAt);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CoachingBrief implements CoachingBrief {
  const _CoachingBrief({required this.text, this.levelHint,  List<RecurringError> recurringErrors = const <RecurringError>[], this.updatedAt}): _recurringErrors = recurringErrors;
  factory _CoachingBrief.fromJson(Map<String, dynamic> json) => _$CoachingBriefFromJson(json);

@override final  String text;
@override final  String? levelHint;
 final  List<RecurringError> _recurringErrors;
@override@JsonKey() List<RecurringError> get recurringErrors {
  if (_recurringErrors is EqualUnmodifiableListView) return _recurringErrors;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_recurringErrors);
}

@override final  String? updatedAt;

/// Create a copy of CoachingBrief
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CoachingBriefCopyWith<_CoachingBrief> get copyWith => __$CoachingBriefCopyWithImpl<_CoachingBrief>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CoachingBriefToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _CoachingBrief&&(identical(other.text, text) || other.text == text)&&(identical(other.levelHint, levelHint) || other.levelHint == levelHint)&&const DeepCollectionEquality().equals(other.recurringErrors, _recurringErrors)&&(identical(other.updatedAt, updatedAt) || other.updatedAt == updatedAt));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,text,levelHint,const DeepCollectionEquality().hash(_recurringErrors),updatedAt);
}

@override
String toString() {
    return 'CoachingBrief(text: $text, levelHint: $levelHint, recurringErrors: $recurringErrors, updatedAt: $updatedAt)';
}


}

/// @nodoc
abstract mixin class _$CoachingBriefCopyWith<$Res> implements $CoachingBriefCopyWith<$Res> {
  factory _$CoachingBriefCopyWith(_CoachingBrief value, $Res Function(_CoachingBrief) _then) = __$CoachingBriefCopyWithImpl;
@override @useResult
$Res call({
 String text, String? levelHint, List<RecurringError> recurringErrors, String? updatedAt
});




}
/// @nodoc
class __$CoachingBriefCopyWithImpl<$Res>
    implements _$CoachingBriefCopyWith<$Res> {
  __$CoachingBriefCopyWithImpl(this._self, this._then);

  final _CoachingBrief _self;
  final $Res Function(_CoachingBrief) _then;

/// Create a copy of CoachingBrief
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? text = null,Object? levelHint = freezed,Object? recurringErrors = null,Object? updatedAt = freezed,}) {
  return _then(_CoachingBrief(
text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,levelHint: freezed == levelHint ? _self.levelHint : levelHint // ignore: cast_nullable_to_non_nullable
as String?,recurringErrors: null == recurringErrors ? _self._recurringErrors : recurringErrors // ignore: cast_nullable_to_non_nullable
as List<RecurringError>,updatedAt: freezed == updatedAt ? _self.updatedAt : updatedAt // ignore: cast_nullable_to_non_nullable
as String?,
  ));
}


}


/// @nodoc
mixin _$MemoryResult {

 FactsBucket get facts; CoachingBrief get brief;
/// Create a copy of MemoryResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$MemoryResultCopyWith<MemoryResult> get copyWith => _$MemoryResultCopyWithImpl<MemoryResult>(this as MemoryResult, _$identity);

  /// Serializes this MemoryResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as MemoryResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is MemoryResult&&(identical(other.facts, _this.facts) || other.facts == _this.facts)&&(identical(other.brief, _this.brief) || other.brief == _this.brief));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as MemoryResult;
  return Object.hash(runtimeType,_this.facts,_this.brief);
}

@override
String toString() {
  final _this = this as MemoryResult;
  return 'MemoryResult(facts: ${_this.facts}, brief: ${_this.brief})';
}


}

/// @nodoc
abstract mixin class $MemoryResultCopyWith<$Res>  {
  factory $MemoryResultCopyWith(MemoryResult value, $Res Function(MemoryResult) _then) = _$MemoryResultCopyWithImpl;
@useResult
$Res call({
 FactsBucket facts, CoachingBrief brief
});


$FactsBucketCopyWith<$Res> get facts;$CoachingBriefCopyWith<$Res> get brief;

}
/// @nodoc
class _$MemoryResultCopyWithImpl<$Res>
    implements $MemoryResultCopyWith<$Res> {
  _$MemoryResultCopyWithImpl(this._self, this._then);

  final MemoryResult _self;
  final $Res Function(MemoryResult) _then;

/// Create a copy of MemoryResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? facts = null,Object? brief = null,}) {
  return _then(MemoryResult(
facts: null == facts ? _self.facts : facts // ignore: cast_nullable_to_non_nullable
as FactsBucket,brief: null == brief ? _self.brief : brief // ignore: cast_nullable_to_non_nullable
as CoachingBrief,
  ));
}
/// Create a copy of MemoryResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FactsBucketCopyWith<$Res> get facts {
  
  return $FactsBucketCopyWith<$Res>(_self.facts, (value) {
    return _then(_self.copyWith(facts: value));
  });
}/// Create a copy of MemoryResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CoachingBriefCopyWith<$Res> get brief {
  
  return $CoachingBriefCopyWith<$Res>(_self.brief, (value) {
    return _then(_self.copyWith(brief: value));
  });
}
}


/// Adds pattern-matching-related methods to [MemoryResult].
extension MemoryResultPatterns on MemoryResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _MemoryResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _MemoryResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _MemoryResult value)  $default,){
final _that = this;
switch (_that) {
case _MemoryResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _MemoryResult value)?  $default,){
final _that = this;
switch (_that) {
case _MemoryResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( FactsBucket facts,  CoachingBrief brief)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _MemoryResult() when $default != null:
return $default(_that.facts,_that.brief);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( FactsBucket facts,  CoachingBrief brief)  $default,) {final _that = this;
switch (_that) {
case _MemoryResult():
return $default(_that.facts,_that.brief);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( FactsBucket facts,  CoachingBrief brief)?  $default,) {final _that = this;
switch (_that) {
case _MemoryResult() when $default != null:
return $default(_that.facts,_that.brief);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _MemoryResult implements MemoryResult {
  const _MemoryResult({required this.facts, required this.brief});
  factory _MemoryResult.fromJson(Map<String, dynamic> json) => _$MemoryResultFromJson(json);

@override final  FactsBucket facts;
@override final  CoachingBrief brief;

/// Create a copy of MemoryResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$MemoryResultCopyWith<_MemoryResult> get copyWith => __$MemoryResultCopyWithImpl<_MemoryResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$MemoryResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _MemoryResult&&(identical(other.facts, facts) || other.facts == facts)&&(identical(other.brief, brief) || other.brief == brief));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,facts,brief);
}

@override
String toString() {
    return 'MemoryResult(facts: $facts, brief: $brief)';
}


}

/// @nodoc
abstract mixin class _$MemoryResultCopyWith<$Res> implements $MemoryResultCopyWith<$Res> {
  factory _$MemoryResultCopyWith(_MemoryResult value, $Res Function(_MemoryResult) _then) = __$MemoryResultCopyWithImpl;
@override @useResult
$Res call({
 FactsBucket facts, CoachingBrief brief
});


@override $FactsBucketCopyWith<$Res> get facts;@override $CoachingBriefCopyWith<$Res> get brief;

}
/// @nodoc
class __$MemoryResultCopyWithImpl<$Res>
    implements _$MemoryResultCopyWith<$Res> {
  __$MemoryResultCopyWithImpl(this._self, this._then);

  final _MemoryResult _self;
  final $Res Function(_MemoryResult) _then;

/// Create a copy of MemoryResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? facts = null,Object? brief = null,}) {
  return _then(_MemoryResult(
facts: null == facts ? _self.facts : facts // ignore: cast_nullable_to_non_nullable
as FactsBucket,brief: null == brief ? _self.brief : brief // ignore: cast_nullable_to_non_nullable
as CoachingBrief,
  ));
}

/// Create a copy of MemoryResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$FactsBucketCopyWith<$Res> get facts {
  
  return $FactsBucketCopyWith<$Res>(_self.facts, (value) {
    return _then(_self.copyWith(facts: value));
  });
}/// Create a copy of MemoryResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$CoachingBriefCopyWith<$Res> get brief {
  
  return $CoachingBriefCopyWith<$Res>(_self.brief, (value) {
    return _then(_self.copyWith(brief: value));
  });
}
}


/// @nodoc
mixin _$LevelInfo {

 String get name; int get min; int? get next;
/// Create a copy of LevelInfo
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$LevelInfoCopyWith<LevelInfo> get copyWith => _$LevelInfoCopyWithImpl<LevelInfo>(this as LevelInfo, _$identity);

  /// Serializes this LevelInfo to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as LevelInfo;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is LevelInfo&&(identical(other.name, _this.name) || other.name == _this.name)&&(identical(other.min, _this.min) || other.min == _this.min)&&(identical(other.next, _this.next) || other.next == _this.next));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as LevelInfo;
  return Object.hash(runtimeType,_this.name,_this.min,_this.next);
}

@override
String toString() {
  final _this = this as LevelInfo;
  return 'LevelInfo(name: ${_this.name}, min: ${_this.min}, next: ${_this.next})';
}


}

/// @nodoc
abstract mixin class $LevelInfoCopyWith<$Res>  {
  factory $LevelInfoCopyWith(LevelInfo value, $Res Function(LevelInfo) _then) = _$LevelInfoCopyWithImpl;
@useResult
$Res call({
 String name, int min, int? next
});




}
/// @nodoc
class _$LevelInfoCopyWithImpl<$Res>
    implements $LevelInfoCopyWith<$Res> {
  _$LevelInfoCopyWithImpl(this._self, this._then);

  final LevelInfo _self;
  final $Res Function(LevelInfo) _then;

/// Create a copy of LevelInfo
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? name = null,Object? min = null,Object? next = freezed,}) {
  return _then(LevelInfo(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,min: null == min ? _self.min : min // ignore: cast_nullable_to_non_nullable
as int,next: freezed == next ? _self.next : next // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}

}


/// Adds pattern-matching-related methods to [LevelInfo].
extension LevelInfoPatterns on LevelInfo {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _LevelInfo value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _LevelInfo() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _LevelInfo value)  $default,){
final _that = this;
switch (_that) {
case _LevelInfo():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _LevelInfo value)?  $default,){
final _that = this;
switch (_that) {
case _LevelInfo() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String name,  int min,  int? next)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _LevelInfo() when $default != null:
return $default(_that.name,_that.min,_that.next);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String name,  int min,  int? next)  $default,) {final _that = this;
switch (_that) {
case _LevelInfo():
return $default(_that.name,_that.min,_that.next);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String name,  int min,  int? next)?  $default,) {final _that = this;
switch (_that) {
case _LevelInfo() when $default != null:
return $default(_that.name,_that.min,_that.next);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _LevelInfo implements LevelInfo {
  const _LevelInfo({required this.name, required this.min, this.next});
  factory _LevelInfo.fromJson(Map<String, dynamic> json) => _$LevelInfoFromJson(json);

@override final  String name;
@override final  int min;
@override final  int? next;

/// Create a copy of LevelInfo
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$LevelInfoCopyWith<_LevelInfo> get copyWith => __$LevelInfoCopyWithImpl<_LevelInfo>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$LevelInfoToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _LevelInfo&&(identical(other.name, name) || other.name == name)&&(identical(other.min, min) || other.min == min)&&(identical(other.next, next) || other.next == next));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,name,min,next);
}

@override
String toString() {
    return 'LevelInfo(name: $name, min: $min, next: $next)';
}


}

/// @nodoc
abstract mixin class _$LevelInfoCopyWith<$Res> implements $LevelInfoCopyWith<$Res> {
  factory _$LevelInfoCopyWith(_LevelInfo value, $Res Function(_LevelInfo) _then) = __$LevelInfoCopyWithImpl;
@override @useResult
$Res call({
 String name, int min, int? next
});




}
/// @nodoc
class __$LevelInfoCopyWithImpl<$Res>
    implements _$LevelInfoCopyWith<$Res> {
  __$LevelInfoCopyWithImpl(this._self, this._then);

  final _LevelInfo _self;
  final $Res Function(_LevelInfo) _then;

/// Create a copy of LevelInfo
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? name = null,Object? min = null,Object? next = freezed,}) {
  return _then(_LevelInfo(
name: null == name ? _self.name : name // ignore: cast_nullable_to_non_nullable
as String,min: null == min ? _self.min : min // ignore: cast_nullable_to_non_nullable
as int,next: freezed == next ? _self.next : next // ignore: cast_nullable_to_non_nullable
as int?,
  ));
}


}


/// @nodoc
mixin _$CorrectionTrendItem {

 String get category; int get count30d; int get count7d;
/// Create a copy of CorrectionTrendItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$CorrectionTrendItemCopyWith<CorrectionTrendItem> get copyWith => _$CorrectionTrendItemCopyWithImpl<CorrectionTrendItem>(this as CorrectionTrendItem, _$identity);

  /// Serializes this CorrectionTrendItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as CorrectionTrendItem;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is CorrectionTrendItem&&(identical(other.category, _this.category) || other.category == _this.category)&&(identical(other.count30d, _this.count30d) || other.count30d == _this.count30d)&&(identical(other.count7d, _this.count7d) || other.count7d == _this.count7d));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as CorrectionTrendItem;
  return Object.hash(runtimeType,_this.category,_this.count30d,_this.count7d);
}

@override
String toString() {
  final _this = this as CorrectionTrendItem;
  return 'CorrectionTrendItem(category: ${_this.category}, count30d: ${_this.count30d}, count7d: ${_this.count7d})';
}


}

/// @nodoc
abstract mixin class $CorrectionTrendItemCopyWith<$Res>  {
  factory $CorrectionTrendItemCopyWith(CorrectionTrendItem value, $Res Function(CorrectionTrendItem) _then) = _$CorrectionTrendItemCopyWithImpl;
@useResult
$Res call({
 String category, int count30d, int count7d
});




}
/// @nodoc
class _$CorrectionTrendItemCopyWithImpl<$Res>
    implements $CorrectionTrendItemCopyWith<$Res> {
  _$CorrectionTrendItemCopyWithImpl(this._self, this._then);

  final CorrectionTrendItem _self;
  final $Res Function(CorrectionTrendItem) _then;

/// Create a copy of CorrectionTrendItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? category = null,Object? count30d = null,Object? count7d = null,}) {
  return _then(CorrectionTrendItem(
category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,count30d: null == count30d ? _self.count30d : count30d // ignore: cast_nullable_to_non_nullable
as int,count7d: null == count7d ? _self.count7d : count7d // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [CorrectionTrendItem].
extension CorrectionTrendItemPatterns on CorrectionTrendItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _CorrectionTrendItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _CorrectionTrendItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _CorrectionTrendItem value)  $default,){
final _that = this;
switch (_that) {
case _CorrectionTrendItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _CorrectionTrendItem value)?  $default,){
final _that = this;
switch (_that) {
case _CorrectionTrendItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String category,  int count30d,  int count7d)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _CorrectionTrendItem() when $default != null:
return $default(_that.category,_that.count30d,_that.count7d);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String category,  int count30d,  int count7d)  $default,) {final _that = this;
switch (_that) {
case _CorrectionTrendItem():
return $default(_that.category,_that.count30d,_that.count7d);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String category,  int count30d,  int count7d)?  $default,) {final _that = this;
switch (_that) {
case _CorrectionTrendItem() when $default != null:
return $default(_that.category,_that.count30d,_that.count7d);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _CorrectionTrendItem implements CorrectionTrendItem {
  const _CorrectionTrendItem({required this.category, required this.count30d, required this.count7d});
  factory _CorrectionTrendItem.fromJson(Map<String, dynamic> json) => _$CorrectionTrendItemFromJson(json);

@override final  String category;
@override final  int count30d;
@override final  int count7d;

/// Create a copy of CorrectionTrendItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$CorrectionTrendItemCopyWith<_CorrectionTrendItem> get copyWith => __$CorrectionTrendItemCopyWithImpl<_CorrectionTrendItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$CorrectionTrendItemToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _CorrectionTrendItem&&(identical(other.category, category) || other.category == category)&&(identical(other.count30d, count30d) || other.count30d == count30d)&&(identical(other.count7d, count7d) || other.count7d == count7d));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,category,count30d,count7d);
}

@override
String toString() {
    return 'CorrectionTrendItem(category: $category, count30d: $count30d, count7d: $count7d)';
}


}

/// @nodoc
abstract mixin class _$CorrectionTrendItemCopyWith<$Res> implements $CorrectionTrendItemCopyWith<$Res> {
  factory _$CorrectionTrendItemCopyWith(_CorrectionTrendItem value, $Res Function(_CorrectionTrendItem) _then) = __$CorrectionTrendItemCopyWithImpl;
@override @useResult
$Res call({
 String category, int count30d, int count7d
});




}
/// @nodoc
class __$CorrectionTrendItemCopyWithImpl<$Res>
    implements _$CorrectionTrendItemCopyWith<$Res> {
  __$CorrectionTrendItemCopyWithImpl(this._self, this._then);

  final _CorrectionTrendItem _self;
  final $Res Function(_CorrectionTrendItem) _then;

/// Create a copy of CorrectionTrendItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? category = null,Object? count30d = null,Object? count7d = null,}) {
  return _then(_CorrectionTrendItem(
category: null == category ? _self.category : category // ignore: cast_nullable_to_non_nullable
as String,count30d: null == count30d ? _self.count30d : count30d // ignore: cast_nullable_to_non_nullable
as int,count7d: null == count7d ? _self.count7d : count7d // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$ProgressResult {

 int get xp; LevelInfo get level; int get streak; int get longestStreak; int get sessionsThisWeek; List<CorrectionTrendItem> get correctionsTrend;
/// Create a copy of ProgressResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ProgressResultCopyWith<ProgressResult> get copyWith => _$ProgressResultCopyWithImpl<ProgressResult>(this as ProgressResult, _$identity);

  /// Serializes this ProgressResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ProgressResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ProgressResult&&(identical(other.xp, _this.xp) || other.xp == _this.xp)&&(identical(other.level, _this.level) || other.level == _this.level)&&(identical(other.streak, _this.streak) || other.streak == _this.streak)&&(identical(other.longestStreak, _this.longestStreak) || other.longestStreak == _this.longestStreak)&&(identical(other.sessionsThisWeek, _this.sessionsThisWeek) || other.sessionsThisWeek == _this.sessionsThisWeek)&&const DeepCollectionEquality().equals(other.correctionsTrend, _this.correctionsTrend));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ProgressResult;
  return Object.hash(runtimeType,_this.xp,_this.level,_this.streak,_this.longestStreak,_this.sessionsThisWeek,const DeepCollectionEquality().hash(_this.correctionsTrend));
}

@override
String toString() {
  final _this = this as ProgressResult;
  return 'ProgressResult(xp: ${_this.xp}, level: ${_this.level}, streak: ${_this.streak}, longestStreak: ${_this.longestStreak}, sessionsThisWeek: ${_this.sessionsThisWeek}, correctionsTrend: ${_this.correctionsTrend})';
}


}

/// @nodoc
abstract mixin class $ProgressResultCopyWith<$Res>  {
  factory $ProgressResultCopyWith(ProgressResult value, $Res Function(ProgressResult) _then) = _$ProgressResultCopyWithImpl;
@useResult
$Res call({
 int xp, LevelInfo level, int streak, int longestStreak, int sessionsThisWeek, List<CorrectionTrendItem> correctionsTrend
});


$LevelInfoCopyWith<$Res> get level;

}
/// @nodoc
class _$ProgressResultCopyWithImpl<$Res>
    implements $ProgressResultCopyWith<$Res> {
  _$ProgressResultCopyWithImpl(this._self, this._then);

  final ProgressResult _self;
  final $Res Function(ProgressResult) _then;

/// Create a copy of ProgressResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? xp = null,Object? level = null,Object? streak = null,Object? longestStreak = null,Object? sessionsThisWeek = null,Object? correctionsTrend = null,}) {
  return _then(ProgressResult(
xp: null == xp ? _self.xp : xp // ignore: cast_nullable_to_non_nullable
as int,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as LevelInfo,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,longestStreak: null == longestStreak ? _self.longestStreak : longestStreak // ignore: cast_nullable_to_non_nullable
as int,sessionsThisWeek: null == sessionsThisWeek ? _self.sessionsThisWeek : sessionsThisWeek // ignore: cast_nullable_to_non_nullable
as int,correctionsTrend: null == correctionsTrend ? _self.correctionsTrend : correctionsTrend // ignore: cast_nullable_to_non_nullable
as List<CorrectionTrendItem>,
  ));
}
/// Create a copy of ProgressResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$LevelInfoCopyWith<$Res> get level {
  
  return $LevelInfoCopyWith<$Res>(_self.level, (value) {
    return _then(_self.copyWith(level: value));
  });
}
}


/// Adds pattern-matching-related methods to [ProgressResult].
extension ProgressResultPatterns on ProgressResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ProgressResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ProgressResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ProgressResult value)  $default,){
final _that = this;
switch (_that) {
case _ProgressResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ProgressResult value)?  $default,){
final _that = this;
switch (_that) {
case _ProgressResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( int xp,  LevelInfo level,  int streak,  int longestStreak,  int sessionsThisWeek,  List<CorrectionTrendItem> correctionsTrend)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ProgressResult() when $default != null:
return $default(_that.xp,_that.level,_that.streak,_that.longestStreak,_that.sessionsThisWeek,_that.correctionsTrend);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( int xp,  LevelInfo level,  int streak,  int longestStreak,  int sessionsThisWeek,  List<CorrectionTrendItem> correctionsTrend)  $default,) {final _that = this;
switch (_that) {
case _ProgressResult():
return $default(_that.xp,_that.level,_that.streak,_that.longestStreak,_that.sessionsThisWeek,_that.correctionsTrend);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( int xp,  LevelInfo level,  int streak,  int longestStreak,  int sessionsThisWeek,  List<CorrectionTrendItem> correctionsTrend)?  $default,) {final _that = this;
switch (_that) {
case _ProgressResult() when $default != null:
return $default(_that.xp,_that.level,_that.streak,_that.longestStreak,_that.sessionsThisWeek,_that.correctionsTrend);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ProgressResult implements ProgressResult {
  const _ProgressResult({required this.xp, required this.level, required this.streak, required this.longestStreak, required this.sessionsThisWeek,  List<CorrectionTrendItem> correctionsTrend = const <CorrectionTrendItem>[]}): _correctionsTrend = correctionsTrend;
  factory _ProgressResult.fromJson(Map<String, dynamic> json) => _$ProgressResultFromJson(json);

@override final  int xp;
@override final  LevelInfo level;
@override final  int streak;
@override final  int longestStreak;
@override final  int sessionsThisWeek;
 final  List<CorrectionTrendItem> _correctionsTrend;
@override@JsonKey() List<CorrectionTrendItem> get correctionsTrend {
  if (_correctionsTrend is EqualUnmodifiableListView) return _correctionsTrend;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_correctionsTrend);
}


/// Create a copy of ProgressResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ProgressResultCopyWith<_ProgressResult> get copyWith => __$ProgressResultCopyWithImpl<_ProgressResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ProgressResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ProgressResult&&(identical(other.xp, xp) || other.xp == xp)&&(identical(other.level, level) || other.level == level)&&(identical(other.streak, streak) || other.streak == streak)&&(identical(other.longestStreak, longestStreak) || other.longestStreak == longestStreak)&&(identical(other.sessionsThisWeek, sessionsThisWeek) || other.sessionsThisWeek == sessionsThisWeek)&&const DeepCollectionEquality().equals(other.correctionsTrend, _correctionsTrend));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,xp,level,streak,longestStreak,sessionsThisWeek,const DeepCollectionEquality().hash(_correctionsTrend));
}

@override
String toString() {
    return 'ProgressResult(xp: $xp, level: $level, streak: $streak, longestStreak: $longestStreak, sessionsThisWeek: $sessionsThisWeek, correctionsTrend: $correctionsTrend)';
}


}

/// @nodoc
abstract mixin class _$ProgressResultCopyWith<$Res> implements $ProgressResultCopyWith<$Res> {
  factory _$ProgressResultCopyWith(_ProgressResult value, $Res Function(_ProgressResult) _then) = __$ProgressResultCopyWithImpl;
@override @useResult
$Res call({
 int xp, LevelInfo level, int streak, int longestStreak, int sessionsThisWeek, List<CorrectionTrendItem> correctionsTrend
});


@override $LevelInfoCopyWith<$Res> get level;

}
/// @nodoc
class __$ProgressResultCopyWithImpl<$Res>
    implements _$ProgressResultCopyWith<$Res> {
  __$ProgressResultCopyWithImpl(this._self, this._then);

  final _ProgressResult _self;
  final $Res Function(_ProgressResult) _then;

/// Create a copy of ProgressResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? xp = null,Object? level = null,Object? streak = null,Object? longestStreak = null,Object? sessionsThisWeek = null,Object? correctionsTrend = null,}) {
  return _then(_ProgressResult(
xp: null == xp ? _self.xp : xp // ignore: cast_nullable_to_non_nullable
as int,level: null == level ? _self.level : level // ignore: cast_nullable_to_non_nullable
as LevelInfo,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,longestStreak: null == longestStreak ? _self.longestStreak : longestStreak // ignore: cast_nullable_to_non_nullable
as int,sessionsThisWeek: null == sessionsThisWeek ? _self.sessionsThisWeek : sessionsThisWeek // ignore: cast_nullable_to_non_nullable
as int,correctionsTrend: null == correctionsTrend ? _self._correctionsTrend : correctionsTrend // ignore: cast_nullable_to_non_nullable
as List<CorrectionTrendItem>,
  ));
}

/// Create a copy of ProgressResult
/// with the given fields replaced by the non-null parameter values.
@override
@pragma('vm:prefer-inline')
$LevelInfoCopyWith<$Res> get level {
  
  return $LevelInfoCopyWith<$Res>(_self.level, (value) {
    return _then(_self.copyWith(level: value));
  });
}
}


/// @nodoc
mixin _$LeaderboardRow {

 String get userId; String get displayName; int get xpWeek; int get sessionsWeek; int get streak;
/// Create a copy of LeaderboardRow
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$LeaderboardRowCopyWith<LeaderboardRow> get copyWith => _$LeaderboardRowCopyWithImpl<LeaderboardRow>(this as LeaderboardRow, _$identity);

  /// Serializes this LeaderboardRow to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as LeaderboardRow;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is LeaderboardRow&&(identical(other.userId, _this.userId) || other.userId == _this.userId)&&(identical(other.displayName, _this.displayName) || other.displayName == _this.displayName)&&(identical(other.xpWeek, _this.xpWeek) || other.xpWeek == _this.xpWeek)&&(identical(other.sessionsWeek, _this.sessionsWeek) || other.sessionsWeek == _this.sessionsWeek)&&(identical(other.streak, _this.streak) || other.streak == _this.streak));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as LeaderboardRow;
  return Object.hash(runtimeType,_this.userId,_this.displayName,_this.xpWeek,_this.sessionsWeek,_this.streak);
}

@override
String toString() {
  final _this = this as LeaderboardRow;
  return 'LeaderboardRow(userId: ${_this.userId}, displayName: ${_this.displayName}, xpWeek: ${_this.xpWeek}, sessionsWeek: ${_this.sessionsWeek}, streak: ${_this.streak})';
}


}

/// @nodoc
abstract mixin class $LeaderboardRowCopyWith<$Res>  {
  factory $LeaderboardRowCopyWith(LeaderboardRow value, $Res Function(LeaderboardRow) _then) = _$LeaderboardRowCopyWithImpl;
@useResult
$Res call({
 String userId, String displayName, int xpWeek, int sessionsWeek, int streak
});




}
/// @nodoc
class _$LeaderboardRowCopyWithImpl<$Res>
    implements $LeaderboardRowCopyWith<$Res> {
  _$LeaderboardRowCopyWithImpl(this._self, this._then);

  final LeaderboardRow _self;
  final $Res Function(LeaderboardRow) _then;

/// Create a copy of LeaderboardRow
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? userId = null,Object? displayName = null,Object? xpWeek = null,Object? sessionsWeek = null,Object? streak = null,}) {
  return _then(LeaderboardRow(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,xpWeek: null == xpWeek ? _self.xpWeek : xpWeek // ignore: cast_nullable_to_non_nullable
as int,sessionsWeek: null == sessionsWeek ? _self.sessionsWeek : sessionsWeek // ignore: cast_nullable_to_non_nullable
as int,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [LeaderboardRow].
extension LeaderboardRowPatterns on LeaderboardRow {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _LeaderboardRow value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _LeaderboardRow() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _LeaderboardRow value)  $default,){
final _that = this;
switch (_that) {
case _LeaderboardRow():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _LeaderboardRow value)?  $default,){
final _that = this;
switch (_that) {
case _LeaderboardRow() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String userId,  String displayName,  int xpWeek,  int sessionsWeek,  int streak)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _LeaderboardRow() when $default != null:
return $default(_that.userId,_that.displayName,_that.xpWeek,_that.sessionsWeek,_that.streak);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String userId,  String displayName,  int xpWeek,  int sessionsWeek,  int streak)  $default,) {final _that = this;
switch (_that) {
case _LeaderboardRow():
return $default(_that.userId,_that.displayName,_that.xpWeek,_that.sessionsWeek,_that.streak);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String userId,  String displayName,  int xpWeek,  int sessionsWeek,  int streak)?  $default,) {final _that = this;
switch (_that) {
case _LeaderboardRow() when $default != null:
return $default(_that.userId,_that.displayName,_that.xpWeek,_that.sessionsWeek,_that.streak);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _LeaderboardRow implements LeaderboardRow {
  const _LeaderboardRow({required this.userId, required this.displayName, required this.xpWeek, required this.sessionsWeek, required this.streak});
  factory _LeaderboardRow.fromJson(Map<String, dynamic> json) => _$LeaderboardRowFromJson(json);

@override final  String userId;
@override final  String displayName;
@override final  int xpWeek;
@override final  int sessionsWeek;
@override final  int streak;

/// Create a copy of LeaderboardRow
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$LeaderboardRowCopyWith<_LeaderboardRow> get copyWith => __$LeaderboardRowCopyWithImpl<_LeaderboardRow>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$LeaderboardRowToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _LeaderboardRow&&(identical(other.userId, userId) || other.userId == userId)&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.xpWeek, xpWeek) || other.xpWeek == xpWeek)&&(identical(other.sessionsWeek, sessionsWeek) || other.sessionsWeek == sessionsWeek)&&(identical(other.streak, streak) || other.streak == streak));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,userId,displayName,xpWeek,sessionsWeek,streak);
}

@override
String toString() {
    return 'LeaderboardRow(userId: $userId, displayName: $displayName, xpWeek: $xpWeek, sessionsWeek: $sessionsWeek, streak: $streak)';
}


}

/// @nodoc
abstract mixin class _$LeaderboardRowCopyWith<$Res> implements $LeaderboardRowCopyWith<$Res> {
  factory _$LeaderboardRowCopyWith(_LeaderboardRow value, $Res Function(_LeaderboardRow) _then) = __$LeaderboardRowCopyWithImpl;
@override @useResult
$Res call({
 String userId, String displayName, int xpWeek, int sessionsWeek, int streak
});




}
/// @nodoc
class __$LeaderboardRowCopyWithImpl<$Res>
    implements _$LeaderboardRowCopyWith<$Res> {
  __$LeaderboardRowCopyWithImpl(this._self, this._then);

  final _LeaderboardRow _self;
  final $Res Function(_LeaderboardRow) _then;

/// Create a copy of LeaderboardRow
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? userId = null,Object? displayName = null,Object? xpWeek = null,Object? sessionsWeek = null,Object? streak = null,}) {
  return _then(_LeaderboardRow(
userId: null == userId ? _self.userId : userId // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,xpWeek: null == xpWeek ? _self.xpWeek : xpWeek // ignore: cast_nullable_to_non_nullable
as int,sessionsWeek: null == sessionsWeek ? _self.sessionsWeek : sessionsWeek // ignore: cast_nullable_to_non_nullable
as int,streak: null == streak ? _self.streak : streak // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$LeaderboardResult {

 String get weekStart; List<LeaderboardRow> get rows; int get groupStreak;
/// Create a copy of LeaderboardResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$LeaderboardResultCopyWith<LeaderboardResult> get copyWith => _$LeaderboardResultCopyWithImpl<LeaderboardResult>(this as LeaderboardResult, _$identity);

  /// Serializes this LeaderboardResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as LeaderboardResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is LeaderboardResult&&(identical(other.weekStart, _this.weekStart) || other.weekStart == _this.weekStart)&&const DeepCollectionEquality().equals(other.rows, _this.rows)&&(identical(other.groupStreak, _this.groupStreak) || other.groupStreak == _this.groupStreak));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as LeaderboardResult;
  return Object.hash(runtimeType,_this.weekStart,const DeepCollectionEquality().hash(_this.rows),_this.groupStreak);
}

@override
String toString() {
  final _this = this as LeaderboardResult;
  return 'LeaderboardResult(weekStart: ${_this.weekStart}, rows: ${_this.rows}, groupStreak: ${_this.groupStreak})';
}


}

/// @nodoc
abstract mixin class $LeaderboardResultCopyWith<$Res>  {
  factory $LeaderboardResultCopyWith(LeaderboardResult value, $Res Function(LeaderboardResult) _then) = _$LeaderboardResultCopyWithImpl;
@useResult
$Res call({
 String weekStart, List<LeaderboardRow> rows, int groupStreak
});




}
/// @nodoc
class _$LeaderboardResultCopyWithImpl<$Res>
    implements $LeaderboardResultCopyWith<$Res> {
  _$LeaderboardResultCopyWithImpl(this._self, this._then);

  final LeaderboardResult _self;
  final $Res Function(LeaderboardResult) _then;

/// Create a copy of LeaderboardResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? weekStart = null,Object? rows = null,Object? groupStreak = null,}) {
  return _then(LeaderboardResult(
weekStart: null == weekStart ? _self.weekStart : weekStart // ignore: cast_nullable_to_non_nullable
as String,rows: null == rows ? _self.rows : rows // ignore: cast_nullable_to_non_nullable
as List<LeaderboardRow>,groupStreak: null == groupStreak ? _self.groupStreak : groupStreak // ignore: cast_nullable_to_non_nullable
as int,
  ));
}

}


/// Adds pattern-matching-related methods to [LeaderboardResult].
extension LeaderboardResultPatterns on LeaderboardResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _LeaderboardResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _LeaderboardResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _LeaderboardResult value)  $default,){
final _that = this;
switch (_that) {
case _LeaderboardResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _LeaderboardResult value)?  $default,){
final _that = this;
switch (_that) {
case _LeaderboardResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String weekStart,  List<LeaderboardRow> rows,  int groupStreak)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _LeaderboardResult() when $default != null:
return $default(_that.weekStart,_that.rows,_that.groupStreak);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String weekStart,  List<LeaderboardRow> rows,  int groupStreak)  $default,) {final _that = this;
switch (_that) {
case _LeaderboardResult():
return $default(_that.weekStart,_that.rows,_that.groupStreak);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String weekStart,  List<LeaderboardRow> rows,  int groupStreak)?  $default,) {final _that = this;
switch (_that) {
case _LeaderboardResult() when $default != null:
return $default(_that.weekStart,_that.rows,_that.groupStreak);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _LeaderboardResult implements LeaderboardResult {
  const _LeaderboardResult({required this.weekStart, required  List<LeaderboardRow> rows, this.groupStreak = 0}): _rows = rows;
  factory _LeaderboardResult.fromJson(Map<String, dynamic> json) => _$LeaderboardResultFromJson(json);

@override final  String weekStart;
 final  List<LeaderboardRow> _rows;
@override List<LeaderboardRow> get rows {
  if (_rows is EqualUnmodifiableListView) return _rows;
  // ignore: implicit_dynamic_type
  return EqualUnmodifiableListView(_rows);
}

@override@JsonKey() final  int groupStreak;

/// Create a copy of LeaderboardResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$LeaderboardResultCopyWith<_LeaderboardResult> get copyWith => __$LeaderboardResultCopyWithImpl<_LeaderboardResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$LeaderboardResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _LeaderboardResult&&(identical(other.weekStart, weekStart) || other.weekStart == weekStart)&&const DeepCollectionEquality().equals(other.rows, _rows)&&(identical(other.groupStreak, groupStreak) || other.groupStreak == groupStreak));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,weekStart,const DeepCollectionEquality().hash(_rows),groupStreak);
}

@override
String toString() {
    return 'LeaderboardResult(weekStart: $weekStart, rows: $rows, groupStreak: $groupStreak)';
}


}

/// @nodoc
abstract mixin class _$LeaderboardResultCopyWith<$Res> implements $LeaderboardResultCopyWith<$Res> {
  factory _$LeaderboardResultCopyWith(_LeaderboardResult value, $Res Function(_LeaderboardResult) _then) = __$LeaderboardResultCopyWithImpl;
@override @useResult
$Res call({
 String weekStart, List<LeaderboardRow> rows, int groupStreak
});




}
/// @nodoc
class __$LeaderboardResultCopyWithImpl<$Res>
    implements _$LeaderboardResultCopyWith<$Res> {
  __$LeaderboardResultCopyWithImpl(this._self, this._then);

  final _LeaderboardResult _self;
  final $Res Function(_LeaderboardResult) _then;

/// Create a copy of LeaderboardResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? weekStart = null,Object? rows = null,Object? groupStreak = null,}) {
  return _then(_LeaderboardResult(
weekStart: null == weekStart ? _self.weekStart : weekStart // ignore: cast_nullable_to_non_nullable
as String,rows: null == rows ? _self._rows : rows // ignore: cast_nullable_to_non_nullable
as List<LeaderboardRow>,groupStreak: null == groupStreak ? _self.groupStreak : groupStreak // ignore: cast_nullable_to_non_nullable
as int,
  ));
}


}


/// @nodoc
mixin _$ChallengeItem {

 String get fromUserId; String get displayName; String get topic; String get kind; String get sessionId;
/// Create a copy of ChallengeItem
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$ChallengeItemCopyWith<ChallengeItem> get copyWith => _$ChallengeItemCopyWithImpl<ChallengeItem>(this as ChallengeItem, _$identity);

  /// Serializes this ChallengeItem to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as ChallengeItem;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is ChallengeItem&&(identical(other.fromUserId, _this.fromUserId) || other.fromUserId == _this.fromUserId)&&(identical(other.displayName, _this.displayName) || other.displayName == _this.displayName)&&(identical(other.topic, _this.topic) || other.topic == _this.topic)&&(identical(other.kind, _this.kind) || other.kind == _this.kind)&&(identical(other.sessionId, _this.sessionId) || other.sessionId == _this.sessionId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as ChallengeItem;
  return Object.hash(runtimeType,_this.fromUserId,_this.displayName,_this.topic,_this.kind,_this.sessionId);
}

@override
String toString() {
  final _this = this as ChallengeItem;
  return 'ChallengeItem(fromUserId: ${_this.fromUserId}, displayName: ${_this.displayName}, topic: ${_this.topic}, kind: ${_this.kind}, sessionId: ${_this.sessionId})';
}


}

/// @nodoc
abstract mixin class $ChallengeItemCopyWith<$Res>  {
  factory $ChallengeItemCopyWith(ChallengeItem value, $Res Function(ChallengeItem) _then) = _$ChallengeItemCopyWithImpl;
@useResult
$Res call({
 String fromUserId, String displayName, String topic, String kind, String sessionId
});




}
/// @nodoc
class _$ChallengeItemCopyWithImpl<$Res>
    implements $ChallengeItemCopyWith<$Res> {
  _$ChallengeItemCopyWithImpl(this._self, this._then);

  final ChallengeItem _self;
  final $Res Function(ChallengeItem) _then;

/// Create a copy of ChallengeItem
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? fromUserId = null,Object? displayName = null,Object? topic = null,Object? kind = null,Object? sessionId = null,}) {
  return _then(ChallengeItem(
fromUserId: null == fromUserId ? _self.fromUserId : fromUserId // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,topic: null == topic ? _self.topic : topic // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [ChallengeItem].
extension ChallengeItemPatterns on ChallengeItem {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _ChallengeItem value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _ChallengeItem() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _ChallengeItem value)  $default,){
final _that = this;
switch (_that) {
case _ChallengeItem():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _ChallengeItem value)?  $default,){
final _that = this;
switch (_that) {
case _ChallengeItem() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String fromUserId,  String displayName,  String topic,  String kind,  String sessionId)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _ChallengeItem() when $default != null:
return $default(_that.fromUserId,_that.displayName,_that.topic,_that.kind,_that.sessionId);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String fromUserId,  String displayName,  String topic,  String kind,  String sessionId)  $default,) {final _that = this;
switch (_that) {
case _ChallengeItem():
return $default(_that.fromUserId,_that.displayName,_that.topic,_that.kind,_that.sessionId);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String fromUserId,  String displayName,  String topic,  String kind,  String sessionId)?  $default,) {final _that = this;
switch (_that) {
case _ChallengeItem() when $default != null:
return $default(_that.fromUserId,_that.displayName,_that.topic,_that.kind,_that.sessionId);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _ChallengeItem implements ChallengeItem {
  const _ChallengeItem({required this.fromUserId, required this.displayName, required this.topic, required this.kind, required this.sessionId});
  factory _ChallengeItem.fromJson(Map<String, dynamic> json) => _$ChallengeItemFromJson(json);

@override final  String fromUserId;
@override final  String displayName;
@override final  String topic;
@override final  String kind;
@override final  String sessionId;

/// Create a copy of ChallengeItem
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$ChallengeItemCopyWith<_ChallengeItem> get copyWith => __$ChallengeItemCopyWithImpl<_ChallengeItem>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$ChallengeItemToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _ChallengeItem&&(identical(other.fromUserId, fromUserId) || other.fromUserId == fromUserId)&&(identical(other.displayName, displayName) || other.displayName == displayName)&&(identical(other.topic, topic) || other.topic == topic)&&(identical(other.kind, kind) || other.kind == kind)&&(identical(other.sessionId, sessionId) || other.sessionId == sessionId));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,fromUserId,displayName,topic,kind,sessionId);
}

@override
String toString() {
    return 'ChallengeItem(fromUserId: $fromUserId, displayName: $displayName, topic: $topic, kind: $kind, sessionId: $sessionId)';
}


}

/// @nodoc
abstract mixin class _$ChallengeItemCopyWith<$Res> implements $ChallengeItemCopyWith<$Res> {
  factory _$ChallengeItemCopyWith(_ChallengeItem value, $Res Function(_ChallengeItem) _then) = __$ChallengeItemCopyWithImpl;
@override @useResult
$Res call({
 String fromUserId, String displayName, String topic, String kind, String sessionId
});




}
/// @nodoc
class __$ChallengeItemCopyWithImpl<$Res>
    implements _$ChallengeItemCopyWith<$Res> {
  __$ChallengeItemCopyWithImpl(this._self, this._then);

  final _ChallengeItem _self;
  final $Res Function(_ChallengeItem) _then;

/// Create a copy of ChallengeItem
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? fromUserId = null,Object? displayName = null,Object? topic = null,Object? kind = null,Object? sessionId = null,}) {
  return _then(_ChallengeItem(
fromUserId: null == fromUserId ? _self.fromUserId : fromUserId // ignore: cast_nullable_to_non_nullable
as String,displayName: null == displayName ? _self.displayName : displayName // ignore: cast_nullable_to_non_nullable
as String,topic: null == topic ? _self.topic : topic // ignore: cast_nullable_to_non_nullable
as String,kind: null == kind ? _self.kind : kind // ignore: cast_nullable_to_non_nullable
as String,sessionId: null == sessionId ? _self.sessionId : sessionId // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}


/// @nodoc
mixin _$WeeklySummaryResult {

 String get text; String get weekStart;
/// Create a copy of WeeklySummaryResult
/// with the given fields replaced by the non-null parameter values.
@JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
$WeeklySummaryResultCopyWith<WeeklySummaryResult> get copyWith => _$WeeklySummaryResultCopyWithImpl<WeeklySummaryResult>(this as WeeklySummaryResult, _$identity);

  /// Serializes this WeeklySummaryResult to a JSON map.
  Map<String, dynamic> toJson();


@override
bool operator ==(Object other) {
  final _this = this as WeeklySummaryResult;
  return identical(this, other) || (other.runtimeType == runtimeType&&other is WeeklySummaryResult&&(identical(other.text, _this.text) || other.text == _this.text)&&(identical(other.weekStart, _this.weekStart) || other.weekStart == _this.weekStart));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
  final _this = this as WeeklySummaryResult;
  return Object.hash(runtimeType,_this.text,_this.weekStart);
}

@override
String toString() {
  final _this = this as WeeklySummaryResult;
  return 'WeeklySummaryResult(text: ${_this.text}, weekStart: ${_this.weekStart})';
}


}

/// @nodoc
abstract mixin class $WeeklySummaryResultCopyWith<$Res>  {
  factory $WeeklySummaryResultCopyWith(WeeklySummaryResult value, $Res Function(WeeklySummaryResult) _then) = _$WeeklySummaryResultCopyWithImpl;
@useResult
$Res call({
 String text, String weekStart
});




}
/// @nodoc
class _$WeeklySummaryResultCopyWithImpl<$Res>
    implements $WeeklySummaryResultCopyWith<$Res> {
  _$WeeklySummaryResultCopyWithImpl(this._self, this._then);

  final WeeklySummaryResult _self;
  final $Res Function(WeeklySummaryResult) _then;

/// Create a copy of WeeklySummaryResult
/// with the given fields replaced by the non-null parameter values.
@pragma('vm:prefer-inline') @override $Res call({Object? text = null,Object? weekStart = null,}) {
  return _then(WeeklySummaryResult(
text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,weekStart: null == weekStart ? _self.weekStart : weekStart // ignore: cast_nullable_to_non_nullable
as String,
  ));
}

}


/// Adds pattern-matching-related methods to [WeeklySummaryResult].
extension WeeklySummaryResultPatterns on WeeklySummaryResult {
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

@optionalTypeArgs TResult maybeMap<TResult extends Object?>(TResult Function( _WeeklySummaryResult value)?  $default,{required TResult orElse(),}){
final _that = this;
switch (_that) {
case _WeeklySummaryResult() when $default != null:
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

@optionalTypeArgs TResult map<TResult extends Object?>(TResult Function( _WeeklySummaryResult value)  $default,){
final _that = this;
switch (_that) {
case _WeeklySummaryResult():
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

@optionalTypeArgs TResult? mapOrNull<TResult extends Object?>(TResult? Function( _WeeklySummaryResult value)?  $default,){
final _that = this;
switch (_that) {
case _WeeklySummaryResult() when $default != null:
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

@optionalTypeArgs TResult maybeWhen<TResult extends Object?>(TResult Function( String text,  String weekStart)?  $default,{required TResult orElse(),}) {final _that = this;
switch (_that) {
case _WeeklySummaryResult() when $default != null:
return $default(_that.text,_that.weekStart);case _:
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

@optionalTypeArgs TResult when<TResult extends Object?>(TResult Function( String text,  String weekStart)  $default,) {final _that = this;
switch (_that) {
case _WeeklySummaryResult():
return $default(_that.text,_that.weekStart);case _:
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

@optionalTypeArgs TResult? whenOrNull<TResult extends Object?>(TResult? Function( String text,  String weekStart)?  $default,) {final _that = this;
switch (_that) {
case _WeeklySummaryResult() when $default != null:
return $default(_that.text,_that.weekStart);case _:
  return null;

}
}

}

/// @nodoc
@JsonSerializable()

class _WeeklySummaryResult implements WeeklySummaryResult {
  const _WeeklySummaryResult({required this.text, required this.weekStart});
  factory _WeeklySummaryResult.fromJson(Map<String, dynamic> json) => _$WeeklySummaryResultFromJson(json);

@override final  String text;
@override final  String weekStart;

/// Create a copy of WeeklySummaryResult
/// with the given fields replaced by the non-null parameter values.
@override @JsonKey(includeFromJson: false, includeToJson: false)
@pragma('vm:prefer-inline')
_$WeeklySummaryResultCopyWith<_WeeklySummaryResult> get copyWith => __$WeeklySummaryResultCopyWithImpl<_WeeklySummaryResult>(this, _$identity);

@override
Map<String, dynamic> toJson() {
  return _$WeeklySummaryResultToJson(this, );
}

@override
bool operator ==(Object other) {
    return identical(this, other) || (other.runtimeType == runtimeType&&other is _WeeklySummaryResult&&(identical(other.text, text) || other.text == text)&&(identical(other.weekStart, weekStart) || other.weekStart == weekStart));
}

@JsonKey(includeFromJson: false, includeToJson: false)
@override
int get hashCode {
    return Object.hash(runtimeType,text,weekStart);
}

@override
String toString() {
    return 'WeeklySummaryResult(text: $text, weekStart: $weekStart)';
}


}

/// @nodoc
abstract mixin class _$WeeklySummaryResultCopyWith<$Res> implements $WeeklySummaryResultCopyWith<$Res> {
  factory _$WeeklySummaryResultCopyWith(_WeeklySummaryResult value, $Res Function(_WeeklySummaryResult) _then) = __$WeeklySummaryResultCopyWithImpl;
@override @useResult
$Res call({
 String text, String weekStart
});




}
/// @nodoc
class __$WeeklySummaryResultCopyWithImpl<$Res>
    implements _$WeeklySummaryResultCopyWith<$Res> {
  __$WeeklySummaryResultCopyWithImpl(this._self, this._then);

  final _WeeklySummaryResult _self;
  final $Res Function(_WeeklySummaryResult) _then;

/// Create a copy of WeeklySummaryResult
/// with the given fields replaced by the non-null parameter values.
@override @pragma('vm:prefer-inline') $Res call({Object? text = null,Object? weekStart = null,}) {
  return _then(_WeeklySummaryResult(
text: null == text ? _self.text : text // ignore: cast_nullable_to_non_nullable
as String,weekStart: null == weekStart ? _self.weekStart : weekStart // ignore: cast_nullable_to_non_nullable
as String,
  ));
}


}

// dart format on

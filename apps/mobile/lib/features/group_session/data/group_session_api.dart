import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/http/api_client.dart';
import '../../../core/providers.dart';
import '../domain/group_session_dto.dart';
import '../domain/group_session_exception.dart';

/// Endpoints de texto de `group-sessions` (docs/arch/002-sesion-grupal.md
/// §Interfaces). Igual que `HttpFluentApi`, pero fuera de la interfaz
/// `FluentApi`: la sala grupal no comparte abstracción con la 1:1, solo el
/// `ApiClient`.
class GroupSessionApi {
  GroupSessionApi(this._client);

  final ApiClient _client;

  Future<GroupSessionDto> start({
    required String kind,
    String? topic,
    String? roleplayId,
    String? newsItemId,
  }) => _guard(() async {
    final res = await _client.dio.post(
      '/group-sessions',
      data: {
        'kind': kind,
        'topic': ?topic,
        'roleplayId': ?roleplayId,
        'newsItemId': ?newsItemId,
      },
    );
    return GroupSessionDto.fromJson(res.data as Map<String, dynamic>);
  });

  /// `204` (sin cuerpo) cuando el grupo no tiene sala activa.
  Future<GroupSessionDto?> active() => _guard(() async {
    final res = await _client.dio.get('/group-sessions/active');
    if (res.statusCode == 204 || res.data == null) return null;
    return GroupSessionDto.fromJson(res.data as Map<String, dynamic>);
  });

  Future<GroupSessionDetailDto> detail(String sessionId) => _guard(() async {
    final res = await _client.dio.get('/group-sessions/$sessionId');
    return GroupSessionDetailDto.fromJson(res.data as Map<String, dynamic>);
  });

  Future<void> join(String sessionId) => _guard(() async {
    await _client.dio.post('/group-sessions/$sessionId/join');
  });

  Future<void> leave(String sessionId) => _guard(() async {
    await _client.dio.post('/group-sessions/$sessionId/leave');
  });

  /// Solo el iniciador puede terminarla (`GROUP_SESSION_FORBIDDEN` si no).
  Future<void> end(String sessionId) => _guard(() async {
    await _client.dio.post('/group-sessions/$sessionId/end');
  });

  Future<GroupMessageDto> sendMessage({
    required String sessionId,
    required String text,
    required String clientId,
  }) => _guard(() async {
    final res = await _client.dio.post(
      '/group-sessions/$sessionId/messages',
      data: {'text': text, 'clientId': clientId},
    );
    return GroupMessageDto.fromJson(res.data as Map<String, dynamic>);
  });

  Future<void> setShareCorrections({
    required String sessionId,
    required bool share,
  }) => _guard(() async {
    await _client.dio.put(
      '/group-sessions/$sessionId/share-corrections',
      data: {'share': share},
    );
  });

  /// Traduce un `DioException` a [GroupSessionException] cuando el cuerpo
  /// trae uno de los 4 códigos propios de la sala; cualquier otro código cae
  /// al mapeo genérico de `ApiClient`.
  Future<T> _guard<T>(Future<T> Function() body) async {
    try {
      return await body();
    } on DioException catch (e) {
      final data = e.response?.data;
      final groupError = data is Map<String, dynamic>
          ? groupSessionErrorFromBody(data)
          : null;
      throw groupError ?? ApiClient.mapDioException(e);
    }
  }
}

final groupSessionApiProvider = Provider<GroupSessionApi>((ref) {
  return GroupSessionApi(ref.watch(apiClientProvider));
});

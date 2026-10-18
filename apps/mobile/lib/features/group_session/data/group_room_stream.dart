import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/errors/api_exception.dart';
import '../../../core/http/api_client.dart';
import '../../../core/providers.dart';
import '../domain/group_session_dto.dart';
import '../domain/group_session_exception.dart';
import '../domain/room_event.dart';
import 'group_session_api.dart';

/// `GET group-sessions/:id/events` (docs/arch/002-sesion-grupal.md §«Stream
/// SSE»). Misma técnica que `sendTurnStream` en `http_fluent_api.dart`: Dio
/// con `ResponseType.stream` + `LineSplitter`, parseando `event:`/`data:`
/// línea a línea.
class GroupRoomStream {
  GroupRoomStream(this._client, this._api);

  final ApiClient _client;
  final GroupSessionApi _api;

  static const _backoffs = [
    Duration(seconds: 1),
    Duration(seconds: 2),
    Duration(seconds: 5),
  ];

  /// No hay replay por `Last-Event-ID` (arch doc): lo que se pierde durante
  /// un corte no vuelve. Por eso, ante una caída, se espera el backoff y se
  /// vuelve a pedir `detail()` antes de reabrir el stream — además de
  /// resincronizar, sirve de sonda: si la sala ya terminó o el usuario
  /// perdió acceso, `detail()` lo tira como error terminal (ver abajo) en
  /// vez de reintentar para siempre.
  Stream<RoomEvent> watch(String sessionId) async* {
    var attempt = 0;
    while (true) {
      try {
        yield* _openOnce(sessionId);
      } catch (e) {
        // Un error terminal (la API realmente contestó con un código de
        // error, vía `GroupSessionException`/`ApiException`) no es una
        // caída de conexión: no tiene sentido reconectar, hay que
        // propagarlo. Cualquier otra cosa (DioException de red, el socket
        // que se cerró sin avisar) sí es una caída.
        if (e is GroupSessionException || e is ApiException) rethrow;
      }

      final backoff = _backoffs[attempt < _backoffs.length ? attempt : _backoffs.length - 1];
      attempt++;
      await Future<void>.delayed(backoff);

      try {
        await _api.detail(sessionId);
      } on GroupSessionException {
        rethrow;
      } on ApiException {
        rethrow;
      } catch (_) {
        // Fallo de red al resincronizar: se reintenta igual, el próximo
        // intento de abrir el stream más abajo puede tener mejor suerte.
      }
    }
  }

  Stream<RoomEvent> _openOnce(String sessionId) async* {
    Response<ResponseBody> response;
    try {
      response = await _client.dio.get<ResponseBody>(
        '/group-sessions/$sessionId/events',
        options: Options(
          responseType: ResponseType.stream,
          receiveTimeout: Duration.zero,
        ),
      );
    } on DioException catch (e) {
      throw await _mapOpenError(e);
    }

    final lines = response.data!.stream
        .cast<List<int>>()
        .transform(utf8.decoder)
        .transform(const LineSplitter());

    String? eventName;
    final dataBuffer = StringBuffer();

    await for (final line in lines) {
      if (line.startsWith(':')) continue; // `: ping`
      if (line.startsWith('event:')) {
        eventName = line.substring('event:'.length).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        if (dataBuffer.isNotEmpty) dataBuffer.write('\n');
        dataBuffer.write(line.substring('data:'.length).trim());
        continue;
      }
      if (line.isEmpty) {
        final name = eventName;
        final raw = dataBuffer.toString();
        eventName = null;
        dataBuffer.clear();
        if (name == null || raw.isEmpty) continue;
        final event = _parseEvent(name, raw);
        if (event != null) yield event;
      }
    }
  }

  RoomEvent? _parseEvent(String name, String rawData) {
    final data = jsonDecode(rawData);
    switch (name) {
      case 'message':
        return RoomMessageEvent(
          GroupMessageDto.fromJson(data as Map<String, dynamic>),
        );
      case 'tutor_token':
        return RoomTutorTokenEvent((data as Map<String, dynamic>)['text'] as String);
      case 'corrections':
        final body = data as Map<String, dynamic>;
        return RoomCorrectionsEvent(
          messageId: body['messageId'] as int,
          authorId: body['authorId'] as String,
          items: (body['items'] as List)
              .map((e) => GroupCorrectionDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      case 'participants':
        return RoomParticipantsEvent(
          (data as List)
              .map((e) => ParticipantDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      case 'ended':
        final body = data as Map<String, dynamic>;
        return RoomEndedEvent(
          reason: body['reason'] as String,
          xp: (body['xp'] as List)
              .map((e) => GroupXpEntryDto.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      case 'recap':
        return RoomRecapEvent(GroupRecapDto.fromJson(data as Map<String, dynamic>));
      default:
        return null;
    }
  }

  /// Ver el comentario de [_openOnce]: con `ResponseType.stream`, un error
  /// de verdad (403/404/409 antes de streamear) trae el cuerpo como
  /// `ResponseBody` sin decodificar en vez de como el `Map` que espera
  /// [groupSessionErrorFromBody]. Se lee y decodifica a mano (igual que
  /// `_mapStreamDioException` en `http_fluent_api.dart`); si no es JSON
  /// válido, o si no hay cuerpo (caída de red pura), se devuelve la
  /// `DioException` tal cual para que `watch` la trate como una caída.
  Future<Object> _mapOpenError(DioException e) async {
    final data = e.response?.data;
    if (data is ResponseBody) {
      try {
        final bytes = await data.stream.expand((chunk) => chunk).toList();
        final decoded = jsonDecode(utf8.decode(bytes));
        if (decoded is Map<String, dynamic>) {
          return groupSessionErrorFromBody(decoded) ??
              ApiClient.mapDioException(e);
        }
      } catch (_) {
        // Cuerpo no es JSON válido: se cae a devolver la excepción tal cual.
      }
    }
    return e.response != null ? ApiClient.mapDioException(e) : e;
  }
}

final groupRoomStreamProvider = Provider<GroupRoomStream>((ref) {
  return GroupRoomStream(
    ref.watch(apiClientProvider),
    ref.watch(groupSessionApiProvider),
  );
});

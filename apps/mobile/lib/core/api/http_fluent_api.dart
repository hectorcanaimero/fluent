import 'dart:convert';

import 'package:dio/dio.dart';

import '../errors/api_exception.dart';
import '../http/api_client.dart';
import 'fluent_api.dart';
import 'models.dart';
import 'turn_stream_event.dart';

/// Implementación real de [FluentApi] contra `{API_URL}/v1` (SPEC-02 §4).
/// Es la implementación por defecto desde T9 (`USE_FAKE_API=false`).
class HttpFluentApi implements FluentApi {
  HttpFluentApi(this._client);

  final ApiClient _client;

  @override
  Future<MeResponse> getMe() => _client.guard(() async {
    final res = await _client.dio.get('/me');
    return MeResponse.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<PutProfileResult> putProfile({
    required String displayName,
    required String level,
    required List<String> interests,
    required String timezone,
    required String locale,
  }) => _client.guard(() async {
    final res = await _client.dio.put(
      '/me/profile',
      data: {
        'displayName': displayName,
        'level': level,
        'interests': interests,
        'timezone': timezone,
        'locale': locale,
      },
    );
    final data = res.data as Map<String, dynamic>;
    return PutProfileResult(
      profile: Profile.fromJson(data),
      xpAwarded: data['xpAwarded'] as int?,
    );
  });

  @override
  Future<GroupInfo> redeemInvitation(String code) => _client.guard(() async {
    final res = await _client.dio.post(
      '/invitations/redeem',
      data: {'code': code},
    );
    final data = res.data as Map<String, dynamic>;
    return GroupInfo.fromJson(data['group'] as Map<String, dynamic>);
  });

  @override
  Future<List<String>> createInvitations({int count = 1}) =>
      _client.guard(() async {
        final res = await _client.dio.post(
          '/admin/invitations',
          data: {'count': count},
        );
        final data = res.data as Map<String, dynamic>;
        return (data['codes'] as List).cast<String>();
      });

  @override
  Future<GroupResponse> getGroup() => _client.guard(() async {
    final res = await _client.dio.get('/group');
    return GroupResponse.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<void> deleteAccount() => _client.guard(() async {
    await _client.dio.delete('/me');
  });

  @override
  Future<PkceStartResult> startOpenRouterPkce(String callbackUrl) =>
      _client.guard(() async {
        final res = await _client.dio.post(
          '/providers/openrouter/pkce/start',
          data: {'callbackUrl': callbackUrl},
        );
        return PkceStartResult.fromJson(res.data as Map<String, dynamic>);
      });

  @override
  Future<ProviderStatusResult> completeOpenRouterPkce({
    required String codeVerifierId,
  }) => _client.guard(() async {
    final res = await _client.dio.post(
      '/providers/openrouter/pkce/complete',
      data: {'codeVerifierId': codeVerifierId},
    );
    return ProviderStatusResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<ProviderStatusResult> connectGemini(String apiKey) =>
      _client.guard(() async {
        final res = await _client.dio.post(
          '/providers/gemini',
          data: {'apiKey': apiKey},
        );
        return ProviderStatusResult.fromJson(res.data as Map<String, dynamic>);
      });

  @override
  Future<void> disconnectProvider(String provider) => _client.guard(() async {
    await _client.dio.delete('/providers/$provider');
  });

  @override
  Future<ProviderStatusResult> getProviderStatus(String provider) =>
      _client.guard(() async {
        final res = await _client.dio.get('/providers/$provider/status');
        return ProviderStatusResult.fromJson(res.data as Map<String, dynamic>);
      });

  @override
  Future<ModelsCatalog> getModels() => _client.guard(() async {
    final res = await _client.dio.get('/models');
    return ModelsCatalog.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<ModelPreference> putModelPreference({
    required String chatProvider,
    required String chatModel,
    required String briefProvider,
    required String briefModel,
  }) => _client.guard(() async {
    final res = await _client.dio.put(
      '/me/models',
      data: {
        'chatProvider': chatProvider,
        'chatModel': chatModel,
        'briefProvider': briefProvider,
        'briefModel': briefModel,
      },
    );
    return ModelPreference.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<SessionSuggestions> getSessionSuggestions() => _client.guard(() async {
    final res = await _client.dio.get('/sessions/suggestions');
    return SessionSuggestions.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<CreateSessionResult> createSession({
    required String kind,
    String? topic,
    String? roleplayId,
    String? newsItemId,
    String? challengeFromUserId,
  }) => _client.guard(() async {
    final res = await _client.dio.post(
      '/sessions',
      data: {
        'kind': kind,
        'topic': ?topic,
        'roleplayId': ?roleplayId,
        'newsItemId': ?newsItemId,
        'challengeFromUserId': ?challengeFromUserId,
      },
    );
    return CreateSessionResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<TurnResult> sendTurn({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) => _client.guard(() async {
    final res = await _client.dio.post(
      '/sessions/$sessionId/turns',
      data: {'text': text},
      cancelToken: cancelToken,
    );
    return TurnResult.fromJson(res.data as Map<String, dynamic>);
  });

  /// `POST /sessions/:id/turns/stream` (SPEC-04 §4). Se pide con
  /// `ResponseType.stream` para no dejar que Dio bufferee el cuerpo entero
  /// antes de entregarlo (lo que anularía el streaming) y se parsea el
  /// formato SSE de `apps/api/src/sessions/turn-stream.ts` línea a línea:
  /// cada evento es `event: <nombre>\ndata: <json>\n\n`.
  ///
  /// Un error **antes** del primer evento (403/409/429/400, SPEC-02 §6)
  /// llega igual que en cualquier otro endpoint: como `DioException` con un
  /// cuerpo JSON. La diferencia con [ApiClient.mapDioException] es que, al
  /// pedir el stream sin bufferear, Dio entrega ese cuerpo como un
  /// [ResponseBody] sin decodificar en vez de como un `Map` ya parseado
  /// (`ResponseType.stream` no distingue éxito de error al transformar la
  /// respuesta), así que hay que leerlo y decodificarlo a mano
  /// (`_mapStreamDioException`).
  @override
  Stream<TurnStreamEvent> sendTurnStream({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) {
    // MAL-08: si el proxy/conexión se cuelga sin cortar el socket, el
    // `await for` de abajo nunca ve un evento ni un error — se queda
    // esperando para siempre. Envolver el stream con `.timeout()` (en vez
    // de ponerlo dentro del `async*`, donde no cortaría la espera de la
    // próxima línea) convierte esa espera colgada en un `TurnStreamError`
    // catchable, que el llamador ya sabe convertir en la caída al modo
    // completo (`_sendTurnWithStreamFallback`).
    return _sendTurnStreamRaw(
      sessionId: sessionId,
      text: text,
      cancelToken: cancelToken,
    ).timeout(
      const Duration(seconds: 30),
      onTimeout: (sink) {
        sink.add(
          const TurnStreamError(
            ApiException(
              code: ApiErrorCode.streamTimeout,
              message: 'turn stream timed out waiting for the next event',
            ),
          ),
        );
        sink.close();
      },
    );
  }

  Stream<TurnStreamEvent> _sendTurnStreamRaw({
    required String sessionId,
    required String text,
    CancelToken? cancelToken,
  }) async* {
    Response<ResponseBody> response;
    try {
      response = await _client.dio.post<ResponseBody>(
        '/sessions/$sessionId/turns/stream',
        data: {'text': text},
        cancelToken: cancelToken,
        options: Options(
          responseType: ResponseType.stream,
          // El turno puede tardar más que el timeout general de lectura
          // (`ApiClient`, 20 s): sin esto Dio cortaría un turno lento a
          // mitad de stream con un `DioException` de timeout.
          receiveTimeout: Duration.zero,
        ),
      );
    } on DioException catch (e) {
      throw await _mapStreamDioException(e);
    }

    final lines = response.data!.stream
        .cast<List<int>>()
        .transform(utf8.decoder)
        .transform(const LineSplitter());

    String? eventName;
    final dataBuffer = StringBuffer();

    await for (final line in lines) {
      if (line.startsWith('event:')) {
        eventName = line.substring('event:'.length).trim();
        continue;
      }
      if (line.startsWith('data:')) {
        // SSE (WHATWG): varias líneas `data:` seguidas para un mismo evento
        // se unen con `\n`, no se concatenan a lo bruto — si no, un JSON
        // partido en dos líneas por el proxy/servidor rompe el parseo
        // (MEJ-18) y el turno cae al modo completo, duplicándose.
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
        final event = _parseStreamEvent(name, raw);
        if (event != null) yield event;
      }
    }
  }

  /// Un evento cuyo nombre no reconoce esta versión de la app se ignora en
  /// vez de tumbar el stream: es lo mismo que ya hace la app con campos JSON
  /// desconocidos en las respuestas normales.
  TurnStreamEvent? _parseStreamEvent(String name, String rawData) {
    final data = jsonDecode(rawData);
    switch (name) {
      case 'token':
        return TurnStreamToken(
          (data as Map<String, dynamic>)['text'] as String,
        );
      case 'corrections':
        final list = (data as Map<String, dynamic>)['corrections'] as List;
        return TurnStreamCorrections(
          list
              .map((e) => Correction.fromJson(e as Map<String, dynamic>))
              .toList(),
        );
      case 'done':
        return TurnStreamDone(
          TurnResult.fromJson(data as Map<String, dynamic>),
        );
      case 'error':
        final body = data as Map<String, dynamic>;
        return TurnStreamError(
          ApiException(
            code: ApiErrorCode.fromWire(body['error'] as String?),
            message: (body['message'] as String?) ?? 'stream error',
            statusCode: body['statusCode'] as int?,
          ),
        );
      case 'reset':
        return const TurnStreamReset();
      default:
        return null;
    }
  }

  /// Ver el comentario de [sendTurnStream]: con `ResponseType.stream`, un
  /// `DioException` de un status de error trae el cuerpo sin decodificar
  /// (`ResponseBody`) en vez del `Map` que espera
  /// [ApiClient.mapDioException]. Se lee y decodifica a mano y, si no es
  /// JSON válido o no es un `ResponseBody`, se cae al mapeo genérico.
  Future<ApiException> _mapStreamDioException(DioException e) async {
    final data = e.response?.data;
    if (data is ResponseBody) {
      try {
        final bytes = await data.stream.expand((chunk) => chunk).toList();
        final decoded = jsonDecode(utf8.decode(bytes));
        if (decoded is Map<String, dynamic>) {
          return ApiException(
            code: ApiErrorCode.fromWire(decoded['error'] as String?),
            message: (decoded['message'] as String?) ?? e.message ?? 'error',
            statusCode: e.response?.statusCode,
            details: (decoded['details'] as List?)
                ?.cast<Map<String, dynamic>>(),
            activeSessionId: decoded['activeSessionId'] as String?,
          );
        }
      } catch (_) {
        // Cuerpo no es JSON válido (o falló al leer el stream): se cae al
        // mapeo genérico de abajo.
      }
    }
    return ApiClient.mapDioException(e);
  }

  @override
  Future<SessionEndResult> endSession({
    required String sessionId,
    required String reason,
  }) => _client.guard(() async {
    final res = await _client.dio.post(
      '/sessions/$sessionId/end',
      data: {'reason': reason},
    );
    return SessionEndResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<SessionListResult> getSessions({int limit = 20, String? cursor}) =>
      _client.guard(() async {
        final res = await _client.dio.get(
          '/sessions',
          queryParameters: {'limit': limit, 'cursor': ?cursor},
        );
        return SessionListResult.fromJson(res.data as Map<String, dynamic>);
      });

  @override
  Future<SessionDetailResult> getSession(String sessionId) =>
      _client.guard(() async {
        final res = await _client.dio.get('/sessions/$sessionId');
        return SessionDetailResult.fromJson(res.data as Map<String, dynamic>);
      });

  @override
  Future<MemoryResult> getMemory() => _client.guard(() async {
    final res = await _client.dio.get('/memory');
    return MemoryResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<MemoryFact> patchFact({
    required String factId,
    String? status,
    String? text,
  }) => _client.guard(() async {
    final res = await _client.dio.patch(
      '/memory/facts/$factId',
      data: {'status': ?status, 'text': ?text},
    );
    return MemoryFact.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<void> deleteFact(String factId) => _client.guard(() async {
    await _client.dio.delete('/memory/facts/$factId');
  });

  @override
  Future<CoachingBrief> putBrief(String text) => _client.guard(() async {
    final res = await _client.dio.put('/memory/brief', data: {'text': text});
    return CoachingBrief.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<void> forgetAllMemory() => _client.guard(() async {
    await _client.dio.delete('/memory');
  });

  @override
  Future<ProgressResult> getProgress() => _client.guard(() async {
    final res = await _client.dio.get('/progress');
    return ProgressResult.fromJson(res.data as Map<String, dynamic>);
  });

  @override
  Future<LeaderboardResult> getLeaderboard({String? week}) =>
      _client.guard(() async {
        final res = await _client.dio.get(
          '/leaderboard',
          queryParameters: {'week': ?week},
        );
        return LeaderboardResult.fromJson(res.data as Map<String, dynamic>);
      });

  @override
  Future<List<ChallengeItem>> getChallenges() => _client.guard(() async {
    final res = await _client.dio.get('/challenges');
    final data = res.data as Map<String, dynamic>;
    return (data['items'] as List)
        .map((e) => ChallengeItem.fromJson(e as Map<String, dynamic>))
        .toList();
  });

  @override
  Future<WeeklySummaryResult?> getWeeklySummary({String? week}) async {
    try {
      return await _client.guard(() async {
        final res = await _client.dio.get(
          '/weekly-summary',
          queryParameters: {'week': ?week},
        );
        return WeeklySummaryResult.fromJson(res.data as Map<String, dynamic>);
      });
    } on ApiException catch (e) {
      if (e.code == ApiErrorCode.notReady) return null;
      rethrow;
    }
  }
}

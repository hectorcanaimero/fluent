import 'dart:async';

import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/push/push_platform.dart';
import 'package:fluent_mobile/core/push/push_service.dart';
import 'package:flutter_test/flutter_test.dart';

/// Firebase Messaging simulado: permiso, token y push controlables.
class FakePushPlatform implements PushPlatform {
  FakePushPlatform({this.granted = true, this.token = 'token-1'});

  bool granted;
  String? token;
  String? launchRoute;
  int permissionRequests = 0;
  final refresh = StreamController<String>.broadcast();
  final opened = StreamController<String>.broadcast();
  final foreground = StreamController<ForegroundPush>.broadcast();

  @override
  String get platform => 'android';

  @override
  Future<bool> requestPermission() async {
    permissionRequests++;
    return granted;
  }

  @override
  Future<bool> hasPermission() async => granted;

  @override
  Future<String?> getToken() async => token;

  @override
  Stream<String> get onTokenRefresh => refresh.stream;

  @override
  Future<String?> initialRoute() async => launchRoute;

  @override
  Stream<String> get openedRoutes => opened.stream;

  @override
  Stream<ForegroundPush> get foregroundMessages => foreground.stream;
}

class _FailingApi extends FakeApi {
  _FailingApi() : super(artificialDelay: Duration.zero);

  @override
  Future<void> registerPushToken({
    required String token,
    required String platform,
  }) => Future.error(Exception('sin red'));

  @override
  Future<void> unregisterPushToken(String token) =>
      Future.error(Exception('sin red'));
}

void main() {
  late FakeApi api;
  setUp(() => api = FakeApi(artificialDelay: Duration.zero));

  test('al activar con permiso registra el token con la plataforma', () async {
    final platform = FakePushPlatform();
    await PushService(platform: platform, api: api).enable();
    expect(platform.permissionRequests, 1);
    expect(api.pushTokens, {'token-1': 'android'});
  });

  test('sin permiso no registra nada', () async {
    final platform = FakePushPlatform(granted: false);
    final push = PushService(platform: platform, api: api);
    await push.enable();
    await push.syncIfPermitted();
    expect(api.pushTokens, isEmpty);
  });

  test('al arrancar registra sin preguntar si el permiso ya estaba', () async {
    final platform = FakePushPlatform();
    await PushService(platform: platform, api: api).syncIfPermitted();
    expect(platform.permissionRequests, 0);
    expect(api.pushTokens.keys, ['token-1']);
  });

  test('un token renovado se vuelve a registrar', () async {
    final platform = FakePushPlatform();
    await PushService(platform: platform, api: api).syncIfPermitted();
    platform.refresh.add('token-2');
    await Future<void>.delayed(Duration.zero);
    expect(api.pushTokens.keys, containsAll(['token-1', 'token-2']));
  });

  test('al cerrar sesión da de baja el token', () async {
    final platform = FakePushPlatform();
    final push = PushService(platform: platform, api: api);
    await push.syncIfPermitted();
    await push.unregister();
    expect(api.pushTokens, isEmpty);
  });

  test('los fallos de red al registrar o dar de baja no rompen nada', () async {
    final push = PushService(platform: FakePushPlatform(), api: _FailingApi());
    await push.syncIfPermitted();
    await push.unregister();
  });

  test('solo se navega a rutas conocidas', () async {
    final platform = FakePushPlatform()..launchRoute = 'https://evil.example';
    final push = PushService(platform: platform, api: api);
    expect(await push.initialRoute(), isNull);

    final routes = <String>[];
    final sub = push.openedRoutes.listen(routes.add);
    platform.opened
      ..add('/group')
      ..add('/admin');
    final pushes = <ForegroundPush>[];
    final sub2 = push.foregroundMessages.listen(pushes.add);
    platform.foreground.add((title: 'Hola', body: 'Cuerpo', route: '//x'));
    await Future<void>.delayed(Duration.zero);
    expect(routes, ['/group']);
    expect(pushes.single.route, isNull);
    await sub.cancel();
    await sub2.cancel();
  });
}

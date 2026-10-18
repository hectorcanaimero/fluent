import 'dart:async';

import 'package:fluent_mobile/features/interviews/presentation/entry/incoming_share.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';

/// Plugin simulado: en vez de mockear `receive_sharing_intent` (un canal
/// nativo que no existe en `flutter test`), esto reemplaza el borde que
/// `IncomingShareService` sí controla.
class _FakePlatform implements IncomingSharePlatform {
  _FakePlatform({
    List<SharedMediaFile> initial = const [],
    Stream<List<SharedMediaFile>>? stream,
  }) : _initial = initial,
       _stream = stream ?? const Stream.empty();

  final List<SharedMediaFile> _initial;
  final Stream<List<SharedMediaFile>> _stream;

  @override
  Future<List<SharedMediaFile>> initialMedia() async => _initial;

  @override
  Stream<List<SharedMediaFile>> get mediaStream => _stream;
}

SharedMediaFile _text(String value) =>
    SharedMediaFile(path: value, type: SharedMediaType.text);

SharedMediaFile _url(String value) =>
    SharedMediaFile(path: value, type: SharedMediaType.url);

SharedMediaFile _image(String value) =>
    SharedMediaFile(path: value, type: SharedMediaType.image);

void main() {
  group('arranque en frío (initialText)', () {
    test('texto con enlace: se manda entero, sin partirlo', () async {
      const shared = 'Senior Backend Engineer at Acme https://acme.com/jobs/1';
      final service = IncomingShareService(
        _FakePlatform(initial: [_text(shared)]),
      );

      expect(await service.initialText(), shared);
    });

    test('solo un enlace: se manda igual, tal cual', () async {
      const shared = 'https://acme.com/jobs/1';
      final service = IncomingShareService(
        _FakePlatform(initial: [_url(shared)]),
      );

      expect(await service.initialText(), shared);
    });

    test('texto vacío: se ignora', () async {
      final service = IncomingShareService(
        _FakePlatform(initial: [_text('   ')]),
      );

      expect(await service.initialText(), isNull);
    });

    test('sin nada compartido: se ignora', () async {
      final service = IncomingShareService(_FakePlatform());

      expect(await service.initialText(), isNull);
    });

    test('un tipo que no es texto ni URL (imagen) se ignora', () async {
      final service = IncomingShareService(
        _FakePlatform(initial: [_image('/tmp/foto.png')]),
      );

      expect(await service.initialText(), isNull);
    });
  });

  group('app abierta (sharedText)', () {
    test('texto con enlace llega por el stream tal cual', () async {
      const shared = 'Backend dev at Acme https://acme.com/jobs/2';
      final controller = StreamController<List<SharedMediaFile>>();
      final service = IncomingShareService(
        _FakePlatform(stream: controller.stream),
      );

      final events = <String>[];
      final sub = service.sharedText.listen(events.add);
      controller.add([_text(shared)]);
      await Future<void>.delayed(Duration.zero);

      expect(events, [shared]);
      await sub.cancel();
      await controller.close();
    });

    test('un share vacío no emite nada', () async {
      final controller = StreamController<List<SharedMediaFile>>();
      final service = IncomingShareService(
        _FakePlatform(stream: controller.stream),
      );

      final events = <String>[];
      final sub = service.sharedText.listen(events.add);
      controller.add([_text('')]);
      await Future<void>.delayed(Duration.zero);

      expect(events, isEmpty);
      await sub.cancel();
      await controller.close();
    });

    test('arranque en frío y app abierta no se mezclan', () async {
      final controller = StreamController<List<SharedMediaFile>>();
      final service = IncomingShareService(
        _FakePlatform(
          initial: [_text('compartido al arrancar')],
          stream: controller.stream,
        ),
      );

      expect(await service.initialText(), 'compartido al arrancar');

      final events = <String>[];
      final sub = service.sharedText.listen(events.add);
      controller.add([_text('compartido con la app abierta')]);
      await Future<void>.delayed(Duration.zero);

      expect(events, ['compartido con la app abierta']);
      await sub.cancel();
      await controller.close();
    });
  });
}

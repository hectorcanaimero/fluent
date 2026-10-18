import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:receive_sharing_intent/receive_sharing_intent.dart';

/// Envoltorio sobre el plugin `receive_sharing_intent`: en `flutter test` no
/// hay canal de plugin, así que los tests usan un fake de esta interfaz en
/// vez del real.
abstract class IncomingSharePlatform {
  /// Lo compartido que abrió la app desde cerrada (arranque en frío); lista
  /// vacía si no se abrió por un "Compartir".
  Future<List<SharedMediaFile>> initialMedia();

  /// Lo compartido mientras la app ya estaba abierta.
  Stream<List<SharedMediaFile>> get mediaStream;
}

class ReceiveSharingIntentPlatform implements IncomingSharePlatform {
  @override
  Future<List<SharedMediaFile>> initialMedia() async {
    final media = await ReceiveSharingIntent.instance.getInitialMedia();
    // Avisa al plugin que ya se usó: si no, un siguiente `getInitialMedia()`
    // (por ejemplo tras un hot restart) repetiría el mismo intent viejo.
    ReceiveSharingIntent.instance.reset();
    return media;
  }

  @override
  Stream<List<SharedMediaFile>> get mediaStream =>
      ReceiveSharingIntent.instance.getMediaStream();
}

/// Compartir texto o un enlace desde otra app (Android `ACTION_SEND`,
/// `text/plain`) abre la entrada de entrevistas con ese contenido ya puesto
/// en el campo (F14.2.T1). El contenido entero (incluido un enlace dentro
/// del texto) se manda tal cual: `NewInterviewScreen` ya decide si es
/// `offerText` u `offerUrl` con `looksLikeOfferUrl`.
class IncomingShareService {
  IncomingShareService(this._platform);

  final IncomingSharePlatform _platform;

  /// `null` si la app no se abrió por un "Compartir".
  Future<String?> initialText() async =>
      _textFrom(await _platform.initialMedia());

  Stream<String> get sharedText => _platform.mediaStream
      .map(_textFrom)
      .where((text) => text != null)
      .cast<String>();

  /// Un share de texto o de una sola URL llega como un `SharedMediaFile`
  /// cuyo `path` tiene el contenido (el campo se llama `path` para todos
  /// los tipos del plugin, no solo archivos). Otros tipos (imagen, video,
  /// archivo) se ignoran: el intent-filter de Android solo pide
  /// `text/plain`. Un texto vacío también se ignora.
  static String? _textFrom(List<SharedMediaFile> files) {
    for (final file in files) {
      if (file.type != SharedMediaType.text &&
          file.type != SharedMediaType.url) {
        continue;
      }
      final text = file.path.trim();
      if (text.isNotEmpty) return text;
    }
    return null;
  }
}

final incomingSharePlatformProvider = Provider<IncomingSharePlatform>(
  (ref) => ReceiveSharingIntentPlatform(),
);

final incomingShareServiceProvider = Provider<IncomingShareService>(
  (ref) => IncomingShareService(ref.watch(incomingSharePlatformProvider)),
);

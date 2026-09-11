import 'dart:typed_data';

import 'package:share_plus/share_plus.dart';

/// Abstrae `share_plus` para poder verificar en tests qué texto/imagen se
/// comparte, sin depender del canal de plataforma nativo.
abstract class ShareService {
  Future<void> shareText(String text);

  /// MEJ-07: "Compartir tu racha" comparte un PNG (`RepaintBoundary` de la
  /// tarjeta), no texto.
  Future<void> shareImage(Uint8List bytes, {required String fileName});
}

class SharePlusService implements ShareService {
  const SharePlusService();

  @override
  Future<void> shareText(String text) async {
    await Share.share(text);
  }

  @override
  Future<void> shareImage(Uint8List bytes, {required String fileName}) async {
    await Share.shareXFiles([
      XFile.fromData(bytes, name: fileName, mimeType: 'image/png'),
    ]);
  }
}

class FakeShareService implements ShareService {
  final List<String> shared = [];
  final List<Uint8List> sharedImages = [];

  @override
  Future<void> shareText(String text) async {
    shared.add(text);
  }

  @override
  Future<void> shareImage(Uint8List bytes, {required String fileName}) async {
    sharedImages.add(bytes);
  }
}

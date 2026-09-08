import 'package:share_plus/share_plus.dart';

/// Abstrae `share_plus` para poder verificar en tests qué texto se
/// comparte, sin depender del canal de plataforma nativo.
abstract class ShareService {
  Future<void> shareText(String text);
}

class SharePlusService implements ShareService {
  const SharePlusService();

  @override
  Future<void> shareText(String text) async {
    await Share.share(text);
  }
}

class FakeShareService implements ShareService {
  final List<String> shared = [];

  @override
  Future<void> shareText(String text) async {
    shared.add(text);
  }
}

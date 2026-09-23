import 'package:flutter_test/flutter_test.dart';
import 'package:fluent_mobile/core/api/models.dart';

Map<String, dynamic> _me(Map<String, dynamic> extra) => {
  'profile': {
    'displayName': 'María',
    'level': 'B1',
    'interests': <String>[],
    'timezone': 'UTC',
    'locale': 'es',
    'xp': 0,
    'streak': 0,
    'userId': 'u1',
  },
  'onboarded': true,
  ...extra,
};

void main() {
  test('MeResponse sin plan es Free', () {
    final me = MeResponse.fromJson(_me({}));
    expect(me.plan, 'free');
    expect(me.planExpiresAt, isNull);
    expect(me.isPro, isFalse);
  });

  test('parsea plan y planExpiresAt; Pro futuro es isPro', () {
    final exp = DateTime.now().add(const Duration(days: 30)).toUtc();
    final me = MeResponse.fromJson(
      _me({'plan': 'pro', 'planExpiresAt': exp.toIso8601String()}),
    );
    expect(me.plan, 'pro');
    expect(me.planExpiresAt, exp);
    expect(me.isPro, isTrue);
  });

  test('Pro sin fecha es isPro; Pro vencido no', () {
    expect(MeResponse.fromJson(_me({'plan': 'pro'})).isPro, isTrue);
    final past = DateTime.now().subtract(const Duration(days: 1)).toUtc();
    final me = MeResponse.fromJson(
      _me({'plan': 'pro', 'planExpiresAt': past.toIso8601String()}),
    );
    expect(me.isPro, isFalse);
  });
}

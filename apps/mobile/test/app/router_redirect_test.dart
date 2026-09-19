import 'package:fluent_mobile/app/router.dart';
import 'package:fluent_mobile/features/auth/domain/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('computeRedirect', () {
    test('mientras el estado es unknown, se queda en /splash', () {
      const auth = AuthState();
      expect(computeRedirect(auth, '/splash'), isNull);
      expect(computeRedirect(auth, '/'), '/splash');
    });

    test('no sale de /splash hasta que termina la animación', () {
      const auth = AuthState(status: AuthStatus.unauthenticated);
      expect(computeRedirect(auth, '/splash', splashDone: false), isNull);
      expect(computeRedirect(auth, '/splash', splashDone: true), '/login');
    });

    test('sin token, cualquier ruta redirige a /login', () {
      const auth = AuthState(status: AuthStatus.unauthenticated);
      expect(computeRedirect(auth, '/'), '/login');
      expect(computeRedirect(auth, '/group'), '/login');
      expect(computeRedirect(auth, '/login'), isNull);
      expect(computeRedirect(auth, '/register'), '/login');
    });

    test('autenticado sin onboarded va a /onboarding', () {
      const auth = AuthState(status: AuthStatus.authenticated, onboarded: false);
      expect(computeRedirect(auth, '/'), '/onboarding');
      expect(computeRedirect(auth, '/onboarding'), isNull);
    });

    test('autenticado y onboarded sale de /login hacia /', () {
      const auth = AuthState(status: AuthStatus.authenticated, onboarded: true);
      expect(computeRedirect(auth, '/login'), '/');
      expect(computeRedirect(auth, '/group'), isNull);
    });

    test('con sesión activa pendiente, redirige a /session/:id', () {
      const auth = AuthState(
        status: AuthStatus.authenticated,
        onboarded: true,
        activeSessionId: 'session-42',
      );
      expect(computeRedirect(auth, '/'), '/session/session-42');
      expect(computeRedirect(auth, '/session/session-42'), isNull);
      expect(computeRedirect(auth, '/session/session-42/summary'), isNull);
    });

    test('estando en el resumen no vuelve a empujar a la conversación (MAL-04)', () {
      const auth = AuthState(
        status: AuthStatus.authenticated,
        onboarded: true,
        activeSessionId: 'session-42',
      );
      expect(computeRedirect(auth, '/session/session-42/summary'), isNull);

      // Y una vez que el resumen limpia la sesión activa, se puede volver al
      // inicio sin que el router rebote.
      const cleared = AuthState(status: AuthStatus.authenticated, onboarded: true);
      expect(computeRedirect(cleared, '/'), isNull);
    });

    test('en error se queda en /splash y no manda a /login (MAL-03)', () {
      const auth = AuthState(status: AuthStatus.error);
      expect(computeRedirect(auth, '/splash'), isNull);
      expect(computeRedirect(auth, '/'), '/splash');
      expect(computeRedirect(auth, '/login'), '/splash');
      expect(computeRedirect(auth, '/group'), '/splash');
    });
  });
}

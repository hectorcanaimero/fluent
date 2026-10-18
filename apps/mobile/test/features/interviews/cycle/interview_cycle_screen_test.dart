import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/presentation/cycle/interview_cycle_screen.dart';
import 'package:fluent_mobile/l10n/gen/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

/// Cuenta los `POST /interviews/:id/cycle/sessions/:idx/start` para
/// comprobar que una fila bloqueada nunca llega a pedirlo.
class _SpyApi extends FakeApi {
  _SpyApi() : super(artificialDelay: Duration.zero);

  final List<int> startedIdx = [];
  int createCalls = 0;
  int getCalls = 0;

  /// Si no es `null`, `startStudyCycleSession` lanza esto.
  Object? startError;

  @override
  Future<StudyCycle> createStudyCycle(String id) {
    createCalls++;
    return super.createStudyCycle(id);
  }

  @override
  Future<StudyCycle> getStudyCycle(String id) {
    getCalls++;
    return super.getStudyCycle(id);
  }

  @override
  Future<InterviewSessionStart> startStudyCycleSession({
    required String interviewId,
    required int idx,
  }) {
    startedIdx.add(idx);
    final error = startError;
    if (error != null) throw error;
    return super.startStudyCycleSession(interviewId: interviewId, idx: idx);
  }
}

Future<GoRouter> _pump(WidgetTester tester, FakeApi api, String id) async {
  // Las 5 filas más la re-entrevista no entran en el alto por defecto del
  // test (la `ListView` real solo monta lo que entra en el viewport): un
  // lienzo más alto evita tener que scrollear para encontrarlas.
  await tester.binding.setSurfaceSize(const Size(800, 1600));
  addTearDown(() => tester.binding.setSurfaceSize(null));
  final router = GoRouter(
    initialLocation: '/interviews/$id/cycle',
    routes: [
      GoRoute(
        path: '/interviews/:id/cycle',
        builder: (context, state) =>
            InterviewCycleScreen(interviewId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/session/:id',
        builder: (context, state) => Scaffold(
          body: Text(
            'SESSION_${state.pathParameters['id']}'
            '_${state.uri.queryParameters['from']}'
            '_${state.uri.queryParameters['interviewId']}',
          ),
        ),
      ),
    ],
  );
  await tester.pumpWidget(
    ProviderScope(
      overrides: [fluentApiProvider.overrideWith((ref) => api)],
      child: MaterialApp.router(
        routerConfig: router,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        supportedLocales: AppLocalizations.supportedLocales,
      ),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

/// Entrevista con parecer listo (la ficha de la API real deja crear el
/// ciclo en cualquier estado, pero `ready` ya trae `company`/competencias
/// con las que esta pantalla rotula cada sesión).
Future<String> _readyInterview(FakeApi api) async {
  final created = await api.createInterview(
    type: 'technical',
    offerText: 'Senior Backend Engineer at Acme',
  );
  await api.getInterview(created.id);
  await api.getInterview(created.id);
  await api.getInterview(created.id);
  // El `POST /cycle` lo hace el botón del parecer antes de navegar.
  await api.createStudyCycle(created.id);
  return created.id;
}

Finder _sessionStart(int idx) =>
    find.byKey(Key('interview_cycle_session_${idx}_start'));

void main() {
  testWidgets('la primera sesión está disponible y el resto bloqueadas', (
    tester,
  ) async {
    final api = _SpyApi();
    final id = await _readyInterview(api);
    await _pump(tester, api, id);

    expect(_sessionStart(1), findsOneWidget);
    for (var idx = 2; idx <= 5; idx++) {
      expect(_sessionStart(idx), findsNothing);
      expect(
        find.descendant(
          of: find.byKey(Key('interview_cycle_session_$idx')),
          matching: find.text('Bloqueada'),
        ),
        findsOneWidget,
      );
    }
  });

  testWidgets('completar una sesión desbloquea la siguiente y la marca hecha', (
    tester,
  ) async {
    final api = _SpyApi();
    final id = await _readyInterview(api);
    await _pump(tester, api, id);

    api.completeStudySession(id, 1);
    await _pump(tester, api, id);

    expect(
      find.descendant(
        of: find.byKey(const Key('interview_cycle_session_1')),
        matching: find.text('Hecha'),
      ),
      findsOneWidget,
    );
    expect(_sessionStart(2), findsOneWidget);
    for (var idx = 3; idx <= 5; idx++) {
      expect(_sessionStart(idx), findsNothing);
    }
  });

  testWidgets('una fila bloqueada no se puede tocar', (tester) async {
    final api = _SpyApi();
    final id = await _readyInterview(api);
    await _pump(tester, api, id);

    // Sin botón para la fila bloqueada, tocar la fila entera tampoco
    // dispara el `POST` que abre la sesión.
    await tester.tap(find.byKey(const Key('interview_cycle_session_2')));
    await tester.pumpAndSettle();

    expect(api.startedIdx, isEmpty);
    expect(_sessionStart(2), findsNothing);
  });

  testWidgets('"Empezar" abre la conversación normal con el sessionId', (
    tester,
  ) async {
    final api = _SpyApi();
    final id = await _readyInterview(api);
    await _pump(tester, api, id);

    await tester.tap(_sessionStart(1));
    await tester.pumpAndSettle();

    expect(api.startedIdx, [1]);
    expect(find.text('SESSION_study-session-$id-1_cycle_$id'), findsOneWidget);
  });

  testWidgets('solo lee el ciclo con GET, nunca lo crea', (tester) async {
    final api = _SpyApi();
    final id = await _readyInterview(api);
    final creates = api.createCalls;
    await _pump(tester, api, id);

    expect(api.getCalls, 1);
    expect(api.createCalls, creates);
  });

  testWidgets('al volver de la sesión recarga el ciclo', (tester) async {
    final api = _SpyApi();
    final id = await _readyInterview(api);
    final router = await _pump(tester, api, id);

    await tester.tap(_sessionStart(1));
    await tester.pumpAndSettle();
    api.completeStudySession(id, 1);
    router.pop();
    await tester.pumpAndSettle();

    expect(api.getCalls, 2);
    expect(_sessionStart(2), findsOneWidget);
    expect(find.text('1 de 5 sesiones'), findsOneWidget);
  });

  testWidgets('un error que no es de la API muestra un aviso genérico', (
    tester,
  ) async {
    final api = _SpyApi()..startError = StateError('boom');
    final id = await _readyInterview(api);
    await _pump(tester, api, id);

    await tester.tap(_sessionStart(1));
    await tester.pumpAndSettle();

    expect(find.text('Ocurrió un error. Probá de nuevo.'), findsOneWidget);
    // El botón vuelve a quedar habilitado.
    expect(
      tester.widget<ElevatedButton>(_sessionStart(1)).onPressed,
      isNotNull,
    );
  });

  testWidgets('la re-entrevista queda bloqueada hasta completar las 5', (
    tester,
  ) async {
    final api = _SpyApi();
    final id = await _readyInterview(api);
    await _pump(tester, api, id);

    expect(
      find.text('Se desbloquea al completar las 5 sesiones'),
      findsOneWidget,
    );

    for (var idx = 1; idx <= 5; idx++) {
      api.completeStudySession(id, idx);
    }
    await _pump(tester, api, id);

    expect(
      find.text(
        'Compara tu avance con una nueva entrevista sobre la misma oferta',
      ),
      findsOneWidget,
    );
  });
}

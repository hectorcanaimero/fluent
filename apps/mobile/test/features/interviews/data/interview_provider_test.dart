import 'package:fake_async/fake_async.dart';
import 'package:fluent_mobile/core/api/fake_api.dart';
import 'package:fluent_mobile/core/api/models.dart';
import 'package:fluent_mobile/core/errors/api_exception.dart';
import 'package:fluent_mobile/core/providers.dart';
import 'package:fluent_mobile/features/interviews/data/interviews_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

/// `GET /interviews/:id` guionado: cada llamada consume la siguiente
/// respuesta (un [InterviewDetail] o una excepción a lanzar).
class _ScriptedApi extends FakeApi {
  _ScriptedApi(this.script) : super(artificialDelay: Duration.zero);

  final List<Object> script;
  int calls = 0;

  @override
  Future<InterviewDetail> getInterview(String id) async {
    final next = script[calls < script.length ? calls : script.length - 1];
    calls++;
    if (next is InterviewDetail) return next;
    throw next;
  }
}

InterviewDetail _detail(String status) => InterviewDetail(
  id: 'i1',
  type: 'technical',
  status: status,
  createdAt: '2026-10-18',
);

const _netError = ApiException(
  code: ApiErrorCode.unknown,
  message: 'network error',
);

void main() {
  List<AsyncValue<InterviewDetail>> listen(ProviderContainer container) {
    final states = <AsyncValue<InterviewDetail>>[];
    container.listen(
      interviewProvider('i1'),
      (_, next) => states.add(next),
      fireImmediately: true,
    );
    return states;
  }

  test('un GET fallido mientras preparing no corta el repolleo', () {
    fakeAsync((async) {
      final api = _ScriptedApi([
        _detail('preparing'),
        _netError,
        _detail('ready'),
      ]);
      final container = ProviderContainer(
        overrides: [fluentApiProvider.overrideWith((ref) => api)],
      );
      addTearDown(container.dispose);
      final states = listen(container);

      async.flushMicrotasks();
      expect(states.last.value?.status, 'preparing');

      async.elapse(const Duration(seconds: 3)); // falla: se mantiene el valor
      expect(api.calls, 2);
      expect(states.last.hasError, isFalse);
      expect(states.last.value?.status, 'preparing');

      async.elapse(const Duration(seconds: 6)); // backoff 6 s, luego ready
      expect(api.calls, 3);
      expect(states.last.value?.status, 'ready');

      async.elapse(const Duration(seconds: 60)); // ready: deja de repollar
      expect(api.calls, 3);
    });
  });

  test('el error solo sale tras 5 fallos seguidos', () {
    fakeAsync((async) {
      final api = _ScriptedApi([_detail('feedback_pending'), _netError]);
      final container = ProviderContainer(
        overrides: [fluentApiProvider.overrideWith((ref) => api)],
      );
      addTearDown(container.dispose);
      final states = listen(container);

      // 3 s + 6 s + 12 s + 24 s → 4 fallos, todavía sin error.
      async.elapse(const Duration(seconds: 45));
      expect(api.calls, 5);
      expect(states.last.hasError, isFalse);

      async.elapse(const Duration(seconds: 30)); // 5.º fallo
      expect(api.calls, 6);
      expect(states.last.hasError, isTrue);
      expect(states.last.value?.status, 'feedback_pending');
    });
  });
}

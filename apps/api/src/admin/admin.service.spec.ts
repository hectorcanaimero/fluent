import { ConfigService } from '@nestjs/config';
import { ApiException } from '../common/api-error.js';
import { OwnerService } from '../common/owner.service.js';
import { AdminService } from './admin.service.js';
import type { AdminRepository } from './admin.repository.js';
import type { QueueMetricsService } from './queue-metrics.service.js';

const OWNER_USER_ID = '9595625c-aea8-4120-accc-ed149d0a84c6';

/** `ConfigService` mínimo: solo devuelve `OWNER_USER_ID`. */
function makeConfigService(): ConfigService {
  return {
    get: (key: string) => (key === 'OWNER_USER_ID' ? OWNER_USER_ID : undefined),
  } as unknown as ConfigService;
}

/**
 * Doble del repositorio con datos deterministas y un contador de llamadas,
 * para poder comprobar que un no-owner **ni siquiera llega** a la base.
 */
function makeAdminRepository() {
  const calls = { sessions: 0, ended: 0, llm: 0, queues: 0 };
  const now = new Date('2026-09-09T12:00:00.000Z');

  const repository = {
    listRecentSessions: async () => {
      calls.sessions += 1;
      return [
        { started_at: '2026-09-09T08:00:00.000Z' },
        { started_at: '2026-09-09T09:30:00.000Z' },
        { started_at: '2026-09-08T10:00:00.000Z' },
      ];
    },
    listRecentEndedSessions: async () => {
      calls.ended += 1;
      return [{ duration_sec: 600 }, { duration_sec: 300 }];
    },
    listRecentLlmCalls: async () => {
      calls.llm += 1;
      return [
        { status: 'ok' },
        { status: 'ok' },
        { status: 'timeout' },
        { status: 'provider_error' },
      ];
    },
  } as unknown as AdminRepository;

  return { repository, calls, now };
}

/** Doble de `QueueMetricsService` (SPEC-05 §9), con el mismo contador. */
function makeQueueMetricsService(calls: { queues: number }) {
  return {
    list: async () => {
      calls.queues += 1;
      return [
        { name: 'brief', waiting: 1, active: 0, failed: 2 },
        { name: 'content', waiting: 0, active: 0, failed: 0 },
        { name: 'social', waiting: 3, active: 1, failed: 0 },
        { name: 'maintenance', waiting: 0, active: 0, failed: 0 },
      ];
    },
  } as unknown as QueueMetricsService;
}

function makeService() {
  const { repository, calls, now } = makeAdminRepository();
  const service = new AdminService(
    new OwnerService(makeConfigService()),
    repository,
    makeQueueMetricsService(calls),
  );
  return { service, calls, now };
}

describe('AdminService · GET /admin/metrics (SPEC-02 §4.6, RF-8.2)', () => {
  it('responde 403 FORBIDDEN a un usuario que no es owner', async () => {
    const { service, calls, now } = makeService();

    await expect(service.getMetrics('otro-usuario', now)).rejects.toBeInstanceOf(
      ApiException,
    );

    // No se consulta nada: el rechazo es anterior a cualquier lectura.
    expect(calls).toEqual({ sessions: 0, ended: 0, llm: 0, queues: 0 });
  });

  it('el cuerpo del 403 cumple el formato de SPEC-02 §6', async () => {
    const { service, now } = makeService();

    try {
      await service.getMetrics('otro-usuario', now);
      expect.unreachable('getMetrics debería haber lanzado');
    } catch (error) {
      const exception = error as ApiException;
      expect(exception.getStatus()).toBe(403);
      expect(exception.getApiBody()).toMatchObject({
        error: 'FORBIDDEN',
        statusCode: 403,
      });
      expect(typeof exception.getApiBody().message).toBe('string');
    }
  });

  it('ser owner del grupo no basta: /admin/metrics es solo del owner del sistema', async () => {
    const { service, now } = makeService();

    // `group-owner` sería owner para POST /admin/invitations (PEND-11), pero
    // estas métricas son del operador del despliegue, no de un grupo.
    await expect(service.getMetrics('group-owner', now)).rejects.toBeInstanceOf(
      ApiException,
    );
  });

  it('devuelve las métricas al OWNER_USER_ID con la forma de SPEC-02 §4.6', async () => {
    const { service, now } = makeService();

    const metrics = await service.getMetrics(OWNER_USER_ID, now);

    // 14 días, del más antiguo al más reciente, incluidos los vacíos.
    expect(metrics.sessionsPerDay).toHaveLength(14);
    expect(metrics.sessionsPerDay.at(-1)).toEqual({ day: '2026-09-09', count: 2 });
    expect(metrics.sessionsPerDay.at(-2)).toEqual({ day: '2026-09-08', count: 1 });

    expect(metrics.avgDurationSec).toBe(450);

    // 2 fallos de 4 llamadas.
    expect(metrics.llmFailureRate).toBeCloseTo(0.5);
    expect(metrics.llmFailureRateTotals).toEqual({ total: 4, failed: 2 });
  });

  it('incluye los jobs pendientes de las 4 colas en la misma respuesta (RF-8.2)', async () => {
    const { service, now } = makeService();

    const metrics = await service.getMetrics(OWNER_USER_ID, now);

    expect(metrics.queues.map((queue) => queue.name)).toEqual([
      'brief',
      'content',
      'social',
      'maintenance',
    ]);
    expect(metrics.queues[0]).toEqual({
      name: 'brief',
      waiting: 1,
      active: 0,
      failed: 2,
    });
  });
});

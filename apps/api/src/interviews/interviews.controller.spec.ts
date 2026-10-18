import 'reflect-metadata';

import { ApiException } from '../common/api-error.js';
import type { CreateInterviewDto } from './dto/create-interview.dto.js';
import { InterviewsController } from './interviews.controller.js';
import type { InterviewDto } from './interviews.service.js';
import type { InterviewsService } from './interviews.service.js';

/**
 * Contrato del controlador: cada ruta llama al método correcto de
 * `InterviewsService` con `userId`/`id`/`dto`, sin lógica propia. Las
 * reglas de negocio (LinkedIn, tope diario, retry, 404, FR-7) se prueban en
 * `interviews.service.spec.ts`, igual que `SessionsController` deja el
 * turno a `turns.service.spec.ts`.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_USER_ID = '55555555-5555-4555-8555-555555555555';
const INTERVIEW_ID = '22222222-2222-4222-8222-222222222222';

const INTERVIEW: InterviewDto = {
  id: INTERVIEW_ID,
  type: 'mixed',
  status: 'preparing',
  prepStep: 'reading',
  createdAt: '2026-03-10T09:00:00.000Z',
};

function buildController() {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const service = {
    getQuota: async (userId: string) => {
      calls.push({ method: 'getQuota', args: [userId] });
      return { remaining: 2, limit: 3, requiresPro: false, freeNotice: true as const };
    },
    create: async (userId: string, dto: CreateInterviewDto) => {
      calls.push({ method: 'create', args: [userId, dto] });
      return INTERVIEW;
    },
    list: async (userId: string) => {
      calls.push({ method: 'list', args: [userId] });
      return { items: [] };
    },
    detail: async (userId: string, id: string) => {
      calls.push({ method: 'detail', args: [userId, id] });
      if (userId === OTHER_USER_ID) {
        throw ApiException.of('NOT_FOUND', 'No encontramos esa entrevista.');
      }
      return { ...INTERVIEW, company: null, role: null, area: null, seniority: null, questionCount: null, estimatedMin: null, competencies: [], errorCode: null };
    },
    retry: async (userId: string, id: string) => {
      calls.push({ method: 'retry', args: [userId, id] });
      return INTERVIEW;
    },
  } as unknown as InterviewsService;

  return { controller: new InterviewsController(service), calls };
}

describe('InterviewsController', () => {
  it('GET interviews/quota llama a getQuota con el usuario actual', async () => {
    const { controller, calls } = buildController();
    const result = await controller.quota(USER_ID);
    expect(calls).toEqual([{ method: 'getQuota', args: [USER_ID] }]);
    expect(result.freeNotice).toBe(true);
  });

  it('POST interviews llama a create con el usuario y el dto', async () => {
    const { controller, calls } = buildController();
    const dto: CreateInterviewDto = { type: 'mixed', offerText: 'oferta' };
    const result = await controller.create(USER_ID, dto);
    expect(calls).toEqual([{ method: 'create', args: [USER_ID, dto] }]);
    expect(result).toBe(INTERVIEW);
  });

  it('GET interviews llama a list con el usuario actual', async () => {
    const { controller, calls } = buildController();
    await controller.list(USER_ID);
    expect(calls).toEqual([{ method: 'list', args: [USER_ID] }]);
  });

  it('GET interviews/:id llama a detail y propaga el 404 de otro usuario', async () => {
    const { controller, calls } = buildController();
    const error = await controller.detail(OTHER_USER_ID, INTERVIEW_ID).catch((caught: unknown) => caught);
    expect(calls).toEqual([{ method: 'detail', args: [OTHER_USER_ID, INTERVIEW_ID] }]);
    expect(error).toBeInstanceOf(ApiException);
    expect((error as ApiException).code).toBe('NOT_FOUND');
  });

  it('POST interviews/:id/retry llama a retry con el usuario y el id', async () => {
    const { controller, calls } = buildController();
    const result = await controller.retry(USER_ID, INTERVIEW_ID);
    expect(calls).toEqual([{ method: 'retry', args: [USER_ID, INTERVIEW_ID] }]);
    expect(result).toBe(INTERVIEW);
  });
});

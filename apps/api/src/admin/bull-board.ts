/**
 * Montaje de Bull Board (SPEC-05 §9) en `/admin/queues`, protegido por un
 * bearer token de owner.
 *
 * Se monta como middleware Express crudo (`app.use`), no como controller de
 * Nest, para que quede fuera del prefijo global `v1` (ver PEND-25 de
 * docs/specs/pendientes/PR-05.md: SPEC-05 §9 lo lista sin prefijo, a
 * diferencia de `/v1/admin/metrics`).
 *
 * La autorización ya no la hace el `OwnerAuthGuard` de PR-05 (borrado al
 * fusionar PR-02: repetía la introspección de token sin caché), sino
 * `createOwnerBearerMiddleware` de `auth/owner-bearer.middleware.ts`.
 *
 * Extraído a una función reutilizable (`mountBullBoard`) en vez de vivir
 * inline en `bootstrap()` de `main.ts`: los tests e2e construyen la app con
 * `Test.createTestingModule({ imports: [AppModule] }).createNestApplication()`,
 * que NO pasa por `main.ts`, así que sin esta función `/admin/queues` no
 * existiría en la app de test y cualquier aserción devolvería 404 en vez de
 * 401/403/200.
 */
import { getQueueToken } from '@nestjs/bullmq';
import type { INestApplication } from '@nestjs/common';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Queue } from 'bullmq';

import { createOwnerBearerMiddleware } from '../auth/owner-bearer.middleware.js';
import {
  QUEUE_BRIEF,
  QUEUE_CONTENT,
  QUEUE_MAINTENANCE,
  QUEUE_SOCIAL,
} from '../jobs/jobs.constants.js';

export const BULL_BOARD_BASE_PATH = '/admin/queues';

export function mountBullBoard(app: INestApplication): void {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_BASE_PATH);

  const queueNames = [QUEUE_BRIEF, QUEUE_CONTENT, QUEUE_SOCIAL, QUEUE_MAINTENANCE];
  const queues = queueNames.map((name) => app.get<Queue>(getQueueToken(name)));

  createBullBoard({
    queues: queues.map((queue) => new BullMQAdapter(queue)),
    serverAdapter,
  });

  // Middleware de autorización: solo el owner. No se puede usar un guard de
  // Nest sobre un router Express montado a mano, así que se reutiliza el
  // mismo par `AuthGuard.resolveUserId` + `OwnerService.isSystemOwner` que
  // aplica el resto de la API (ver `auth/owner-bearer.middleware.ts`).
  app.use(BULL_BOARD_BASE_PATH, createOwnerBearerMiddleware(app));

  app.use(BULL_BOARD_BASE_PATH, serverAdapter.getRouter());
}

/**
 * Montaje de Bull Board (SPEC-05 §9) en `/admin/queues`, protegido por un
 * bearer token de owner.
 *
 * Se monta como middleware Express crudo (`app.use`), no como controller de
 * Nest, para que quede fuera del prefijo global `v1` (ver PEND-25 de
 * docs/specs/pendientes/PR-05.md: SPEC-05 §9 lo lista sin prefijo, a
 * diferencia de `/v1/admin/metrics`).
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
import { ConfigService } from '@nestjs/config';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Queue } from 'bullmq';
import type { NextFunction, Request, Response } from 'express';

import type { Env } from '../config/env.js';
import { InsforgeHttp } from '../insforge/insforge.http.js';
import {
  QUEUE_BRIEF,
  QUEUE_CONTENT,
  QUEUE_MAINTENANCE,
  QUEUE_SOCIAL,
} from '../jobs/jobs.constants.js';
import { checkOwnerBearer } from './owner-auth.guard.js';

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

  const insforgeHttp = app.get(InsforgeHttp);
  const configService = app.get(ConfigService<Env, true>);
  const ownerId = configService.get('OWNER_USER_ID', { infer: true });

  // Middleware de autenticación: solo el owner puede acceder. Duplica la
  // lógica de `OwnerAuthGuard` a través de `checkOwnerBearer` (no se puede
  // usar un guard de Nest sobre un router Express montado a mano).
  app.use(
    BULL_BOARD_BASE_PATH,
    async (req: Request, res: Response, next: NextFunction) => {
      const result = await checkOwnerBearer(
        req.headers.authorization,
        insforgeHttp,
        ownerId,
      );
      if (!result.ok) {
        res.status(result.status).json({
          error: result.error,
          message: result.message,
          statusCode: result.status,
        });
        return;
      }
      next();
    },
  );

  app.use(BULL_BOARD_BASE_PATH, serverAdapter.getRouter());
}

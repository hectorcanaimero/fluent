import { Injectable } from '@nestjs/common';
import { APP_VERSION } from '../config/version.js';

/**
 * Resultado de `GET /v1/health`.
 *
 * Diseño abierto a extensión: una tarea futura (T3) añadirá `redis` e
 * `insforge` (SPEC-08 §7) a este mismo objeto.
 */
export interface HealthStatus {
  ok: boolean;
  version: string;
}

@Injectable()
export class HealthService {
  check(): HealthStatus {
    return {
      ok: true,
      version: APP_VERSION,
    };
  }
}

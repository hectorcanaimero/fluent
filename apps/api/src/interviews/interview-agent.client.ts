/**
 * Cliente HTTP de `interview-agent` (docs/arch/003-simulador-entrevistas.md,
 * Componente C1 e Interfaz I1/I4).
 *
 * `prepare`/`feedback` validan la respuesta con los mismos schemas zod que
 * fijan el contrato (F10.1.T2): un cambio incompatible en el servicio Python
 * se detecta aquí como `AgentInvalidResponseError` en vez de llegar corrupto
 * a la base de datos.
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ZodType } from 'zod';

import type { Env } from '../config/env.js';
import {
  FeedbackRequest,
  FeedbackResponse,
  PrepareRequest,
  PrepareResponse,
} from './interviews.types.js';

/** I4: la investigación con búsqueda web de Agno puede tardar bastante. */
const AGENT_TIMEOUT_MS = 120_000;

/** El agente no respondió: red, timeout, status fuera de 2xx, o sin configurar. */
export class AgentUnavailableError extends Error {
  readonly name = 'AgentUnavailableError';
  readonly code = 'AGENT_UNAVAILABLE';
}

/** El agente respondió, pero el cuerpo no cumple el contrato zod de I1. */
export class AgentInvalidResponseError extends Error {
  readonly name = 'AgentInvalidResponseError';
  readonly code = 'AGENT_INVALID_RESPONSE';
}

@Injectable()
export class InterviewAgentClient {
  private readonly baseUrl: string | undefined;
  private readonly token: string | undefined;

  constructor(configService: ConfigService<Env, true>) {
    this.baseUrl = configService.get('INTERVIEW_AGENT_URL', { infer: true });
    this.token = configService.get('INTERVIEW_AGENT_TOKEN', { infer: true });
  }

  async prepare(req: PrepareRequest): Promise<PrepareResponse> {
    const json = await this.post('/v1/prepare', req);
    return this.validate(PrepareResponse, json, '/v1/prepare');
  }

  async feedback(req: FeedbackRequest): Promise<FeedbackResponse> {
    const json = await this.post('/v1/feedback', req);
    return this.validate(FeedbackResponse, json, '/v1/feedback');
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    if (!this.baseUrl || !this.token) {
      throw new AgentUnavailableError(
        'INTERVIEW_AGENT_URL/INTERVIEW_AGENT_TOKEN no están configurados',
      );
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
      });
    } catch (error) {
      throw new AgentUnavailableError(
        `interview-agent no respondió en ${path}: ${(error as Error).message}`,
      );
    }

    if (!response.ok) {
      throw new AgentUnavailableError(
        `interview-agent respondió ${response.status} en ${path}`,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new AgentUnavailableError(
        `interview-agent devolvió un cuerpo no-JSON en ${path}: ${(error as Error).message}`,
      );
    }
  }

  private validate<T>(schema: ZodType<T>, json: unknown, path: string): T {
    const result = schema.safeParse(json);
    if (!result.success) {
      throw new AgentInvalidResponseError(
        `respuesta inválida de interview-agent en ${path}: ${result.error.message}`,
      );
    }
    return result.data;
  }
}

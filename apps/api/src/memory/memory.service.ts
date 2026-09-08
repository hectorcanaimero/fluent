import { Injectable } from '@nestjs/common';
import { ApiException } from '../common/api-error.js';
import { toCoachingBriefDto, toMemoryFactDto } from './memory.mapper.js';
import { type FactPatch, MemoryRepository } from './memory.repository.js';
import type { CoachingBriefDto, MemoryFactDto, MemoryResultDto } from './memory.types.js';

const FORBIDDEN_FACT_MESSAGE = 'Ese hecho no existe o no te pertenece.';
const VALIDATION_MESSAGE = 'Los datos enviados no son válidos.';

/**
 * `MemoryModule` (SPEC-02 §4.4, RF-4.x): `GET /memory`,
 * `PATCH /memory/facts/:id`, `DELETE /memory/facts/:id`,
 * `PUT /memory/brief`, `DELETE /memory`.
 *
 * **Idioma de los mensajes de error (PEND-43):** al igual que
 * `ProvidersService` (PR-02/T4, `docs/specs/pendientes/PR-02.md` PEND-29),
 * `MemoryService` no carga el perfil del usuario (no lo necesita para nada:
 * ni `facts` ni `coaching_briefs` cuelgan de `profiles`, sino directamente
 * de `auth.users`), así que no hay `profiles.locale` del que tirar. Los
 * mensajes van en español fijo, sin i18n ni `Accept-Language`, igual que los
 * de `AuthGuard`, `ValidationPipe` y `ProvidersService`.
 */
@Injectable()
export class MemoryService {
  constructor(private readonly memoryRepository: MemoryRepository) {}

  /**
   * `GET /memory`: agrupa los hechos no descartados en `pending`/`confirmed`
   * (los `dismissed` ya vienen excluidos de `listActiveFacts`, PEND-45) y
   * el brief, con un valor por defecto vacío si el usuario no tiene fila
   * todavía (PEND-40).
   */
  async getMemory(userId: string): Promise<MemoryResultDto> {
    const [facts, brief] = await Promise.all([
      this.memoryRepository.listActiveFacts(userId),
      this.memoryRepository.getBrief(userId),
    ]);

    const pending: MemoryFactDto[] = [];
    const confirmed: MemoryFactDto[] = [];

    for (const fact of facts) {
      const dto = toMemoryFactDto(fact);
      if (dto.status === 'pending') {
        pending.push(dto);
      } else {
        // `listActiveFacts` ya excluye 'dismissed': lo único que queda aparte
        // de 'pending' es 'confirmed'.
        confirmed.push(dto);
      }
    }

    return { facts: { pending, confirmed }, brief: toCoachingBriefDto(brief) };
  }

  /**
   * `PATCH /memory/facts/:id`: al menos uno de `status`/`text` debe llegar
   * (PEND-41). `403 FORBIDDEN` si el hecho no existe o es de otro usuario
   * (PEND-42): el filtro por `user_id` va siempre en
   * `MemoryRepository.updateFact`, nunca solo por `id`.
   */
  async patchFact(
    userId: string,
    factId: string,
    status: 'confirmed' | 'dismissed' | undefined,
    text: string | undefined,
  ): Promise<MemoryFactDto> {
    if (status === undefined && text === undefined) {
      throw ApiException.of('VALIDATION', VALIDATION_MESSAGE, {
        extra: {
          details: [{ field: 'status', reason: 'status o text debe estar presente' }],
        },
      });
    }

    const patch: FactPatch = {};
    if (status !== undefined) {
      patch.status = status;
    }
    if (text !== undefined) {
      patch.text = text;
    }

    const updated = await this.memoryRepository.updateFact(userId, factId, patch);
    if (updated === null) {
      throw ApiException.forbidden(FORBIDDEN_FACT_MESSAGE);
    }
    return toMemoryFactDto(updated);
  }

  /**
   * `DELETE /memory/facts/:id`: mismo criterio de aislamiento que
   * `patchFact` (PEND-42), `403 FORBIDDEN` si no borró nada.
   */
  async deleteFact(userId: string, factId: string): Promise<void> {
    const deleted = await this.memoryRepository.deleteFact(userId, factId);
    if (!deleted) {
      throw ApiException.forbidden(FORBIDDEN_FACT_MESSAGE);
    }
  }

  /** `PUT /memory/brief`: la validación de los 600 caracteres ya la hizo `PutBriefDto`. */
  async putBrief(userId: string, text: string): Promise<CoachingBriefDto> {
    const updated = await this.memoryRepository.upsertBriefText(userId, text);
    return toCoachingBriefDto(updated);
  }

  /** `DELETE /memory`: borra hechos, brief e historial del usuario (SPEC-02 §4.4). */
  async deleteAll(userId: string): Promise<void> {
    await this.memoryRepository.purgeAll(userId);
  }
}

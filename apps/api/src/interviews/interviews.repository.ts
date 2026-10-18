import { Inject, Injectable } from '@nestjs/common';
import type { InsForgeClient } from '@insforge/sdk';
import { INSFORGE_ADMIN_CLIENT } from '../insforge/insforge.constants.js';
import { unwrapInsforge } from '../insforge/insforge-result.js';
import { TABLES, type Interview } from '../db/schema.js';
import type { InterviewType } from './interviews.types.js';

/** Fila a insertar al crear una entrevista (I2, `POST /interviews`). */
export interface CreateInterviewRow {
  readonly userId: string;
  readonly type: InterviewType;
  readonly offerText: string | null;
  readonly offerUrl: string | null;
  readonly offerHash: string;
}

/**
 * Todo el acceso a datos del módulo `interviews` (I2) sobre el cliente admin
 * de InsForge.
 *
 * **Aislamiento entre usuarios:** la clave admin no aplica RLS, así que toda
 * lectura de una entrevista concreta filtra siempre por `id` **y** `user_id`
 * (mismo criterio que `SessionsRepository`): un `id` de otro usuario debe
 * comportarse como si no existiera (404), nunca como un 403.
 */
@Injectable()
export class InterviewsRepository {
  constructor(@Inject(INSFORGE_ADMIN_CLIENT) private readonly admin: InsForgeClient) {}

  /** Inserta la entrevista en `preparing`/`reading` y devuelve la fila completa. */
  async create(row: CreateInterviewRow): Promise<Interview> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .insert({
        user_id: row.userId,
        type: row.type,
        offer_text: row.offerText,
        offer_url: row.offerUrl,
        offer_hash: row.offerHash,
        status: 'preparing',
        prep_step: 'reading',
      })
      .select('*')
      .maybeSingle();

    const created = unwrapInsforge<Interview>(result);
    if (created === null) {
      throw new Error('InterviewsRepository.create: la inserción no devolvió ninguna fila');
    }
    return created;
  }

  /** Entrevista por id, solo si es del usuario; `null` si no existe o es de otro. */
  async findById(userId: string, id: string): Promise<Interview | null> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .maybeSingle();

    return unwrapInsforge<Interview>(result);
  }

  /** Entrevistas del usuario, más nueva primero (I2, `GET /interviews`, FR-31). */
  async listByUser(userId: string): Promise<Interview[]> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    return unwrapInsforge<Interview[]>(result) ?? [];
  }

  /**
   * Vuelve a poner en `preparing`/`reading` una entrevista en `prep_failed`
   * (`POST /interviews/:id/retry`, NFR-6). El filtro `.eq('status',
   * 'prep_failed')` hace la transición atómica: `null` significa que ya no
   * estaba en ese estado (otro reintento concurrente, o nunca lo estuvo), y
   * quien llama lo trata como «no se puede reintentar».
   */
  async markRetrying(userId: string, id: string): Promise<Interview | null> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status: 'preparing', prep_step: 'reading', error_code: null })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'prep_failed')
      .select('*')
      .maybeSingle();

    return unwrapInsforge<Interview>(result);
  }
}

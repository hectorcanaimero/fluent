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

/** Columnas que necesita `GET /interviews` (sin oferta, plan ni feedback). */
const LIST_COLUMNS =
  'id, type, status, prep_step, created_at, company, role, parent_interview_id, answered_count';

/** Tope de filas de `GET /interviews`. ponytail: sin paginación hasta que haga falta. */
const LIST_LIMIT = 100;

export type InterviewListRow = Pick<
  Interview,
  | 'id'
  | 'type'
  | 'status'
  | 'prep_step'
  | 'created_at'
  | 'company'
  | 'role'
  | 'parent_interview_id'
  | 'answered_count'
>;

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
  async listByUser(userId: string): Promise<InterviewListRow[]> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .select(LIST_COLUMNS)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(LIST_LIMIT);

    return unwrapInsforge<InterviewListRow[]>(result) ?? [];
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

  /**
   * `preparing` → `prep_failed` con `errorCode` (p. ej. `enqueue_failed` si
   * no se pudo encolar el job). Solo desde `preparing`, para no pisar lo que
   * el worker ya haya escrito.
   */
  async markPrepFailed(userId: string, id: string, errorCode: string): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status: 'prep_failed', prep_step: null, error_code: errorCode })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'preparing');

    unwrapInsforge(result);
  }

  /**
   * `feedback_failed` → `feedback_pending` (`POST /interviews/:id/retry`,
   * F12.3.T1): mismo criterio atómico que `markRetrying`, por eso es un
   * método separado y no el mismo `markRetrying` con otro `from`: los dos
   * estados de fallo (`prep_failed`/`feedback_failed`) reintentan a jobs
   * distintos con payloads distintos.
   */
  async markFeedbackRetrying(userId: string, id: string): Promise<Interview | null> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status: 'feedback_pending', error_code: null })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'feedback_failed')
      .select('*')
      .maybeSingle();

    return unwrapInsforge<Interview>(result);
  }

  /**
   * `feedback_pending` → `feedback_failed` (encolado del reintento fallido).
   * Solo desde `feedback_pending`, igual que `markPrepFailed`.
   */
  async markFeedbackFailed(userId: string, id: string, errorCode: string): Promise<void> {
    const result = await this.admin.database
      .from(TABLES.interviews)
      .update({ status: 'feedback_failed', error_code: errorCode })
      .eq('id', id)
      .eq('user_id', userId)
      .eq('status', 'feedback_pending');

    unwrapInsforge(result);
  }
}
